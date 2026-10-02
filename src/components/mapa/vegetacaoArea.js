/**
 * Leitura de vegetação de cada área (massa de capim, área produtiva) feita a
 * partir da mesma imagem de satélite (NDVI/MODIS) usada na camada do mapa.
 * A imagem já vem colorida pelo satélite: bege/marrom = solo exposto,
 * verde claro = capim iniciando, verde escuro = capim alto.
 */
import { GIBS_BASE, TILE_MATRIX, ZOOM_NATIVO, dataReferenciaNdvi } from './mapaNdvi';

const TAM = 256;
const INDICE_MIN = 3; // primeiro tom da escala do produto
const INDICE_MAX = 142; // último tom da escala do produto
const INDICE_CAPIM = 63; // a partir deste tom a imagem já é verde (capim ativo)
const MAX_TILES = 16;
const RAIO_TERRA = 156543.03;

let paletaCache = null; // { data, cores }

/** Tom da imagem a partir do qual a área é considerada com capim (verde). */
export const LIMIAR_CAPIM = (INDICE_CAPIM - INDICE_MIN) / (INDICE_MAX - INDICE_MIN);

/** Acima deste tom o satélite lê vegetação fechada (mata), que não é pasto. */
export const LIMIAR_MATA = 0.8;

/** Só é capim o que está na faixa de pasto: nem solo exposto, nem mata. */
export const ehCapim = (vigor) => vigor >= LIMIAR_CAPIM && vigor < LIMIAR_MATA;

/** Massa de capim (kg de matéria seca por hectare) no ponto de melhor vigor. */
export const TETO_PADRAO_KG_HA = 6000;

/** Onde fica guardado o teto de massa ajustado pelo usuário. */
export const CHAVE_TETO_MASSA = 'vegetacao_teto_kg_ha';

export const lerTetoMassaKgHa = () => {
  const salvo = Number(localStorage.getItem(CHAVE_TETO_MASSA));
  return salvo > 0 ? salvo : TETO_PADRAO_KG_HA;
};

/** Converte o vigor do capim (0 a 100%) em massa de forragem (kg MS/ha). */
export const massaKgHaDoVigor = (vigorMedioPct, teto = lerTetoMassaKgHa()) => {
  const limiarPct = LIMIAR_CAPIM * 100;
  const normalizado = Math.max(0, (vigorMedioPct - limiarPct) / (100 - limiarPct));
  return Math.round(teto * normalizado);
};

const urlTile = (data, z, x, y) => `${GIBS_BASE}/${data}/${TILE_MATRIX}/${z}/${y}/${x}.png`;

/** Lê a paleta real da imagem do satélite (mesma paleta em todos os tiles). */
const lerPaleta = (buffer) => {
  const view = new DataView(buffer);
  let pos = 8;
  let cores = null;
  let alpha = null;

  while (pos + 8 <= buffer.byteLength) {
    const tamanho = view.getUint32(pos);
    const tipo = String.fromCharCode(view.getUint8(pos + 4), view.getUint8(pos + 5), view.getUint8(pos + 6), view.getUint8(pos + 7));
    if (tipo === 'PLTE') cores = new Uint8Array(buffer, pos + 8, tamanho);
    if (tipo === 'tRNS') alpha = new Uint8Array(buffer, pos + 8, tamanho);
    if (tipo === 'IDAT') break;
    pos += 12 + tamanho;
  }

  return { cores, alpha };
};

const carregarCores = async (data, tile) => {
  if (paletaCache?.data === data) return paletaCache.cores;

  const resposta = await fetch(urlTile(data, ZOOM_NATIVO, tile.x, tile.y));
  const { cores, alpha } = lerPaleta(await resposta.arrayBuffer());
  if (!cores) throw new Error('Paleta da imagem indisponível');

  const mapa = new Map();
  for (let i = 0; i < cores.length / 3; i++) {
    if (alpha && alpha[i] < 128) continue; // tom sem informação (transparente)
    const vigor = Math.min(1, Math.max(0, (i - INDICE_MIN) / (INDICE_MAX - INDICE_MIN)));
    mapa.set(`${cores[i * 3]},${cores[i * 3 + 1]},${cores[i * 3 + 2]}`, vigor);
  }

  paletaCache = { data, cores: mapa };
  return mapa;
};

// Imagens do satélite ficam guardadas: a mesma foto serve para várias áreas.
const imagens = new Map();

const carregarImagem = (url) => {
  const existente = imagens.get(url);
  if (existente) return existente;

  const promessa = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      imagens.delete(url);
      reject(new Error('Não foi possível baixar a imagem do satélite'));
    };
    img.src = url;
  });

  imagens.set(url, promessa);
  return promessa;
};

export const extrairPoligono = (area) => {
  const coords = area?.coordenadas?.coords || [];
  return coords.
  map((c) => Array.isArray(c) ? { lat: Number(c[0]), lng: Number(c[1]) } : { lat: Number(c.lat), lng: Number(c.lng) }).
  filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
};

