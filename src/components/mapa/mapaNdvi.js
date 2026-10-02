/* global google */
/**
 * Camada de vegetação (NDVI) — imagem pública da NASA GIBS, sem chave de API.
 * Camada apenas visual: não altera dado nem regra de negócio.
 *
 * A imagem é nativa no zoom 9 (~250 m por pixel). Em zoom maior o tile é
 * recortado a partir da imagem original, para que cada área do mapa receba
 * exatamente o pedaço correspondente do satélite (sem repetir imagem).
 */

export const GIBS_BASE = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default';
export const TILE_MATRIX = 'GoogleMapsCompatible_Level9';
export const ZOOM_NATIVO = 9; // resolução nativa da imagem (~250 m por pixel)
const TAMANHO_TILE = 256;
const ANCORA_COMPOSICAO = Date.UTC(2000, 1, 18); // primeira composição de 8 dias do produto
const PASSO_COMPOSICAO = 8 * 24 * 60 * 60 * 1000;
const ATRASO_DIAS = 3; // margem para a composição mais recente já estar publicada
const LIMITE_RECORTES = 1200; // memória dos tiles já recortados
const OPACIDADE_BASE = 0.5; // mantém a imagem do Google visível sob a vegetação
const ALFA_MINIMO = 0.3; // quanto a camada ainda aparece no zoom mais próximo
const QUEDA_POR_ZOOM = 0.1; // a camada fica mais leve conforme o mapa aproxima

/**
 * A leitura é de 250 m por pixel: no zoom próximo ela não tem detalhe nenhum, então
 * a camada vai ficando leve para não cobrir a foto do satélite com uma cor só.
 */
const alfaPorZoom = (zoom) => Math.max(ALFA_MINIMO, 1 - (zoom - ZOOM_NATIVO) * QUEDA_POR_ZOOM);

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

/**
 * Overlay de vegetação pronto para entrar em map.overlayMapTypes.
 * `aoAtualizar` é chamado quando uma imagem nova termina de baixar, para o
 * mapa redesenhar os tiles que ainda estavam vazios.
 */
export const criarOverlayNdvi = (aoAtualizar) => {
  const data = dataReferenciaNdvi();
  const imagens = new Map(); // 'x-y' -> imagem original no zoom nativo
  const recortes = new Map(); // 'zoom/x/y' -> pedaço já recortado
  const pendentes = new Set();
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

  const garantirImagem = (x, y) => {
    const chave = `${x}-${y}`;
    const existente = imagens.get(chave);
    if (existente) return existente;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (recortes.size > LIMITE_RECORTES) recortes.clear();
      if (pendentes.size) {
        pendentes.clear();
        avisar();
      }
    };
    img.onerror = () => imagens.delete(chave);
    img.src = urlDoTile(data, ZOOM_NATIVO, x, y);
    imagens.set(chave, img);
    return img;
  };

  const recortar = (img, zoom, x, y) => {
    const deslocamento = zoom - ZOOM_NATIVO;
    const paiX = x >> deslocamento;
    const paiY = y >> deslocamento;
    const escala = TAMANHO_TILE / Math.pow(2, deslocamento); // pedaço ocupado dentro da imagem original
    const origemX = (x - (paiX << deslocamento)) * escala;
    const origemY = (y - (paiY << deslocamento)) * escala;

    ctx.clearRect(0, 0, TAMANHO_TILE, TAMANHO_TILE);
    ctx.globalAlpha = alfaPorZoom(zoom);
    ctx.drawImage(img, origemX, origemY, escala, escala, 0, 0, TAMANHO_TILE, TAMANHO_TILE);
    ctx.globalAlpha = 1;
    return canvas.toDataURL('image/png');
  };

  const overlay = new google.maps.ImageMapType({
    name: 'Vegetação (NDVI)',
    minZoom: 3,
    maxZoom: 22,
    tileSize: new google.maps.Size(TAMANHO_TILE, TAMANHO_TILE),
    getTileUrl: (coord, zoom) => {
      if (zoom <= ZOOM_NATIVO) return urlDoTile(data, zoom, coord.x, coord.y);

      const chave = `${zoom}/${coord.x}/${coord.y}`;
      const pronto = recortes.get(chave);
      if (pronto) return pronto;

      const deslocamento = zoom - ZOOM_NATIVO;
      const img = garantirImagem(coord.x >> deslocamento, coord.y >> deslocamento);
      if (!img.complete || !img.naturalWidth) {
        pendentes.add(chave);
        return TILE_VAZIO;
      }

      try {
        const recorte = recortar(img, zoom, coord.x, coord.y);
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