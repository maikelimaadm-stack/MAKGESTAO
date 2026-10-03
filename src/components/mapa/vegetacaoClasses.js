/**
 * Classes da vegetação lida do satélite — uma só escala de cores, usada pelo
 * mapa, pela legenda e pelos resumos, para todo o sistema dar a mesma leitura.
 *
 * A imagem do NDVI já vem colorida pelo satélite: bege/marrom = solo exposto e
 * pouco capim, verde = capim, verde muito escuro = mata (vegetação fechada).
 */

export const INDICE_MIN = 3; // primeiro tom da escala do produto
export const INDICE_MAX = 142; // último tom da escala do produto
export const INDICE_CAPIM = 63; // a partir deste tom a imagem já é verde (capim ativo)

/** Tom da imagem a partir do qual a área é considerada com capim (verde). */
export const LIMIAR_CAPIM = (INDICE_CAPIM - INDICE_MIN) / (INDICE_MAX - INDICE_MIN);

/** Acima deste tom o satélite lê vegetação fechada (mata), que não é pasto. */
export const LIMIAR_MATA = 0.8;

/** Classes de cada ponto lido no satélite (do mais para o menos capim). */
export const CLASSES_VEGETACAO = [
{ id: 'mata', nome: 'Mata', cor: '#0f766e', minimo: LIMIAR_MATA },
{ id: 'alto', nome: 'Muito capim', cor: '#52b788', minimo: 0.6 },
{ id: 'medio', nome: 'Capim médio', cor: '#99d98c', minimo: LIMIAR_CAPIM },
{ id: 'baixo', nome: 'Pouco capim', cor: '#f59e0b', minimo: 0.2 },
{ id: 'solo', nome: 'Solo exposto', cor: '#b45309', minimo: 0 }];


/** Classe da leitura de vegetação (0 a 1). */
export const classeDoVigor = (vigor) =>
CLASSES_VEGETACAO.find((classe) => vigor >= classe.minimo) || CLASSES_VEGETACAO[CLASSES_VEGETACAO.length - 1];