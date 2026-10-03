/* global google */
/**
 * Camada de vegetação (NDVI) — imagem pública da NASA GIBS, sem chave de API.
 * Camada apenas visual: não altera dado nem regra de negócio.
 *
 * A imagem é nativa no zoom 9 (~250 m por pixel). Em zoom maior o tile é
 * recortado a partir da imagem original, para que cada área do mapa receba
 * exatamente o pedaço correspondente do satélite (sem repetir imagem).
 *
 * A vegetação aparece somente dentro dos polígonos das áreas: cada tile é
 * recortado pelas áreas antes de ir para o mapa.
 *
 * A cor de cada pedaço é a classe da vegetação naquele ponto — solo exposto,
 * pouco capim, capim médio, muito capim e mata — sempre com as mesmas cores da
 * legenda, para o mapa mostrar onde tem forragem e onde não tem.
 */
import { classeDoVigor } from './vegetacaoClasses';

export const GIBS_BASE = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default';
export const TILE_MATRIX = 'GoogleMapsCompatible_Level9';
export const ZOOM_NATIVO = 9; // resolução nativa da imagem (~250 m por pixel)
const TAMANHO_TILE = 256;
const ANCORA_COMPOSICAO = Date.UTC(2000, 1, 18); // primeira composição de 8 dias do produto
const PASSO_COMPOSICAO = 8 * 24 * 60 * 60 * 1000;
const ATRASO_DIAS = 3; // margem para a composição mais recente já estar publicada
const LIMITE_RECORTES = 1200; // memória dos tiles já recortados
const LIMITE_MUNDO = 85.05112878; // limite da projeção de Mercator

/** Imagem vazia (1x1) usada enquanto a imagem do satélite ainda está baixando. */
const TILE_VAZIO = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/** Data (AAAA-MM-DD) da composição de 8 dias mostrada na legenda. */
export const dataReferenciaNdvi = () => {
  const alvo = Date.now() - ATRASO_DIAS * 86400000;
  const passos = Math.floor((alvo - ANCORA_COMPOSICAO) / PASSO_COMPOSICAO);
  return new Date(ANCORA_COMPOSICAO + passos * PASSO_COMPOSICAO).toISOString().slice(0, 10);
};

/** Tons originais da imagem do satélite: bege = pouca vegetação, verde escuro = muita vegetação. */
const ESCALA_ORIGEM = ['#dfcec1', '#b09b8a', '#bfde77', '#6eaa01', '#006401'];

const paraRgb = (hex) => [
parseInt(hex.slice(1, 3), 16),
parseInt(hex.slice(3, 5), 16),
parseInt(hex.slice(5, 7), 16)];


const CORES_ORIGEM = ESCALA_ORIGEM.map(paraRgb);

/** Nível de vegetação (0 a 1) de um tom original e distância até a escala publicada pelo satélite. */
const medirCor = (r, g, b) => {
  let melhorNivel = 0;
  let menorDistancia = Infinity;

  for (let i = 0; i < CORES_ORIGEM.length - 1; i++) {
    const [r0, g0, b0] = CORES_ORIGEM[i];
    const [r1, g1, b1] = CORES_ORIGEM[i + 1];
    const dr = r1 - r0;
    const dg = g1 - g0;
    const db = b1 - b0;
    const comprimento = dr * dr + dg * dg + db * db || 1;
    const t = Math.min(1, Math.max(0, ((r - r0) * dr + (g - g0) * dg + (b - b0) * db) / comprimento));
    const distancia = (r - (r0 + dr * t)) ** 2 + (g - (g0 + dg * t)) ** 2 + (b - (b0 + db * t)) ** 2;

    if (distancia < menorDistancia) {
      menorDistancia = distancia;
      melhorNivel = (i + t) / (CORES_ORIGEM.length - 1);
    }
  }

  return [melhorNivel, menorDistancia];
};

/** Tons que não pertencem à escala do satélite (sem dado, nuvem, água) ficam como estão. */
const LIMITE_ESCALA = 2500;

/** Tabela de cor pronta (5 bits por canal) usada para trocar os tons sem custo por pixel. */
const TABELA_VEGETACAO = (() => {
  const tabela = { cores: new Uint8ClampedArray(32768 * 3), distancias: new Float32Array(32768) };

  for (let i = 0; i < 32768; i++) {
    const r = Math.round((i >> 10 & 31) * 255 / 31);
    const g = Math.round((i >> 5 & 31) * 255 / 31);
    const b = Math.round((i & 31) * 255 / 31);
    const [nivel, distancia] = medirCor(r, g, b);
    const [nr, ng, nb] = paraRgb(classeDoVigor(nivel).cor);
    tabela.cores[i * 3] = nr;
    tabela.cores[i * 3 + 1] = ng;
    tabela.cores[i * 3 + 2] = nb;
    tabela.distancias[i] = distancia;
  }

  return tabela;
})();

