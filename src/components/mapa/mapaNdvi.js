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
 */

export const GIBS_BASE = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default';
export const TILE_MATRIX = 'GoogleMapsCompatible_Level9';
export const ZOOM_NATIVO = 9; // resolução nativa da imagem (~250 m por pixel)
const TAMANHO_TILE = 256;
const ANCORA_COMPOSICAO = Date.UTC(2000, 1, 18); // primeira composição de 8 dias do produto
const PASSO_COMPOSICAO = 8 * 24 * 60 * 60 * 1000;
const ATRASO_DIAS = 3; // margem para a composição mais recente já estar publicada
const LIMITE_RECORTES = 1200; // memória dos tiles já recortados
const OPACIDADE_BASE = 0.55; // mantém a imagem do Google visível sob a vegetação
const ALFA_MINIMO = 0.45; // quanto a camada ainda aparece no zoom mais próximo
const QUEDA_POR_ZOOM = 0.08; // a camada fica mais leve conforme o mapa aproxima
const LIMITE_MUNDO = 85.05112878; // limite da projeção de Mercator

/** Imagem vazia (1x1) usada enquanto a foto do satélite ainda está baixando. */
const TILE_VAZIO = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/** Data (AAAA-MM-DD) da composição de 8 dias mostrada na legenda. */
export const dataReferenciaNdvi = () => {
  const alvo = Date.now() - ATRASO_DIAS * 86400000;
  const passos = Math.floor((alvo - ANCORA_COMPOSICAO) / PASSO_COMPOSICAO);
  return new Date(ANCORA_COMPOSICAO + passos * PASSO_COMPOSICAO).toISOString().slice(0, 10);
};

/** Tons originais da imagem do satélite: bege = pouca vegetação, verde escuro = muita vegetação. */
export const NDVI_ESCALA = ['#dfcec1', '#b09b8a', '#bfde77', '#6eaa01', '#006401'];

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

/** A leitura é de 250 m por pixel: no zoom próximo ela não tem detalhe, então a camada fica leve. */
export const alfaPorZoom = (zoom) =>
Math.min(1, Math.max(ALFA_MINIMO, 1 - (zoom - ZOOM_NATIVO) * QUEDA_POR_ZOOM));

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

  /** Desenha o pedaço do satélite do tile, já recortado pelos polígonos das áreas. */
  const desenharTile = (zoom, x, y, img, zoomFonte) => {
    ctx.clearRect(0, 0, TAMANHO_TILE, TAMANHO_TILE);
    if (!tracarAreas(ctx, areas, zoom, x, y)) return null;

    const deslocamento = zoom - zoomFonte;
    const escala = TAMANHO_TILE / Math.pow(2, deslocamento);
    const origemX = (x - ((x >> deslocamento) << deslocamento)) * escala;
    const origemY = (y - ((y >> deslocamento) << deslocamento)) * escala;

    ctx.save();
    ctx.clip();
    ctx.globalAlpha = alfaPorZoom(zoom);
    ctx.drawImage(img, origemX, origemY, escala, escala, 0, 0, TAMANHO_TILE, TAMANHO_TILE);
    ctx.globalAlpha = 1;
    ctx.restore();

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

  overlay.setOpacity(OPACIDADE_BASE);
  return overlay;
};