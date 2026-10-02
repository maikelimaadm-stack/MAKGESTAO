/**
 * Paleta e utilitários visuais da cartografia do mapa.
 * Camada puramente estética — não altera regra de negócio.
 */

export const MAPA_PALETA = {
  // Áreas
  areaPadrao: '#2f9e6b',
  areaSemDados: '#9aa4b2',
  areaBordaForca: 0.42,
  areaPreenchimento: 0.36,
  areaPreenchimentoHover: 0.52,

  // Linhas (traçado em 3 camadas: sombra, contorno, cor)
  linhaPadrao: '#f59e0b',
  linhaSombra: 'rgba(3, 7, 18, 0.5)',
  linhaContorno: '#ffffff',

  // Rótulos das áreas
  rotuloFundo: 'rgba(9, 14, 25, 0.78)',
  rotuloBorda: 'rgba(255, 255, 255, 0.22)',
  rotuloTexto: '#ffffff',
  rotuloSecundario: 'rgba(226, 232, 240, 0.85)',
  rotuloDestaque: '#fde047'
};

const CORES_LINHA_TIPO = [
{ chaves: ['CERCA ELETR', 'ELETRIFIC'], cor: '#fbbf24' },
{ chaves: ['CERCA'], cor: '#f59e0b' },
{ chaves: ['RIO', 'CORREGO', 'RIACHO', 'AGUA', 'NASCENTE'], cor: '#38bdf8' },
{ chaves: ['ESTRADA', 'RODOVIA'], cor: '#e2e8f0' },
{ chaves: ['CARREADOR', 'TRILHA', 'PICADA'], cor: '#a8a29e' },
{ chaves: ['ACEIRO', 'DIVISA', 'LIMITE'], cor: '#fb7185' },
{ chaves: ['TUBO', 'ADUTORA', 'CANO', 'ENCANAMENTO'], cor: '#22d3ee' }];


export const normalizarTipo = (valor) =>
String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();

/** Cor da linha: respeita a cor salva; senão infere pelo tipo; senão usa o padrão. */
export const corDaLinha = (linha) => {
  const salva = linha?.coordenadas?.cor || linha?.cor;
  if (salva) return salva;
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

/** Escurece uma cor (0 a 1) para gerar a borda das áreas com bom contraste. */
export const escurecer = (cor, fator = MAPA_PALETA.areaBordaForca) => {
  const rgb = paraRgb(cor);
  if (!rgb) return cor;
  const mix = (canal) => Math.round(canal * (1 - fator) + 8 * fator);
  return `rgb(${mix(rgb.r)}, ${mix(rgb.g)}, ${mix(rgb.b)})`;
};