/** Troca os tons originais do satélite pela paleta da vegetação, preservando o nível de cada pixel. */
const recolorir = (ctx) => {
  const { width, height } = ctx.canvas;
  const dados = ctx.getImageData(0, 0, width, height);
  const px = dados.data;
  const { cores, distancias } = TABELA_VEGETACAO;

  for (let i = 0; i < px.length; i += 4) {
    if (!px[i + 3]) continue;
    const indice = (px[i] >> 3 << 10) | (px[i + 1] >> 3 << 5) | px[i + 2] >> 3;
    if (distancias[indice] > LIMITE_ESCALA) continue;
    const j = indice * 3;
    px[i] = cores[j];
    px[i + 1] = cores[j + 1];
    px[i + 2] = cores[j + 2];
  }

  ctx.putImageData(dados, 0, 0);
};

const urlDoTile = (data, zoom, x, y) =>
`${GIBS_BASE}/${data}/${TILE_MATRIX}/${zoom}/${y}/${x}.png`;

// ─── Imagens do satélite (mantidas em memória para não recarregar a cada recorte) ───
const imagens = new Map();

const carregarImagem = (data, zoom, x, y) => {
  const chave = `${data}-${zoom}-${x}-${y}`;
  const existente = imagens.get(chave);
  if (existente) return existente;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = urlDoTile(data, zoom, x, y);
  imagens.set(chave, img);
  return img;
};

/**
 * Carrega desde já as imagens do satélite que cobrem os polígonos no zoom atual.
 * Como a fazenda inteira cabe em poucos tiles, o recorte fica pronto na hora.
 */
export const precarregarImagens = (poligonos, zoom) => {
  const areas = normalizarPoligonos(poligonos);
  if (!areas.length) return;

  const z = Math.round(zoom) || ZOOM_NATIVO;
  const deslocamento = Math.max(0, z - ZOOM_NATIVO);
  const zoomFonte = deslocamento ? ZOOM_NATIVO : z;
  const escala = Math.pow(2, zoomFonte);
  const data = dataReferenciaNdvi();

  const x0 = Math.floor(Math.min(...areas.map((a) => a.limite.x0)) * escala);
  const x1 = Math.floor(Math.max(...areas.map((a) => a.limite.x1)) * escala);
  const y0 = Math.floor(Math.min(...areas.map((a) => a.limite.y0)) * escala);
  const y1 = Math.floor(Math.max(...areas.map((a) => a.limite.y1)) * escala);
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > 64) return;

  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) carregarImagem(data, zoomFonte, x, y);
  }
};

/** Posição da coordenada na imagem do mundo (0 a 1), mesma origem usada pelo Google Maps. */
const mundoX = (lng) => (lng + 180) / 360;
const mundoY = (lat) => {
  const rad = Math.max(-LIMITE_MUNDO, Math.min(LIMITE_MUNDO, lat)) * Math.PI / 180;
  return (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2;
};

/** Converte os polígonos das áreas (coords: [[lat, lng], ...] ou [{lat, lng}]) para a imagem do mundo. */
const normalizarPoligonos = (poligonos) => {
  const lista = [];

  for (const poligono of poligonos || []) {
    const pontos = (poligono || []).
    map((p) => Array.isArray(p) ?
    { lat: Number(p[0]), lng: Number(p[1]) } :
    { lat: Number(p?.lat), lng: Number(p?.lng) }).
    filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)).
    map((p) => [mundoX(p.lng), mundoY(p.lat)]);

    if (pontos.length < 3) continue;

    const xs = pontos.map((p) => p[0]);
    const ys = pontos.map((p) => p[1]);
    lista.push({
      pontos,
      limite: { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) },
      resumo: pontos.reduce((h, p) => (h * 31 + Math.round(p[0] * 1e7) + Math.round(p[1] * 1e7)) % 2147483647, 7)
    });
  }

  return lista;
};

/** Assinatura dos polígonos: muda quando uma área é desenhada, editada ou removida. */
export const assinaturaDosPoligonos = (poligonos) =>
normalizarPoligonos(poligonos).map((p) => `${p.pontos.length}-${p.resumo}`).join('|');

