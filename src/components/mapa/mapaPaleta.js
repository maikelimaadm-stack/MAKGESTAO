/**
 * Paleta e utilitários visuais da cartografia do mapa.
 * Camada puramente estética — não altera regra de negócio.
 */

export const MAPA_PALETA = {
  // Áreas
  areaPadrao: '#20bfa9',
  areaSemDados: '#a3b2b8',
  areaBordaForca: 0.08,
  areaPreenchimento: 0.38,
  areaPreenchimentoHover: 0.48,

  // Linhas (traçado em 3 camadas: sombra, contorno, cor)
  linhaPadrao: '#f3be4f',
  linhaSombra: '#182b30',
  linhaContorno: '#e5ede9'
};

const CORES_LINHA_TIPO = [
{ chaves: ['CERCA ELETR', 'ELETRIFIC'], cor: '#f6d35c' },
{ chaves: ['CERCA'], cor: '#f3be4f' },
{ chaves: ['RIO', 'CORREGO', 'RIACHO', 'AGUA', 'NASCENTE'], cor: '#27bcef' },
{ chaves: ['ESTRADA', 'RODOVIA'], cor: '#eef5ed' },
{ chaves: ['CARREADOR', 'TRILHA', 'PICADA'], cor: '#c6c487' },
{ chaves: ['ACEIRO', 'DIVISA', 'LIMITE'], cor: '#ef8475' },
{ chaves: ['TUBO', 'ADUTORA', 'CANO', 'ENCANAMENTO'], cor: '#20cfb9' }];


export const normalizarTipo = (valor) =>
String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();

/** Paleta de exibição por tipo, sem alterar as cores cadastradas. */
export const corDaLinha = (linha) => {
  const tipo = normalizarTipo(`${linha?.tipo || ''} ${linha?.nome || ''}`);
  const encontrada = CORES_LINHA_TIPO.find((item) => item.chaves.some((chave) => tipo.includes(normalizarTipo(chave))));
  const salva = linha?.coordenadas?.cor || linha?.cor;
  return encontrada?.cor || (salva ? suavizarCor(salva) : MAPA_PALETA.linhaPadrao);
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
  const mix = (canal, neutro) => Math.round(canal * 0.85 + neutro * 0.15).toString(16).padStart(2, '0');
  return `#${mix(rgb.r, 32)}${mix(rgb.g, 191)}${mix(rgb.b, 169)}`;
};

/** Escurece uma cor (0 a 1) para gerar a borda das áreas com bom contraste. */
export const escurecer = (cor, fator = MAPA_PALETA.areaBordaForca) => {
  const rgb = paraRgb(cor);
  if (!rgb) return cor;
  const mix = (canal) => Math.round(canal * (1 - fator) + 8 * fator);
  return `rgb(${mix(rgb.r)}, ${mix(rgb.g)}, ${mix(rgb.b)})`;
};