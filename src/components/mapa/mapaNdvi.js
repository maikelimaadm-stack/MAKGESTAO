/* global google */
/**
 * Camada de vegetação (NDVI) — imagem pública da NASA GIBS, sem chave de API.
 * Camada apenas visual: não altera dado nem regra de negócio.
 */

const GIBS_BASE = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default';
const TILE_MATRIX = 'GoogleMapsCompatible_Level9';
const ZOOM_NATIVO = 9; // resolução nativa da imagem (~250 m por pixel)
const ANCORA_COMPOSICAO = Date.UTC(2000, 1, 18); // primeira composição de 8 dias do produto
const PASSO_COMPOSICAO = 8 * 24 * 60 * 60 * 1000;
const ATRASO_DIAS = 3; // margem para a composição mais recente já estar publicada

/** Data (AAAA-MM-DD) da composição de 8 dias mostrada na legenda. */
export const dataReferenciaNdvi = () => {
  const alvo = Date.now() - ATRASO_DIAS * 86400000;
  const passos = Math.floor((alvo - ANCORA_COMPOSICAO) / PASSO_COMPOSICAO);
  return new Date(ANCORA_COMPOSICAO + passos * PASSO_COMPOSICAO).toISOString().slice(0, 10);
};

/** Tons da legenda: escuro = menos vegetação, claro = mais vegetação. */
export const NDVI_ESCALA = ['#1e3a13', '#2f6b1c', '#4b9c26', '#7cc242', '#b3e06b'];

/** Realce aplicado somente nas imagens desta camada (não afeta o mapa base). */
export const NDVI_FILTRO = 'sepia(1) hue-rotate(85deg) saturate(2.4) brightness(1.15) contrast(1.45)';

/** Overlay de vegetação pronto para entrar em map.overlayMapTypes. */
export const criarOverlayNdvi = () => {
  const data = dataReferenciaNdvi();

  const overlay = new google.maps.ImageMapType({
    name: 'Vegetação (NDVI)',
    minZoom: 3,
    maxZoom: 22,
    tileSize: new google.maps.Size(256, 256),
    getTileUrl: (coord, zoom) => {
      // A imagem é nativa no zoom 9; acima disso reaproveitamos o tile equivalente.
      const z = Math.min(zoom, ZOOM_NATIVO);
      const deslocamento = zoom - z;
      const x = coord.x >> deslocamento;
      const y = coord.y >> deslocamento;
      return `${GIBS_BASE}/${data}/${TILE_MATRIX}/${z}/${y}/${x}.png`;
    }
  });

  overlay.setOpacity(0.82);
  return overlay;
};