// ============================================================================
// financeiroStatus — cálculo ÚNICO do status de um LancamentoFinanceiro
// ----------------------------------------------------------------------------
// O enum do schema LancamentoFinanceiro.status é:
//   ["Aberto", "Parcial", "Pago", "Recebido", "Cancelado"]
//
// Antes, cada tela calculava o status de um jeito (valores como "Pendente",
// "Pago Parcial"), que NÃO existem no enum — fazia filtros e relatórios
// divergirem. Esta função é a fonte única.
// ============================================================================

/**
 * Calcula o status correto do lançamento após uma baixa/estorno.
 * @param {"Pagar"|"Receber"} tipo        Tipo do lançamento
 * @param {number} valorTotal            Valor total da parcela
 * @param {number} totalPago             Soma já quitada (após a baixa/estorno)
 * @returns {"Aberto"|"Parcial"|"Pago"|"Recebido"}
 */
export function calcularStatusLancamento(tipo, valorTotal, totalPago) {
  const total = Number(valorTotal) || 0;
  const pago = Number(totalPago) || 0;

  if (pago <= 0) return "Aberto";

  const saldo = total - pago;
  if (saldo <= 0.01) {
    return tipo === "Receber" ? "Recebido" : "Pago";
  }
  return "Parcial";
}