/** Traça as áreas que aparecem no tile e deixa o recorte pronto para o clip. */
const tracarAreas = (ctx, areas, zoom, x, y) => {
  const escala = Math.pow(2, zoom);
  let alguma = false;

  ctx.beginPath();
  for (const area of areas) {
    const { limite } = area;
    if (limite.x1 < x / escala || limite.x0 > (x + 1) / escala || limite.y1 < y / escala || limite.y0 > (y + 1) / escala) continue;

    area.pontos.forEach((p, i) => {
      const px = (p[0] * escala - x) * TAMANHO_TILE;
      const py = (p[1] * escala - y) * TAMANHO_TILE;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.closePath();
    alguma = true;
  }

  return alguma;
};

/**
 * Overlay de vegetação pronto para entrar em map.overlayMapTypes.
 * `poligonos` é a lista de anéis (um por área) que delimita onde a vegetação aparece.
 * `aoAtualizar` é chamado quando uma imagem nova termina de baixar, para o
 * mapa redesenhar os tiles que ainda estavam vazios.
 */
export const criarOverlayNdvi = (poligonos, aoAtualizar) => {
  const data = dataReferenciaNdvi();
  const areas = normalizarPoligonos(poligonos);
  const recortes = new Map(); // 'zoom/x/y' -> pedaço já recortado
  const pendentes = new Set();
  const escutadas = new WeakSet(); // imagens já aguardadas por esta camada
  const canvas = document.createElement('canvas');
  canvas.width = TAMANHO_TILE;
  canvas.height = TAMANHO_TILE;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  let agendado = false;

  const avisar = () => {
    if (agendado || !aoAtualizar) return;
    agendado = true;
    setTimeout(() => {
      agendado = false;
      aoAtualizar();
    }, 120);
  };

  /** Busca a imagem do satélite e avisa quando ela chega, para o tile ser refeito. */
  const prepararImagem = (zoom, x, y) => {
    const img = carregarImagem(data, zoom, x, y);
    if ((!img.complete || !img.naturalWidth) && !escutadas.has(img)) {
      escutadas.add(img);
      img.addEventListener('load', () => {
        if (pendentes.size) {
          pendentes.clear();
          avisar();
        }
      }, { once: true });
    }
    return img;
  };

  /** Desenha o pedaço da imagem de satélite que corresponde ao tile pedido do mapa. */
  const desenharFonte = (zoom, x, y, img, zoomFonte, composto) => {
    const deslocamento = Math.max(0, zoom - zoomFonte);
    const escala = TAMANHO_TILE / Math.pow(2, deslocamento);
    const origemX = (x - ((x >> deslocamento) << deslocamento)) * escala;
    const origemY = (y - ((y >> deslocamento) << deslocamento)) * escala;
    if (composto) ctx.globalCompositeOperation = composto;
    ctx.drawImage(img, origemX, origemY, escala, escala, 0, 0, TAMANHO_TILE, TAMANHO_TILE);
    ctx.globalCompositeOperation = 'source-over';
  };

  /**
   * Desenha o pedaço do satélite do tile, já recortado pelos polígonos das áreas.
   * O dado de cada pixel vem do NDVI e a cor vem da paleta da vegetação, sem
   * mistura: o tom que aparece no mapa é exatamente o tom da legenda.
   */
  const desenharTile = (zoom, x, y, img, zoomFonte) => {
    ctx.clearRect(0, 0, TAMANHO_TILE, TAMANHO_TILE);
    if (!tracarAreas(ctx, areas, zoom, x, y)) return null;

    ctx.save();
    ctx.clip();
    desenharFonte(zoom, x, y, img, zoomFonte);
    ctx.restore();

    recolorir(ctx);
    return canvas.toDataURL('image/png');
  };

  const overlay = new google.maps.ImageMapType({
    name: 'Vegetação (NDVI)',
    minZoom: 3,
    maxZoom: 22,
    tileSize: new google.maps.Size(TAMANHO_TILE, TAMANHO_TILE),
    getTileUrl: (coord, zoom) => {
      if (!areas.length) return TILE_VAZIO;

      const chave = `${zoom}/${coord.x}/${coord.y}`;
      const pronto = recortes.get(chave);
      if (pronto) return pronto;

      const deslocamento = Math.max(0, zoom - ZOOM_NATIVO);
      const zoomFonte = deslocamento ? ZOOM_NATIVO : zoom;
      const img = prepararImagem(zoomFonte, coord.x >> deslocamento, coord.y >> deslocamento);
      if (!img.complete || !img.naturalWidth) {
        pendentes.add(chave);
        return TILE_VAZIO;
      }

      try {
        const recorte = desenharTile(zoom, coord.x, coord.y, img, zoomFonte);
        if (!recorte) return TILE_VAZIO;
        if (recortes.size > LIMITE_RECORTES) recortes.clear();
        recortes.set(chave, recorte);
        return recorte;
      } catch {
        return TILE_VAZIO;
      }
    }
  });

  overlay.setOpacity(1);
  return overlay;
};