/** Índice do tile (zoom nativo) que contém o ponto. */
const tileDoPonto = (lat, lng) => {
  const n = Math.pow(2, ZOOM_NATIVO);
  const rad = lat * Math.PI / 180;
  return {
    x: Math.floor((lng + 180) / 360 * n),
    y: Math.floor((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * n)
  };
};

const lngDoPixel = (x, px) => (x + (px + 0.5) / TAM) / Math.pow(2, ZOOM_NATIVO) * 360 - 180;
const latDoPixel = (y, py) => {
  const n = Math.PI - 2 * Math.PI * (y + (py + 0.5) / TAM) / Math.pow(2, ZOOM_NATIVO);
  return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};

const dentroPoligono = (lng, lat, pontos) => {
  let dentro = false;
  for (let i = 0, j = pontos.length - 1; i < pontos.length; j = i++) {
    const a = pontos[i],b = pontos[j];
    if (b.lat > lat !== a.lat > lat && lng < (b.lng - a.lng) * (lat - a.lat) / (b.lat - a.lat) + a.lng) dentro = !dentro;
  }
  return dentro;
};

/** Área do polígono em hectares. */
export const hectaresDoPoligono = (pontos) => {
  const latMedia = pontos.reduce((s, p) => s + p.lat, 0) / pontos.length;
  const metroLat = 110540;
  const metroLng = 111320 * Math.cos(latMedia * Math.PI / 180);
  let soma = 0;
  for (let i = 0; i < pontos.length; i++) {
    const a = pontos[i],b = pontos[(i + 1) % pontos.length];
    soma += a.lng * metroLng * (b.lat * metroLat) - b.lng * metroLng * (a.lat * metroLat);
  }
  return Math.abs(soma / 2) / 10000;
};

/**
 * Lê ponto a ponto a vegetação dentro do polígono (mesma grade usada na medição).
 * Retorna as leituras com o vigor (0 a 1) e quantos pontos da grade caíram dentro.
 * Retorna null quando o polígono é extenso demais para a leitura.
 */
export const amostrarVegetacao = async (pontos) => {
  if (!pontos || pontos.length < 3) return null;

  const data = dataReferenciaNdvi();
  let x0 = Infinity,x1 = -Infinity,y0 = Infinity,y1 = -Infinity;
  for (const p of pontos) {
    const t = tileDoPonto(p.lat, p.lng);
    x0 = Math.min(x0, t.x);x1 = Math.max(x1, t.x);
    y0 = Math.min(y0, t.y);y1 = Math.max(y1, t.y);
  }

  const tiles = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) tiles.push({ x, y });
  if (!tiles.length || tiles.length > MAX_TILES) return null;

  const cores = await carregarCores(data, tiles[0]);
  const canvas = document.createElement('canvas');
  canvas.width = TAM;
  canvas.height = TAM;
  const ctx = canvas.getContext('2d');
  const passo = tiles.length > 4 ? 2 : 1;

  const leituras = [];
  let dentro = 0;

  for (const tile of tiles) {
    const img = await carregarImagem(urlTile(data, ZOOM_NATIVO, tile.x, tile.y));
    ctx.clearRect(0, 0, TAM, TAM);
    ctx.drawImage(img, 0, 0, TAM, TAM);
    const { data: px } = ctx.getImageData(0, 0, TAM, TAM);

    for (let py = 0; py < TAM; py += passo) {
      const lat = latDoPixel(tile.y, py);
      for (let pxi = 0; pxi < TAM; pxi += passo) {
        const lng = lngDoPixel(tile.x, pxi);
        if (!dentroPoligono(lng, lat, pontos)) continue;
        dentro++;

        const off = (py * TAM + pxi) * 4;
        if (px[off + 3] < 128) continue; // sem informação do satélite neste ponto
        const vigor = cores.get(`${px[off]},${px[off + 1]},${px[off + 2]}`);
        if (vigor === undefined) continue;

        leituras.push({ lat, lng, vigor });
      }
    }
  }

  return { data, leituras, dentro };
};

const somarVigor = (leituras) => leituras.reduce((soma, leitura) => soma + leitura.vigor, 0);

/**
 * Mede a vegetação dentro do polígono da área.
 * Retorna null quando a área não tem polígono ou é extensa demais para a leitura.
 */
export const medirVegetacaoArea = async (area) => {
  const pontos = extrairPoligono(area);
  if (pontos.length < 3) return null;

  const amostra = await amostrarVegetacao(pontos);
  if (!amostra) return null;

  const { data, leituras, dentro } = amostra;
  const ativas = leituras.filter((leitura) => ehCapim(leitura.vigor));
  const mata = leituras.filter((leitura) => leitura.vigor >= LIMIAR_MATA);
  const latMedia = pontos.reduce((s, p) => s + p.lat, 0) / pontos.length;
  const areaHa = hectaresDoPoligono(pontos);
  const cobertura = leituras.length ? ativas.length / leituras.length : 0;

  return {
    data,
    areaHa,
    leituras: leituras.length,
    semLeitura: dentro - leituras.length,
    coberturaPct: cobertura * 100,
    mataPct: leituras.length ? mata.length / leituras.length * 100 : 0,
    produtivaHa: areaHa * cobertura,
    vigorMedioPct: leituras.length ? somarVigor(leituras) / leituras.length * 100 : 0,
    vigorMedioAtivoPct: ativas.length ? somarVigor(ativas) / ativas.length * 100 : 0,
    resolucaoM: RAIO_TERRA * Math.cos(latMedia * Math.PI / 180) / Math.pow(2, ZOOM_NATIVO)
  };
};