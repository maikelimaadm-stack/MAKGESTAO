/**
 * Paleta e utilitários visuais da cartografia do mapa.
 * Camada puramente estética — não altera regra de negócio.
 */

export const MAPA_PALETA = {
  // Áreas
  areaPadrao: '#6aaf9b',
  areaSemDados: '#a3b2b8',
  areaBordaForca: 0.18,
  areaPreenchimento: 0.20,
  areaPreenchimentoHover: 0.30,

  // Linhas (traçado em 3 camadas: sombra, contorno, cor)
  linhaPadrao: '#d6bb83',
  linhaSombra: '#182b30',
  linhaContorno: '#e5ede9'
};

const CORES_LINHA_TIPO = [
{ chaves: ['CERCA ELETR', 'ELETRIFIC'], cor: '#dec996' },
{ chaves: ['CERCA'], cor: '#d6bb83' },
{ chaves: ['RIO', 'CORREGO', 'RIACHO', 'AGUA', 'NASCENTE'], cor: '#78b9cd' },
{ chaves: ['ESTRADA', 'RODOVIA'], cor: '#dce3dc' },
{ chaves: ['CARREADOR', 'TRILHA', 'PICADA'], cor: '#b3b4a2' },
{ chaves: ['ACEIRO', 'DIVISA', 'LIMITE'], cor: '#cd9790' },
{ chaves: ['TUBO', 'ADUTORA', 'CANO', 'ENCANAMENTO'], cor: '#80c2bb' }];


export const normalizarTipo = (valor) =>
String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();

/** Cor da linha: respeita a cor salva; senão infere pelo tipo; senão usa o padrão. */
export const corDaLinha = (linha) => {
  const salva = linha?.coordenadas?.cor || linha?.cor;
  if (salva) return suavizarCor(salva);
  const tipo = normalizarTipo(`${linha?.tipo || ''} ${linha?.nome || ''}`);
  const encontrada = CORES_LINHA_TIPO.find((item) => item.chaves.some((chave) => tipo.includes(normalizarTipo(chave))));
  return encontrada?.cor || MAPA_PALETA.linhaPadrao;
};

/** Converte #rgb / #rrggbb em {r,g,b}. Retorna null para formatos não suportados. */
const paraRgb = (hex) => {
  if (typeof hex !== 'string') return null;
  const valor = hex.trim().replace('#', '');
  if (valor.length === 3) {
    return {
      r: parseInt(valor[0] + valor[0], 16),
      g: parseInt(valor[1] + valor[1], 16),
      b: parseInt(valor[2] + valor[2], 16)
    };
  }
  if (valor.length === 6) {
    return {
      r: parseInt(valor.slice(0, 2), 16),
      g: parseInt(valor.slice(2, 4), 16),
      b: parseInt(valor.slice(4, 6), 16)
    };
  }
  return null;
};

/** Suaviza apenas a exibição, preservando a cor cadastrada. */
export const suavizarCor = (cor) => {
  const rgb = paraRgb(cor);
  if (!rgb) return cor;
  const mix = (canal, neutro) => Math.round(canal * 0.78 + neutro * 0.22);
  return `rgb(${mix(rgb.r, 164)}, ${mix(rgb.g, 184)}, ${mix(rgb.b, 179)})`;
};

/** Escurece uma cor (0 a 1) para gerar a borda das áreas com bom contraste. */
export const escurecer = (cor, fator = MAPA_PALETA.areaBordaForca) => {
  const rgb = paraRgb(cor);
  if (!rgb) return cor;
  const mix = (canal) => Math.round(canal * (1 - fator) + 8 * fator);
  return `rgb(${mix(rgb.r)}, ${mix(rgb.g)}, ${mix(rgb.b)})`;
};