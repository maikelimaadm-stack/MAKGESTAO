/**
 * Classificação da vegetação lida do satélite (mesma imagem NDVI da camada de
 * vegetação): aponta, dentro de cada área, onde tem mais capim e onde tem pouco
 * capim, onde é só mata e onde é solo exposto, e resume a área pela massa de
 * forragem (kg MS/ha) — a mata não entra na conta de capim.
 */
import { ehCapim, massaKgHaDoVigor, amostrarVegetacao, extrairPoligono, hectaresDoPoligono } from './vegetacaoArea';
// Classes, limiares e cores da vegetação vêm de um só lugar e daqui seguem para as legendas.
import { LIMIAR_MATA, CLASSES_VEGETACAO, classeDoVigor } from './vegetacaoClasses';
export { CLASSES_VEGETACAO, classeDoVigor };


/** Faixa de massa de forragem considerada ideal para pastejo (kg MS/ha). */
export const MASSA_IDEAL_KG_HA = { minimo: 1500, maximo: 2500 };

/** Área em que o que predomina é mata: não é pasto, então não conta como capim. */
export const CLASSE_MATA = { id: 'mata', nome: 'Área de mata', plural: 'Áreas de mata', cor: '#0f766e', minimo: 0 };

/** Classes da área inteira, pela massa de forragem (kg MS/ha) estimada nela. */
export const CLASSES_AREA = [
{ id: 'excesso', nome: 'Excesso de massa', plural: 'Com excesso', cor: '#0e7490', minimo: MASSA_IDEAL_KG_HA.maximo },
{ id: 'ideal', nome: 'Na faixa ideal', plural: 'Na faixa ideal', cor: '#166534', minimo: MASSA_IDEAL_KG_HA.minimo },
{ id: 'baixa', nome: 'Abaixo da meta', plural: 'Abaixo da meta', cor: '#f59e0b', minimo: 1000 },
{ id: 'sobrepastejada', nome: 'Sobrepastejada', plural: 'Sobrepastejadas', cor: '#b45309', minimo: 0 },
CLASSE_MATA];


/** Classe da área pela massa de forragem média lida (kg MS/ha). */
export const classeDaMassa = (massaKgHa) =>
CLASSES_AREA.find((classe) => massaKgHa >= classe.minimo) || CLASSES_AREA[CLASSES_AREA.length - 1];

const MAX_PONTOS_POR_AREA = 60; // acima disso o mapa fica carregado demais
const MIN_PONTOS_POR_AREA = 6;
const HA_POR_PONTO = 4; // áreas maiores ganham mais pontos
const MAX_PONTOS = 400;

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
  const contagemAreas = { excesso: 0, ideal: 0, baixa: 0, sobrepastejada: 0, mata: 0, semLeitura: 0 };
  let data = '';

  comPoligono.forEach(({ area, anel }, indice) => {
    const amostra = amostras[indice];
    if (!amostra) {
      contagemAreas.semLeitura++;
      return;
    }

    data = data || amostra.data;

    const areaHa = hectaresDoPoligono(anel);
    const leituras = amostra.leituras;
    const capim = leituras.filter((leitura) => ehCapim(leitura.vigor));
    const mata = leituras.filter((leitura) => leitura.vigor >= LIMIAR_MATA);
    const coberturaPct = leituras.length ? capim.length / leituras.length * 100 : 0;
    const mataPct = leituras.length ? mata.length / leituras.length * 100 : 0;
    const vigorMedioPct = capim.length ? capim.reduce((soma, leitura) => soma + leitura.vigor, 0) / capim.length * 100 : 0;
    const massaKgHa = massaKgHaDoVigor(vigorMedioPct);
    const classe = mataPct >= 50 ? CLASSE_MATA : classeDaMassa(massaKgHa);
    contagemAreas[classe.id]++;

    areasResumo.push({
      id: area.id,
      nome: area.nome || '',
      areaHa,
      coberturaPct,
      mataPct,
      vigorMedioPct,
      massaKgHa,
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
  const contagemClasse = { mata: 0, alto: 0, medio: 0, baixo: 0, solo: 0 };
  pontosVisiveis.forEach((ponto) => {contagemClasse[ponto.classeId]++;});

  return { data, pontos: pontosVisiveis, areas: areasResumo, contagemClasse, contagemAreas };
};