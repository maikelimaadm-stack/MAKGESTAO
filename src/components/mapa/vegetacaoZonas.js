/**
 * Classificação da vegetação lida do satélite (mesma imagem NDVI da camada de
 * vegetação): aponta, dentro de cada área, onde tem mais capim e onde tem pouco
 * capim ou solo exposto, e resume a área em produtiva/intermediária/improdutiva.
 */
import { LIMIAR_CAPIM, amostrarVegetacao, extrairPoligono, hectaresDoPoligono } from './vegetacaoArea';

/** Classes de cada ponto lido no satélite (do mais para o menos capim). */
export const CLASSES_VEGETACAO = [
{ id: 'alto', nome: 'Muito capim', cor: '#166534', minimo: 0.6 },
{ id: 'medio', nome: 'Capim médio', cor: '#84cc16', minimo: LIMIAR_CAPIM },
{ id: 'baixo', nome: 'Pouco capim', cor: '#f59e0b', minimo: 0.2 },
{ id: 'solo', nome: 'Solo exposto', cor: '#b45309', minimo: 0 }];


/** Classes da área inteira, pela parte da área que tem capim. */
export const CLASSES_AREA = [
{ id: 'produtiva', nome: 'Produtiva', plural: 'Produtivas', cor: '#166534', minimo: 60 },
{ id: 'intermediaria', nome: 'Intermediária', plural: 'Intermediárias', cor: '#f59e0b', minimo: 30 },
{ id: 'improdutiva', nome: 'Improdutiva', plural: 'Improdutivas', cor: '#b45309', minimo: 0 }];


export const classeDoVigor = (vigor) =>
CLASSES_VEGETACAO.find((classe) => vigor >= classe.minimo) || CLASSES_VEGETACAO[CLASSES_VEGETACAO.length - 1];

export const classeDaCobertura = (coberturaPct) =>
CLASSES_AREA.find((classe) => coberturaPct >= classe.minimo) || CLASSES_AREA[CLASSES_AREA.length - 1];

const MAX_PONTOS_POR_AREA = 18; // acima disso o mapa fica carregado demais
const MIN_PONTOS_POR_AREA = 3;
const HA_POR_PONTO = 25; // áreas maiores ganham mais pontos
const MAX_PONTOS = 360;

/** Mantém o melhor e o pior ponto da área e espalha o restante pela leitura. */
const espalharLeituras = (leituras, alvo) => {
  if (leituras.length <= alvo) return leituras;

  const melhor = leituras.reduce((a, b) => b.vigor > a.vigor ? b : a);
  const pior = leituras.reduce((a, b) => b.vigor < a.vigor ? b : a);
  const passo = leituras.length / alvo;
  const escolhidas = [];

  for (let i = 0; i < alvo; i++) escolhidas.push(leituras[Math.floor(i * passo)]);
  if (!escolhidas.includes(melhor)) escolhidas.push(melhor);
  if (!escolhidas.includes(pior)) escolhidas.push(pior);

  return escolhidas;
};

/**
 * Lê o satélite dentro do polígono de todas as áreas visíveis e devolve os
 * pontos classificados, o resumo por área e as contagens para a legenda.
 */
export const analisarZonasVegetacao = async (areas) => {
  const comPoligono = (areas || []).
  map((area) => ({ area, anel: extrairPoligono(area) })).
  filter((item) => item.anel.length >= 3);

  const amostras = await Promise.all(
    comPoligono.map((item) => amostrarVegetacao(item.anel).catch(() => null))
  );

  const pontos = [];
  const areasResumo = [];
  const contagemAreas = { produtiva: 0, intermediaria: 0, improdutiva: 0, semLeitura: 0 };
  let data = '';

  comPoligono.forEach(({ area, anel }, indice) => {
    const amostra = amostras[indice];
    if (!amostra) {
      contagemAreas.semLeitura++;
      return;
    }

    data = data || amostra.data;

    const areaHa = hectaresDoPoligono(anel);
    const comCapim = amostra.leituras.filter((leitura) => leitura.vigor >= LIMIAR_CAPIM).length;
    const coberturaPct = amostra.leituras.length ? comCapim / amostra.leituras.length * 100 : 0;
    const classe = classeDaCobertura(coberturaPct);
    contagemAreas[classe.id]++;

    areasResumo.push({
      id: area.id,
      nome: area.nome || '',
      areaHa,
      coberturaPct,
      classeId: classe.id,
      classeNome: classe.nome,
      cor: classe.cor
    });

    const alvo = Math.min(MAX_PONTOS_POR_AREA, Math.max(MIN_PONTOS_POR_AREA, Math.round(areaHa / HA_POR_PONTO)));

    espalharLeituras(amostra.leituras, alvo).forEach((leitura, indicePonto) => {
      const classePonto = classeDoVigor(leitura.vigor);
      pontos.push({
        id: `${area.id}_${indicePonto}`,
        areaId: area.id,
        areaNome: area.nome || '',
        lat: leitura.lat,
        lng: leitura.lng,
        vigor: leitura.vigor,
        classeId: classePonto.id,
        classeNome: classePonto.nome,
        cor: classePonto.cor
      });
    });
  });

  const passo = pontos.length > MAX_PONTOS ? Math.ceil(pontos.length / MAX_PONTOS) : 1;
  const pontosVisiveis = passo > 1 ? pontos.filter((_, i) => i % passo === 0) : pontos;
  const contagemClasse = { alto: 0, medio: 0, baixo: 0, solo: 0 };
  pontosVisiveis.forEach((ponto) => {contagemClasse[ponto.classeId]++;});

  return { data, pontos: pontosVisiveis, areas: areasResumo, contagemClasse, contagemAreas };
};