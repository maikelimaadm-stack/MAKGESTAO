import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Download } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatDatePtBr } from "../components/movimentacoes/utils/movimentacaoDisplayUtils";
import { ehPernaTransferencia } from "@/services/estoqueService";

const getNextNumeroLancamento = async (empresaId) => {
  const all = await base44.entities.LancamentoFinanceiro.list();
  const filtered = all.filter((l) => l && l.empresa_id === empresaId);
  return String(filtered.reduce((max, l) => Math.max(max, parseInt(l.numero_lancamento, 10) || 0), 0) + 1);
};

const gerarLancamentoFinanceiroPayload = async (dadosFinanceiro, empresaId) => {
  const parcelas = dadosFinanceiro.parcelas || [];
  const totalParcelas = Math.max(parcelas.length, 1);
  const grupoId = totalParcelas > 1 ? `GRP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : null;
  const valorTotalLancamento = parcelas.reduce((s, p) => s + (p.valor || 0), 0) || dadosFinanceiro.valor_total;
  const numeroBase = parseInt(await getNextNumeroLancamento(empresaId), 10);

  return Array.from({ length: totalParcelas }).map((_, i) => {
    const parcela = parcelas[i] || {};
    const obsParcela = parcela.observacao_parcela ? parcela.observacao_parcela.toUpperCase() : '';

    return {
      empresa_id: dadosFinanceiro.empresa_id,
      numero_lancamento: String(numeroBase + i),
      tipo: dadosFinanceiro.tipo,
      descricao: totalParcelas > 1 ? `${dadosFinanceiro.descricao} - PARCELA ${i + 1}/${totalParcelas}` : dadosFinanceiro.descricao,
      status: 'Aberto',
      valor_total: parcela.valor || dadosFinanceiro.valor_total,
      valor_total_lancamento: valorTotalLancamento,
      valor_pago: 0,
      data_emissao: dadosFinanceiro.data_emissao,
      data_vencimento: parcela.data_vencimento || dadosFinanceiro.data_vencimento,
      data_pagamento: dadosFinanceiro.data_pagamento || undefined,
      fornecedor_id: dadosFinanceiro.fornecedor_id,
      fornecedor_nome: dadosFinanceiro.fornecedor_nome,
      cliente_id: dadosFinanceiro.cliente_id,
      cliente_nome: dadosFinanceiro.cliente_nome,
      tipo_documento_id: dadosFinanceiro.tipo_documento_id,
      tipo_documento_nome: dadosFinanceiro.tipo_documento_nome,
      numero_documento: dadosFinanceiro.numero_documento,
      conta_financeira_id: dadosFinanceiro.conta_financeira_id,
      conta_financeira_nome: dadosFinanceiro.conta_financeira_nome,
      forma_pagamento_id: dadosFinanceiro.forma_pagamento_id,
      forma_pagamento_nome: dadosFinanceiro.forma_pagamento_nome,
      motivo_compra_id: dadosFinanceiro.motivo_compra_id,
      motivo_compra_nome: dadosFinanceiro.motivo_compra_nome,
      parcelamento_grupo_id: grupoId,
      numero_parcela_seq: i + 1,
      total_parcelas_grupo: totalParcelas,
      is_registro_principal: i === 0,
      rateio_grupos: dadosFinanceiro.rateio_grupos,
      rateio_centros_custo: dadosFinanceiro.rateio_centros_custo,
      observacao: dadosFinanceiro.observacao,
      observacao_parcela: obsParcela || undefined,
      anexos_urls: dadosFinanceiro.anexos_urls || []
    };
  });
};
import ConfirmDialog from "@/components/common/ConfirmDialog";

import MovimentacaoEstoqueFormV2 from "../components/movimentacoes/MovimentacaoEstoqueFormV2";
import TabelaMovimentacoes from "../components/movimentacoes/TabelaMovimentacoes";
import ImportarNFeMovimentacao from "../components/movimentacoes/ImportarNFeMovimentacao";
import TransferenciaEmLoteForm from "../components/movimentacoes/TransferenciaEmLoteForm";
import { getLabelOperacao, getLocalEstoque } from "../components/movimentacoes/utils/movimentacaoUtils";

const gerarGrupoId = () => `MOV-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

export default function MovimentacoesEstoque() {
  const [showForm, setShowForm] = useState(false);
  const [editingMovimentacao, setEditingMovimentacao] = useState(null);
  const [showImportXML, setShowImportXML] = useState(false);
  const [showTransferenciaLote, setShowTransferenciaLote] = useState(false);
  const [showConfigColunas, setShowConfigColunas] = useState(false);
  const [showSaveProgress, setShowSaveProgress] = useState(false);
  const [progressoSalvamento, setProgressoSalvamento] = useState({ etapa: '', current: 0, total: 100 });
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState("principais");

  const queryClient = useQueryClient();
  const empresaSelecionadaId = localStorage.getItem('empresa_selecionada_id');

  const { data: movimentacoes = [], isLoading } = useQuery({
    queryKey: ['movimentacoes', empresaSelecionadaId],
    queryFn: async () => {
      const all = await base44.entities.MovimentacaoEstoque.list('-created_date');
      return all.filter((m) => m.empresa_id === empresaSelecionadaId && m.status !== 'Cancelada');
    },
    enabled: !!empresaSelecionadaId
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos', empresaSelecionadaId],
    queryFn: async () => {
      const all = await base44.entities.Produto.list();
      return all.filter((p) => p.empresa_id === empresaSelecionadaId);
    },
    enabled: !!empresaSelecionadaId
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ['fornecedores', empresaSelecionadaId],
    queryFn: async () => {
      const all = await base44.entities.Fornecedor.list();
      return all.filter((f) => f.empresa_id === empresaSelecionadaId);
    },
    enabled: !!empresaSelecionadaId
  });

  const { data: lancamentosFinanceiros = [] } = useQuery({
    queryKey: ['lancamentos_financeiros_movimentacao', empresaSelecionadaId],
    queryFn: async () => {
      const all = await base44.entities.LancamentoFinanceiro.list();
      return all.filter((l) => l.empresa_id === empresaSelecionadaId);
    },
    enabled: !!empresaSelecionadaId
  });

  const { data: baixasFinanceiras = [] } = useQuery({
    queryKey: ['baixas_financeiras_movimentacao', empresaSelecionadaId],
    queryFn: async () => {
      const all = await base44.entities.BaixaFinanceira.list();
      return all.filter((b) => b.empresa_id === empresaSelecionadaId);
    },
    enabled: !!empresaSelecionadaId
  });

  const { data: estoqueLoteNota = [] } = useQuery({
    queryKey: ['estoque_lote_nota_movimentacao', empresaSelecionadaId],
    queryFn: async () => {
      const all = await base44.entities.EstoqueLoteNota.list('-created_date');
      return all.filter((item) => item.empresa_id === empresaSelecionadaId);
    },
    enabled: !!empresaSelecionadaId
  });

  // Classificação: principais = sempre registro principal | movimentações = todos os itens/produtos
  const isPrincipal = (m) => m.is_registro_principal === true;
  const isMovimentacaoItem = (m) => typeof m.numero_movimentacao_seq === 'number' && m.numero_movimentacao_seq >= 1;
  const movPrincipais = useMemo(() => movimentacoes.filter(isPrincipal), [movimentacoes]);
  const movTodas = useMemo(() => movimentacoes.filter(isMovimentacaoItem), [movimentacoes]);

  const handleSubmit = async (formData) => {
    const { tipo_movimentacao, tipo_detalhado, data_movimentacao, local_estoque_origem, local_origem, local_estoque_destino, local_destino, observacoes: obs, dados_financeiro, produtos_selecionados } = formData;
    let lancamentosFinanceirosCriados = [];

    const movimentacoesEditadas = editingMovimentacao?.movimentacao_grupo_id ?
    movimentacoes.filter((m) => m.movimentacao_grupo_id === editingMovimentacao.movimentacao_grupo_id) :
    editingMovimentacao ? [editingMovimentacao] : [];

    const lotesNotaRelacionadosEdicao = editingMovimentacao ?
    estoqueLoteNota.filter((lote) => {
      if (movimentacoesEditadas.some((m) => lote.movimentacao_entrada_id && lote.movimentacao_entrada_id === m.id)) return true;
      if (movimentacoesEditadas.some((m) => m.numero_documento && lote.numero_documento === m.numero_documento && lote.produto_id === m.produto_id && lote.local_estoque_id === (m.local_estoque_destino || m.local_estoque_origem))) return true;
      return false;
    }) :
    [];

    const lancamentoFinanceiroOrigem = movimentacoesEditadas.length > 0 ?
    lancamentosFinanceiros.find((l) => l.id === movimentacoesEditadas[0]?.lancamento_origem_id) :
    null;

    const grupoFinanceiroOrigemId = lancamentoFinanceiroOrigem?.parcelamento_grupo_id || null;
    const lancamentosFinanceirosRelacionados = lancamentoFinanceiroOrigem ?
    lancamentosFinanceiros.filter((l) => grupoFinanceiroOrigemId ? l.parcelamento_grupo_id === grupoFinanceiroOrigemId : l.id === lancamentoFinanceiroOrigem.id) :
    [];

    const possuiBaixaFinanceira = lancamentosFinanceirosRelacionados.some((l) =>
    baixasFinanceiras.some((b) => b.lancamento_id === l.id)
    );

    if (editingMovimentacao?.lancamento_origem_id && possuiBaixaFinanceira) {
      toast.error('Não é possível editar esta movimentação porque o financeiro já teve baixa.');
      return;
    }

    // Guarda: não permite editar uma ENTRADA cujo lote já foi parcialmente consumido
    // por uma saída (a reversão zeraria o lote e perderia o saldo já consumido).
    if (editingMovimentacao) {
      for (const mov of movimentacoesEditadas) {
        if (mov.tipo_movimentacao !== 'Entrada') continue;
        const loteEntrada = estoqueLoteNota.find((lote) => lote.movimentacao_entrada_id === mov.id);
        if (loteEntrada) {
          const consumido = (loteEntrada.quantidade_entrada || 0) - (loteEntrada.quantidade_disponivel || 0);
          if (consumido > 0.0001) {
            toast.error('Não é possível editar: uma das entradas já teve parte do saldo consumida por uma saída. Estorne a saída antes de editar.');
            return;
          }
        }
      }
    }

    setShowSaveProgress(true);
    setProgressoSalvamento({ etapa: 'Preparando...', current: 5, total: 100 });

    // Se editando: excluir registros antigos do grupo e recriar
    if (editingMovimentacao) {
      const registrosAntigos = editingMovimentacao.movimentacao_grupo_id ?
      movimentacoes.filter((m) => m.movimentacao_grupo_id === editingMovimentacao.movimentacao_grupo_id) :
      [editingMovimentacao];

      setProgressoSalvamento({ etapa: 'Revertendo registros antigos...', current: 10, total: 100 });

      for (const mov of registrosAntigos) {
        const prodDbArr = await base44.entities.Produto.filter({ id: mov.produto_id });
        if (prodDbArr.length > 0) {
          const produto = prodDbArr[0];
          let novoEstoque = produto.estoque_atual || 0;
          if (mov.tipo_movimentacao === 'Entrada') novoEstoque -= mov.quantidade;else
          if (mov.tipo_movimentacao === 'Saída') novoEstoque += mov.quantidade;
          await base44.entities.Produto.update(produto.id, { estoque_atual: novoEstoque });
        }

        if (mov.tipo_movimentacao === 'Entrada') {
          const loteEntrada = estoqueLoteNota.find((lote) => lote.movimentacao_entrada_id === mov.id);
          if (loteEntrada?.id) {
            await base44.entities.EstoqueLoteNota.update(loteEntrada.id, {
              quantidade_entrada: 0,
              quantidade_disponivel: 0,
              status: 'Esgotado'
            });
          }
        }

        if (mov.tipo_movimentacao === 'Saída' && Array.isArray(mov.lotes_consumidos)) {
          for (const consumo of mov.lotes_consumidos) {
            if (!consumo?.lote_id || !consumo?.quantidade_consumida) continue;
            const loteConsumido = estoqueLoteNota.find((lote) => lote.id === consumo.lote_id);
            if (!loteConsumido) continue;
            const quantidadeRestaurada = (loteConsumido.quantidade_disponivel || 0) + (consumo.quantidade_consumida || 0);
            await base44.entities.EstoqueLoteNota.update(loteConsumido.id, {
              quantidade_disponivel: quantidadeRestaurada,
              status: quantidadeRestaurada > 0 ? 'Disponivel' : 'Esgotado'
            });
          }
        }

        await base44.entities.MovimentacaoEstoque.delete(mov.id);
      }
    }

    // Gerar número sequencial — busca o maior número real no banco
    const todasMovsRecentes = await base44.entities.MovimentacaoEstoque.list('-created_date', 200);
    const maxNum = todasMovsRecentes.reduce((max, m) => {
      const n = parseInt(m.numero_movimentacao, 10);
      return !isNaN(n) && n > max ? n : max;
    }, 0);
    let seqNum = maxNum;

    if (editingMovimentacao?.lancamento_origem_id && lancamentosFinanceirosRelacionados.length > 0) {
      setProgressoSalvamento({ etapa: 'Atualizando integração financeira...', current: 20, total: 100 });
      for (const lanc of lancamentosFinanceirosRelacionados) {
        await base44.entities.LancamentoFinanceiro.delete(lanc.id);
      }
    }

    if (dados_financeiro) {
      const payloadsFinanceiros = await gerarLancamentoFinanceiroPayload(dados_financeiro, empresaSelecionadaId);
      lancamentosFinanceirosCriados = await Promise.all(
        payloadsFinanceiros.map((payload) => base44.entities.LancamentoFinanceiro.create(payload))
      );
    }

    const fornId = dados_financeiro?.fornecedor_id || formData.fornecedor_id || '';
    const fornNome = dados_financeiro?.fornecedor_nome || formData.fornecedor_nome || '';
    const clienteNome = dados_financeiro?.cliente_nome || formData.cliente_nome || '';
    const tipoDocumentoId = dados_financeiro?.tipo_documento_id || formData.tipo_documento_id || '';
    const tipoDocumentoNome = dados_financeiro?.tipo_documento_nome || formData.tipo_documento || '';
    const numDoc = dados_financeiro?.numero_documento || formData.numero_documento || '';
    const dataDoc = dados_financeiro?.data_emissao || formData.data_documento || '';
    const motivoCompra = formData.motivo_movimentacao || '';

    const user = await base44.auth.me();
    const totalProdutos = produtos_selecionados.length;
    const grupoId = totalProdutos > 1 ? gerarGrupoId() : null;

    for (let idx = 0; idx < totalProdutos; idx++) {
      const item = produtos_selecionados[idx];
      seqNum++;
      const prod = produtos.find((p) => p.id === item.produto_id);
      if (!prod) {toast.error(`Produto ${item.produto_nome} não encontrado`);setShowSaveProgress(false);return;}

      // Fetch fresh product data from DB to get the true stock (especially if we just reverted it)
      const prodDbArr = await base44.entities.Produto.filter({ id: item.produto_id });
      const estoqueAntes = prodDbArr.length > 0 ? prodDbArr[0].estoque_atual || 0 : prod.estoque_atual || 0;
      let estoqueDepois = estoqueAntes;

      const baseMov = {
        empresa_id: empresaSelecionadaId,
        numero_movimentacao: String(seqNum),
        tipo_movimentacao,
        tipo_detalhado,
        tipo_documento: tipoDocumentoNome || undefined,
        tipo_documento_id: tipoDocumentoId || undefined,
        data_movimentacao,
        produto_id: item.produto_id,
        produto_nome: item.produto_nome,
        produto_codigo: prod.codigo_interno || '',
        produto_categoria: prod.categoria || '',
        quantidade: item.quantidade,
        unidade_medida: item.unidade || prod.unidade_medida || '',
        valor_unitario: item.valor_unitario || item.valor_liquido_unitario || 0,
        valor_total: item.valor_total || item.valor_liquido || (item.quantidade || 0) * (item.valor_unitario || item.valor_liquido_unitario || 0),
        fornecedor_id: fornId || undefined,
        fornecedor_nome: fornNome || undefined,
        cliente_nome: clienteNome || undefined,
        numero_documento: numDoc || undefined,
        data_documento: dataDoc || undefined,
        motivo_movimentacao: motivoCompra || undefined,
        observacoes: obs || '',
        responsavel: user?.email || '',
        usuario_responsavel: user?.email || '',
        status: 'Ativa',
        origem_sistema: 'manual',
        movimentacao_grupo_id: grupoId,
        numero_movimentacao_seq: idx + 1,
        total_movimentacoes_grupo: totalProdutos,
        is_registro_principal: idx === 0,
        modo_saida_fifo: item.modo_saida_fifo || null,
        lotes_consumidos: item.lotes_consumidos || null
      };

      // ===== ENTRADA =====
      if (tipo_movimentacao === 'Entrada') {
        estoqueDepois = estoqueAntes + item.quantidade;
        const movimentacaoCriada = await base44.entities.MovimentacaoEstoque.create({
          ...baseMov,
          lancamento_origem_id: lancamentosFinanceirosCriados[0]?.id || undefined,
          local_estoque_destino: local_estoque_destino || '',
          local_destino: local_destino || '',
          saldo_antes: estoqueAntes,
          saldo_depois: estoqueDepois
        });

        const loteExistenteEdicao = editingMovimentacao ?
        lotesNotaRelacionadosEdicao.find((lote) => lote.produto_id === item.produto_id) :
        null;

        const quantidadeJaConsumida = loteExistenteEdicao ?
        Math.max(0, (loteExistenteEdicao.quantidade_entrada || 0) - (loteExistenteEdicao.quantidade_disponivel || 0)) :
        0;

        const payloadLoteNota = {
          empresa_id: empresaSelecionadaId,
          produto_id: item.produto_id,
          produto_nome: item.produto_nome,
          local_estoque_id: local_estoque_destino || '',
          local_estoque_nome: local_destino || '',
          numero_documento: numDoc || '',
          data_documento: dataDoc || data_movimentacao || '',
          fornecedor_id: fornId || '',
          fornecedor_nome: fornNome || '',
          custo_unitario: item.valor_liquido_unitario || item.valor_unitario || 0,
          quantidade_entrada: item.quantidade,
          quantidade_disponivel: Math.max(0, item.quantidade - quantidadeJaConsumida),
          movimentacao_entrada_id: movimentacaoCriada.id,
          status: Math.max(0, item.quantidade - quantidadeJaConsumida) > 0 ? 'Disponivel' : 'Esgotado'
        };

        if (loteExistenteEdicao?.id) {
          await base44.entities.EstoqueLoteNota.update(loteExistenteEdicao.id, payloadLoteNota);
        } else {
          await base44.entities.EstoqueLoteNota.create(payloadLoteNota);
        }

        await base44.entities.Produto.update(prod.id, { estoque_atual: estoqueDepois });
      }

      // ===== SAÍDA =====
      else if (tipo_movimentacao === 'Saída' && tipo_detalhado !== 'transferencia') {
        estoqueDepois = estoqueAntes - item.quantidade;

        let lotesConsumidosSaida = [];

        // Se saída por nota com lotes manuais
        if (item.lotes_consumidos && item.lotes_consumidos.length > 0) {
          for (const lc of item.lotes_consumidos) {
            const lote = await base44.entities.EstoqueLoteNota.filter({ id: lc.lote_id });
            if (lote.length > 0) {
              const novoDisp = Math.max(0, (lote[0].quantidade_disponivel || 0) - lc.quantidade_consumida);
              await base44.entities.EstoqueLoteNota.update(lc.lote_id, {
                quantidade_disponivel: novoDisp,
                status: novoDisp <= 0 ? 'Esgotado' : 'Disponivel'
              });
              lotesConsumidosSaida.push({
                lote_id: lc.lote_id,
                numero_documento: lote[0].numero_documento || '',
                fornecedor_nome: lote[0].fornecedor_nome || '',
                quantidade_consumida: lc.quantidade_consumida,
                custo_unitario: lote[0].custo_unitario || 0
              });
            }
          }
        } else {
          // FIFO automático
          const localId = local_estoque_origem || '';
          let lotesDisponiveis = await base44.entities.EstoqueLoteNota.filter({
            produto_id: item.produto_id,
            status: 'Disponivel',
            ...(localId ? { local_estoque_id: localId } : {})
          });
          lotesDisponiveis.sort((a, b) => new Date(a.data_documento || a.created_date) - new Date(b.data_documento || b.created_date));
          let qtdRestante = item.quantidade;
          for (const lote of lotesDisponiveis) {
            if (qtdRestante <= 0) break;
            const consumir = Math.min(qtdRestante, lote.quantidade_disponivel);
            const novoDisp = lote.quantidade_disponivel - consumir;
            await base44.entities.EstoqueLoteNota.update(lote.id, {
              quantidade_disponivel: novoDisp,
              status: novoDisp <= 0 ? 'Esgotado' : 'Disponivel'
            });
            if (consumir > 0) {
              lotesConsumidosSaida.push({
                lote_id: lote.id,
                numero_documento: lote.numero_documento || '',
                fornecedor_nome: lote.fornecedor_nome || '',
                quantidade_consumida: consumir,
                custo_unitario: lote.custo_unitario || 0
              });
            }
            qtdRestante -= consumir;
          }
        }

        await base44.entities.MovimentacaoEstoque.create({
          ...baseMov,
          lotes_consumidos: lotesConsumidosSaida,
          lancamento_origem_id: lancamentosFinanceirosCriados[0]?.id || undefined,
          local_estoque_origem: local_estoque_origem || '',
          local_origem: local_origem || '',
          saldo_antes: estoqueAntes,
          saldo_depois: estoqueDepois
        });
        await base44.entities.Produto.update(prod.id, { estoque_atual: estoqueDepois });
      }

      // ===== TRANSFERÊNCIA =====
      // Transferência interna NÃO altera o estoque total do produto (Produto.estoque_atual),
      // apenas move saldo de um local para outro. Registramos os lotes consumidos na origem
      // para permitir estorno correto na exclusão.
      else if (tipo_detalhado === 'transferencia') {
        let lotesOrigem = await base44.entities.EstoqueLoteNota.filter({
          produto_id: item.produto_id,
          status: 'Disponivel',
          ...(local_estoque_origem ? { local_estoque_id: local_estoque_origem } : {})
        });
        lotesOrigem.sort((a, b) => new Date(a.data_documento || a.created_date) - new Date(b.data_documento || b.created_date));
        let qtdRest = item.quantidade;
        let custoMedioTransf = item.valor_unitario || 0;
        let totalCusto = 0;
        let totalQtd = 0;
        let lotesConsumidosTransf = [];
        for (const lote of lotesOrigem) {
          if (qtdRest <= 0) break;
          const consumir = Math.min(qtdRest, lote.quantidade_disponivel);
          if (consumir <= 0) continue;
          totalCusto += consumir * (lote.custo_unitario || 0);
          totalQtd += consumir;
          const novoDisp = lote.quantidade_disponivel - consumir;
          await base44.entities.EstoqueLoteNota.update(lote.id, {
            quantidade_disponivel: novoDisp,
            status: novoDisp <= 0 ? 'Esgotado' : 'Disponivel'
          });
          lotesConsumidosTransf.push({
            lote_id: lote.id,
            numero_documento: lote.numero_documento || '',
            fornecedor_nome: lote.fornecedor_nome || '',
            quantidade_consumida: consumir,
            custo_unitario: lote.custo_unitario || 0
          });
          qtdRest -= consumir;
        }
        if (totalQtd > 0) custoMedioTransf = totalCusto / totalQtd;

        const movimentacaoTransferenciaCriada = await base44.entities.MovimentacaoEstoque.create({
          ...baseMov,
          lancamento_origem_id: lancamentosFinanceirosCriados[0]?.id || undefined,
          tipo_movimentacao: 'Saída',
          lotes_consumidos: lotesConsumidosTransf,
          valor_unitario: custoMedioTransf,
          valor_total: item.quantidade * custoMedioTransf,
          local_estoque_origem: local_estoque_origem || '',
          local_origem: local_origem || '',
          local_estoque_destino: local_estoque_destino || '',
          local_destino: local_destino || '',
          saldo_antes: estoqueAntes,
          saldo_depois: estoqueAntes
        });
        const loteTransferenciaExistente = editingMovimentacao ?
        lotesNotaRelacionadosEdicao.find((lote) => lote.produto_id === item.produto_id) :
        null;

        const payloadTransferencia = {
          empresa_id: empresaSelecionadaId,
          produto_id: item.produto_id,
          produto_nome: item.produto_nome,
          local_estoque_id: local_estoque_destino || '',
          local_estoque_nome: local_destino || '',
          numero_documento: numDoc || 'TRANSF',
          data_documento: data_movimentacao || '',
          fornecedor_id: fornId || '',
          fornecedor_nome: fornNome || '',
          custo_unitario: custoMedioTransf,
          quantidade_entrada: item.quantidade,
          quantidade_disponivel: item.quantidade,
          movimentacao_entrada_id: movimentacaoTransferenciaCriada.id,
          status: 'Disponivel'
        };

        if (loteTransferenciaExistente?.id) {
          await base44.entities.EstoqueLoteNota.update(loteTransferenciaExistente.id, payloadTransferencia);
        } else {
          await base44.entities.EstoqueLoteNota.create(payloadTransferencia);
        }
      }

      setProgressoSalvamento({
        etapa: `Produto ${idx + 1} de ${totalProdutos}...`,
        current: 10 + Math.round((idx + 1) / totalProdutos * 85),
        total: 100
      });
    }

    setProgressoSalvamento({ etapa: 'Concluído!', current: 100, total: 100 });
    await new Promise((resolve) => setTimeout(resolve, 400));

    queryClient.invalidateQueries({ queryKey: ['movimentacoes'] });
    queryClient.invalidateQueries({ queryKey: ['produtos'] });
    queryClient.invalidateQueries({ queryKey: ['estoque_lote_nota_movimentacao'] });
    setShowForm(false);
    setEditingMovimentacao(null);
    setShowSaveProgress(false);
    toast.success('Movimentação registrada com sucesso!');
  };

  const handleEdit = (movimentacao) => {
    // Só permite editar pelo registro principal
    let registroPrincipal = movimentacao;
    if (movimentacao.movimentacao_grupo_id && !movimentacao.is_registro_principal) {
      const principal = movimentacoes.find(
        (m) => m.movimentacao_grupo_id === movimentacao.movimentacao_grupo_id && m.is_registro_principal
      );
      if (principal) {
        toast.info('Redirecionando para o registro principal para edição...');
        registroPrincipal = principal;
      }
    }

    const movimentacoesDoGrupo = registroPrincipal.movimentacao_grupo_id ?
    movimentacoes.filter((m) => m.movimentacao_grupo_id === registroPrincipal.movimentacao_grupo_id) :
    [registroPrincipal];

    const lancamentoOrigemId = registroPrincipal.lancamento_origem_id ||
    movimentacoesDoGrupo.find((m) => m.lancamento_origem_id)?.lancamento_origem_id ||
    null;

    const lancamentoFinanceiroOrigem = lancamentoOrigemId ?
    lancamentosFinanceiros.find((l) => l.id === lancamentoOrigemId) :
    null;

    const grupoFinanceiroOrigemId = lancamentoFinanceiroOrigem?.parcelamento_grupo_id || null;
    const lancamentosFinanceirosRelacionados = lancamentoFinanceiroOrigem ?
    lancamentosFinanceiros.filter((l) => grupoFinanceiroOrigemId ? l.parcelamento_grupo_id === grupoFinanceiroOrigemId : l.id === lancamentoFinanceiroOrigem.id) :
    [];

    const possuiBaixaFinanceira = lancamentosFinanceirosRelacionados.some((l) =>
    baixasFinanceiras.some((b) => b.lancamento_id === l.id)
    );

    if (registroPrincipal.lancamento_origem_id && possuiBaixaFinanceira) {
      const lancamentosComBaixa = lancamentosFinanceirosRelacionados.filter((l) =>
      baixasFinanceiras.some((b) => b.lancamento_id === l.id)
      );
      const detalheParcelas = lancamentosComBaixa.
      map((l) => l.total_parcelas_grupo > 1 ? `parcela ${l.numero_parcela_seq}/${l.total_parcelas_grupo}` : 'registro financeiro').
      join(', ');
      toast.error(`Não é possível editar esta movimentação porque o financeiro já teve baixa (${detalheParcelas}).`);
      return;
    }

    const dadosFinanceiroReconstruidos = lancamentoFinanceiroOrigem ?
    {
      ...lancamentoFinanceiroOrigem,
      valor_total: lancamentoFinanceiroOrigem.valor_total_lancamento || lancamentosFinanceirosRelacionados.reduce((sum, l) => sum + (l.valor_total || 0), 0),
      parcelas: lancamentosFinanceirosRelacionados.length > 0 ?
      lancamentosFinanceirosRelacionados.
      sort((a, b) => (a.numero_parcela_seq || 0) - (b.numero_parcela_seq || 0)).
      map((l) => ({
        numero: l.numero_parcela_seq || 1,
        data_vencimento: l.data_vencimento,
        valor: l.valor_total || 0,
        status: l.status || 'Aberto',
        observacao_parcela: l.observacao_parcela || ''
      })) :
      []
    } :
    null;

    // Se faz parte de um grupo, reconstruir os produtos a partir dos registros
    if (registroPrincipal.movimentacao_grupo_id && registroPrincipal.total_movimentacoes_grupo > 1) {
      const todasMovs = movimentacoes.
      filter((m) => m.movimentacao_grupo_id === registroPrincipal.movimentacao_grupo_id).
      sort((a, b) => (a.numero_movimentacao_seq || 0) - (b.numero_movimentacao_seq || 0));

      const produtosReconstruidos = todasMovs.map((m) => ({
        produto_id: m.produto_id,
        produto_nome: m.produto_nome,
        unidade_medida: m.unidade_medida,
        quantidade: m.quantidade,
        valor_unitario: m.valor_unitario,
        valor_total: (m.quantidade || 0) * (m.valor_unitario || 0),
        valor_desconto: 0,
        valor_liquido: m.valor_total,
        valor_liquido_unitario: m.valor_unitario,
        lotes_consumidos: m.lotes_consumidos || null
      }));

      setEditingMovimentacao({
        ...registroPrincipal,
        dados_financeiro_integrado: dadosFinanceiroReconstruidos,
        produtos_para_editar: produtosReconstruidos
      });
    } else {
      // Avulso: apenas 1 produto
      setEditingMovimentacao({
        ...registroPrincipal,
        dados_financeiro_integrado: dadosFinanceiroReconstruidos,
        produtos_para_editar: [{
          produto_id: registroPrincipal.produto_id,
          produto_nome: registroPrincipal.produto_nome,
          unidade_medida: registroPrincipal.unidade_medida,
          quantidade: registroPrincipal.quantidade,
          valor_unitario: registroPrincipal.valor_unitario,
          valor_total: (registroPrincipal.quantidade || 0) * (registroPrincipal.valor_unitario || 0),
          valor_desconto: 0,
          valor_liquido: registroPrincipal.valor_total,
          valor_liquido_unitario: registroPrincipal.valor_unitario,
          lotes_consumidos: registroPrincipal.lotes_consumidos || null
        }]
      });
    }
    setShowForm(true);
  };

  const handleDelete = (id) => setDeleteConfirmId(id);

  const handleConfirmDelete = async () => {
    const mov = movimentacoes.find((m) => m.id === deleteConfirmId);
    if (!mov) return;
    if (!mov.is_registro_principal) {
      toast.error('Somente registros principais podem ser excluídos.');
      return;
    }

    const bloqueado = mov.bloqueado_exclusao_estoque ||
    mov.exclusao_somente_em && mov.exclusao_somente_em !== 'estoque' ||
    ['suplementacao', 'transferencia_enviada', 'transferencia_recebida'].includes(mov.tipo_detalhado);
    if (bloqueado) {
      toast.error('Esse lançamento não pode ser excluído pela tela de estoque.');
      return;
    }

    const registrosParaExcluir = mov.movimentacao_grupo_id ?
    movimentacoes.filter((m) => m.movimentacao_grupo_id === mov.movimentacao_grupo_id) :
    [mov];

    // ===== Vínculo estoque↔financeiro =====
    // Antes de excluir, verificar o lançamento financeiro vinculado:
    //  - se tem baixa, bloquear (não pode excluir estoque de conta já paga);
    //  - se não tem baixa, excluir o financeiro junto (ele foi criado pela movimentação).
    const lancamentoOrigemId = mov.lancamento_origem_id ||
    registrosParaExcluir.find((m) => m.lancamento_origem_id)?.lancamento_origem_id ||
    null;

    let parcelasFinanceirasParaExcluir = [];
    if (lancamentoOrigemId) {
      const lancOrigem = lancamentosFinanceiros.find((l) => l.id === lancamentoOrigemId);
      const grupoFinId = lancOrigem?.parcelamento_grupo_id || null;
      const parcelasRelacionadas = lancOrigem ?
      (grupoFinId ? lancamentosFinanceiros.filter((l) => l.parcelamento_grupo_id === grupoFinId) : [lancOrigem]) :
      [];

      const possuiBaixa = parcelasRelacionadas.some((l) =>
      baixasFinanceiras.some((b) => b.lancamento_id === l.id)
      );
      if (possuiBaixa) {
        toast.error('Não é possível excluir: o financeiro vinculado já teve baixa. Cancele a baixa no financeiro primeiro.');
        setDeleteConfirmId(null);
        return;
      }
      parcelasFinanceirasParaExcluir = parcelasRelacionadas.map((l) => l.id);
    }

    // Estorna os lotes consumidos numa saída/transferência (restaura o saldo disponível)
    const restaurarLotesConsumidos = async (reg) => {
      if (!Array.isArray(reg.lotes_consumidos)) return;
      for (const consumo of reg.lotes_consumidos) {
        if (!consumo?.lote_id || !consumo?.quantidade_consumida) continue;
        const loteArr = await base44.entities.EstoqueLoteNota.filter({ id: consumo.lote_id });
        if (!loteArr?.length) continue;
        const restaurado = (loteArr[0].quantidade_disponivel || 0) + consumo.quantidade_consumida;
        await base44.entities.EstoqueLoteNota.update(consumo.lote_id, {
          quantidade_disponivel: restaurado,
          status: restaurado > 0 ? 'Disponivel' : 'Esgotado',
        });
      }
    };

    // Ajusta Produto.estoque_atual buscando o valor FRESCO do banco (acumula em grupos)
    const ajustarEstoqueAtual = async (produtoId, delta) => {
      const prodArr = await base44.entities.Produto.filter({ id: produtoId });
      if (!prodArr?.length) return;
      const atual = prodArr[0].estoque_atual || 0;
      await base44.entities.Produto.update(produtoId, { estoque_atual: Math.max(0, atual + delta) });
    };

    try {
      for (const reg of registrosParaExcluir) {
        if (ehPernaTransferencia(reg)) {
          // Transferência interna: restaura lotes de origem, remove lote de destino,
          // e NÃO mexe no estoque total (a transferência nunca alterou o total).
          await restaurarLotesConsumidos(reg);
          const lotesDestino = await base44.entities.EstoqueLoteNota.filter({ movimentacao_entrada_id: reg.id });
          for (const ld of lotesDestino) {
            await base44.entities.EstoqueLoteNota.delete(ld.id);
          }
        } else if (reg.tipo_movimentacao === 'Entrada') {
          // Remove o lote de entrada, desde que ainda não tenha sido consumido
          const lotesEntrada = await base44.entities.EstoqueLoteNota.filter({ movimentacao_entrada_id: reg.id });
          for (const le of lotesEntrada) {
            const consumido = (le.quantidade_entrada || 0) - (le.quantidade_disponivel || 0);
            if (consumido > 0.0001) {
              throw new Error('Não é possível excluir: esta entrada já teve parte do saldo consumida por uma saída. Estorne a saída primeiro.');
            }
            await base44.entities.EstoqueLoteNota.delete(le.id);
          }
          await ajustarEstoqueAtual(reg.produto_id, -(reg.quantidade || 0));
        } else if (reg.tipo_movimentacao === 'Saída') {
          await restaurarLotesConsumidos(reg);
          await ajustarEstoqueAtual(reg.produto_id, reg.quantidade || 0);
        }
        await base44.entities.MovimentacaoEstoque.delete(reg.id);
      }

      // Excluir as parcelas financeiras vinculadas (sem baixa) criadas pela movimentação
      for (const idFin of parcelasFinanceirasParaExcluir) {
        await base44.entities.LancamentoFinanceiro.delete(idFin);
      }
    } catch (e) {
      queryClient.invalidateQueries({ queryKey: ['movimentacoes'] });
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.invalidateQueries({ queryKey: ['estoque_lote_nota_movimentacao'] });
      queryClient.invalidateQueries({ queryKey: ['lancamentos_financeiros'] });
      queryClient.invalidateQueries({ queryKey: ['baixas_financeiro'] });
      toast.error(e.message || 'Erro ao excluir.');
      setDeleteConfirmId(null);
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['movimentacoes'] });
    queryClient.invalidateQueries({ queryKey: ['produtos'] });
    queryClient.invalidateQueries({ queryKey: ['estoque_lote_nota_movimentacao'] });
    queryClient.invalidateQueries({ queryKey: ['lancamentos_financeiros'] });
    queryClient.invalidateQueries({ queryKey: ['baixas_financeiro'] });
    toast.success('Registro excluído com sucesso!');
    setDeleteConfirmId(null);
  };

  const handleExportSelected = (ids) => {
    const selecionados = movPrincipais.filter((m) => ids.includes(m.id));
    if (!selecionados.length) return;
    const csvRows = [['Nº', 'Data', 'Tipo', 'Tipo Detalhado', 'Documento', 'Local Origem', 'Local Destino', 'Motivo'].join(';')];
    selecionados.forEach((m) => {
      csvRows.push([
      m.numero_movimentacao,
      formatDatePtBr(m.data_movimentacao),
      (m.tipo_movimentacao || '').toUpperCase(),
      (getLabelOperacao(m.tipo_detalhado) || '').toUpperCase(),
      (m.numero_documento || '').toUpperCase(),
      (m.local_origem || '').toUpperCase(),
      (m.local_destino || '').toUpperCase(),
      (m.motivo_movimentacao || '').toUpperCase()].
      join(';'));
    });
    const blob = new Blob(['\ufeff' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `movimentacoes_principais_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    toast.success('Exportado com sucesso!');
  };

  const handleExport = () => {
    const csvRows = [['Nº', 'Data', 'Tipo', 'Tipo Detalhado', 'Produto', 'Qtd', 'Local Estoque', 'Documento', 'Motivo'].join(';')];
    movimentacoes.forEach((m) => {
      csvRows.push([
      m.numero_movimentacao, format(new Date(m.data_movimentacao), 'dd/MM/yyyy'),
      m.tipo_movimentacao, getLabelOperacao(m.tipo_detalhado), m.produto_nome,
      m.quantidade, getLocalEstoque(m), m.numero_documento || '', m.motivo_movimentacao || ''].
      join(';'));
    });
    const blob = new Blob(['\ufeff' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `movimentacoes_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
    link.click();
    toast.success('Exportado!');
  };

  return (
    <div className="p-1 md:p-1 space-y-1">
      {!showForm && !showTransferenciaLote &&
      <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 bg-white rounded px-1 py-1 shadow-sm border-b border-slate-200">
            <div>
              <h1 className="font-bold text-slate-800">Movimentações de Estoque</h1>
            </div>
            <div className="flex gap-1 flex-wrap">
              <Button variant="outline" size="icon" onClick={() => setShowConfigColunas(true)} className="h-7 w-7 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground">
                <Settings className="w-4 h-4" />
              </Button>
              

            
              <Button onClick={handleExport} variant="outline" size="sm" className="h-7 text-xs">
                Exportar
              </Button>
              <Button onClick={() => {setShowTransferenciaLote(true);setShowForm(false);setEditingMovimentacao(null);}} size="sm" variant="outline" className="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow rounded-md px-3 bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs">
                Transferência Lote
              </Button>
              <Button onClick={() => {setEditingMovimentacao(null);setShowForm(true);setShowTransferenciaLote(false);}} size="sm" className="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow rounded-md px-3 bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs">
                Adicionar
              </Button>
            </div>
          </div>

          <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
            <TabsList className="h-7 bg-slate-50 border">
              <TabsTrigger value="principais" className="text-[11px] h-5 px-2">Principais ({movPrincipais.length})</TabsTrigger>
              <TabsTrigger value="movimentacoes" className="text-[11px] h-5 px-2">Movimentações ({movTodas.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="principais" className="mt-1">
              <TabelaMovimentacoes
              movimentacoes={movPrincipais}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onExportSelected={handleExportSelected}
              isLoading={isLoading}
              showConfigColunas={abaAtiva === 'principais' ? showConfigColunas : false}
              setShowConfigColunas={setShowConfigColunas}
              modoVisualizacao="principais"
              allMovimentacoes={movimentacoes} />
            
            </TabsContent>
            <TabsContent value="movimentacoes" className="mt-1">
              <TabelaMovimentacoes
              movimentacoes={movTodas}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onExportSelected={handleExportSelected}
              isLoading={isLoading}
              showConfigColunas={abaAtiva === 'movimentacoes' ? showConfigColunas : false}
              setShowConfigColunas={setShowConfigColunas}
              modoVisualizacao="movimentacoes"
              allMovimentacoes={movimentacoes} />
            
            </TabsContent>
          </Tabs>
        </>
      }

      <AnimatePresence>
        {showForm &&
        <MovimentacaoEstoqueFormV2
          onSubmit={handleSubmit}
          onCancel={() => {setShowForm(false);setEditingMovimentacao(null);}}
          initialData={editingMovimentacao}
          produtos={produtos}
          fornecedores={fornecedores} />

        }
        {showTransferenciaLote &&
        <TransferenciaEmLoteForm
          onCancel={() => setShowTransferenciaLote(false)}
          produtos={produtos} />

        }
      </AnimatePresence>

      <ImportarNFeMovimentacao
        open={showImportXML}
        onClose={() => setShowImportXML(false)}
        onSuccess={() => {setShowImportXML(false);toast.info('Importação XML em construção.');}}
        produtos={produtos}
        fornecedores={fornecedores} />
      

      <ConfirmDialog
        open={!!deleteConfirmId}
        onOpenChange={() => setDeleteConfirmId(null)}
        title="Confirmar exclusão"
        description="Tem certeza que deseja excluir este registro principal? Se for um grupo, todas as movimentações vinculadas serão excluídas."
        onConfirm={handleConfirmDelete}
        confirmText="Excluir Registro"
        cancelText="Voltar"
        variant="destructive" />
      

      <Dialog open={showSaveProgress} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Salvando...</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-slate-600">{progressoSalvamento.etapa}</p>
            <Progress value={progressoSalvamento.current} className="w-full h-1.5" />
          </div>
        </DialogContent>
      </Dialog>
    </div>);

}