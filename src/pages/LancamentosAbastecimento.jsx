import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { Progress } from "@/components/ui/progress";
import FormularioLancamentoAbastecimento from "@/components/maquinas/FormularioLancamentoAbastecimento";
import TabelaLancamentosAbastecimento from "@/components/maquinas/TabelaLancamentosAbastecimento";

export default function LancamentosAbastecimento() {
  const empresaSelecionadaId = localStorage.getItem("empresa_selecionada_id");
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showConfigColunas, setShowConfigColunas] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selecionados, setSelecionados] = useState([]);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState({ current: 0, total: 0 });

  const { data: maquinas = [] } = useQuery({
    queryKey: ["maquinas", empresaSelecionadaId],
    queryFn: async () => {
      const all = await base44.entities.Maquina.list();
      return all.filter((m) => m.empresa_id === empresaSelecionadaId);
    },
    enabled: !!empresaSelecionadaId
  });

  const handleExport = () => {
    if (abastecimentos.length === 0) {
      toast.error("Não há dados para exportar");
      return;
    }

    // Filtramos apenas os visíveis se houver selecionados, mas aqui exportaremos tudo ou selecionados
    const paraExportar = selecionados.length > 0 ?
    abastecimentos.filter((a) => selecionados.includes(a.id)) :
    abastecimentos;

    const csvRows = [
    ['Data', 'Ativo', 'Categoria', 'Tipo Medição', 'Grupo Atividade', 'Tipo Serviço', 'Responsável', 'Local Estoque', 'Produto', 'Litros', 'Valor Unitário', 'Valor Total', 'Medição', 'Med. Anterior', 'Uso', 'Consumo', 'Observações'].join(';')];


    paraExportar.forEach((m) => {
      csvRows.push([
      m.data_abastecimento,
      m.maquina_nome || '',
      m.maquina_categoria || '',
      m.maquina_tipo_medicao || '',
      m.grupo_atividade_nome || '',
      m.tipo_servico || '',
      m.responsavel || '',
      m.local_estoque_nome || '',
      m.produto_nome || '',
      m.quantidade_litros || '',
      m.valor_litro || '',
      m.valor_total || '',
      m.medicao || '',
      m.medicao_anterior || '',
      m.uso_realizado || '',
      m.consumo_calculado || '',
      (m.observacoes || '').replace(/;/g, ',')].
      join(';'));
    });

    const blob = new Blob(['\ufeff' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `abastecimentos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success("Exportado com sucesso!");
  };

  const { data: abastecimentos = [] } = useQuery({
    queryKey: ["abastecimentos", empresaSelecionadaId, maquinas.length],
    queryFn: async () => {
      const all = await base44.entities.AbastecimentoMaquina.list();
      const filtrados = all.filter((item) => item.empresa_id === empresaSelecionadaId);

      // Enriquecer dados com informações da máquina
      const enriquecidos = filtrados.map((abast) => {
        const maquina = maquinas.find((m) => m.id === abast.maquina_id);
        return {
          ...abast,
          maquina_categoria: maquina?.categoria || "-",
          maquina_identificador: maquina?.identificador_curto || "-",
          maquina_tipo_medicao: maquina?.tipo_medicao || "Nenhum"
        };
      });

      return enriquecidos.sort((a, b) => new Date(b.data_abastecimento) - new Date(a.data_abastecimento));
    },
    enabled: !!empresaSelecionadaId && maquinas.length >= 0
  });

  const deleteMutation = useMutation({
    mutationFn: async (item) => {
      const movimentacoesPorReferencia = item.referencia_movimentacao ?
      await base44.entities.MovimentacaoEstoque.filter({ referencia_movimentacao: item.referencia_movimentacao }) :
      [];

      const movimentacoesPorObservacao = await base44.entities.MovimentacaoEstoque.list();
      const movimentacoes = [...movimentacoesPorReferencia];

      movimentacoesPorObservacao.
      filter((mov) => mov.observacoes === `Saída automática por abastecimento ${item.id}`).
      forEach((mov) => {
        if (!movimentacoes.find((existente) => existente.id === mov.id)) {
          movimentacoes.push(mov);
        }
      });

      for (const mov of movimentacoes) {
        for (const lote of mov.lotes_consumidos || []) {
          const loteAtual = await base44.entities.EstoqueLoteNota.get(lote.lote_id);
          await base44.entities.EstoqueLoteNota.update(lote.lote_id, {
            quantidade_disponivel: (loteAtual.quantidade_disponivel || 0) + (lote.quantidade_consumida || 0),
            status: "Disponivel"
          });
        }
        await base44.entities.MovimentacaoEstoque.delete(mov.id);
      }

      if (item.maquina_id && item.medicao != null) {
        const historico = abastecimentos.filter((a) => a.maquina_id === item.maquina_id && a.id !== item.id && a.medicao != null).sort((a, b) => new Date(b.data_abastecimento) - new Date(a.data_abastecimento));
        const medicaoAnterior = historico[0]?.medicao;
        await base44.entities.Maquina.update(item.maquina_id, { medicao_atual: medicaoAnterior ?? 0 });
      }

      await base44.entities.AbastecimentoMaquina.delete(item.id);
    },
    onSuccess: () => {
      toast.success("Abastecimento excluído e estoque revertido");
      queryClient.invalidateQueries({ queryKey: ["abastecimentos"] });
      queryClient.invalidateQueries({ queryKey: ["maquinas-abastecimento"] });
    },
    onError: (error) => toast.error(error.message)
  });

  return (
    <div className="p-1 md:p-1 space-y-1">
      {!showForm && <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 bg-white rounded px-1 py-1 shadow-sm border-b border-slate-200">
        <div>
          <h1 className="font-bold text-slate-800">Lançamento de Abastecimento</h1>
        </div>
        <div className="flex gap-1 flex-wrap">
          <Button variant="outline" size="icon" onClick={() => setShowConfigColunas(true)} className="h-7 w-7 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground">
            <Settings className="w-4 h-4" />
          </Button>
          

          
          <Button onClick={() => {setEditingItem(null);setShowForm(true);}} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs">
            Adicionar
          </Button>
        </div>
      </div>}

      <AnimatePresence mode="wait">
        {showForm ?
        <FormularioLancamentoAbastecimento
          abastecimento={editingItem}
          onSave={() => {
            setShowForm(false);
            setEditingItem(null);
            queryClient.invalidateQueries({ queryKey: ["abastecimentos"] });
            queryClient.invalidateQueries({ queryKey: ["maquinas-abastecimento"] });
            queryClient.invalidateQueries({ queryKey: ["lotes-estoque-abastecimento"] });
            queryClient.invalidateQueries({ queryKey: ["movimento-abastecimento"] });
            queryClient.invalidateQueries({ queryKey: ["movimentacoes-estoque"] });
          }}
          onCancel={() => {setShowForm(false);setEditingItem(null);}} /> :


        <motion.div key="table" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-1">
            {isDeletingBulk &&
          <Card className="rounded-xl border bg-card text-card-foreground shadow">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-slate-700"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Excluindo abastecimentos selecionados...</div>
                  <Progress value={deleteProgress.total ? deleteProgress.current / deleteProgress.total * 100 : 0} />
                </CardContent>
              </Card>
          }
            <TabelaLancamentosAbastecimento
            abastecimentos={abastecimentos}
            selecionados={selecionados}
            onSelecionadosChange={setSelecionados}
            onEdit={(item) => {setEditingItem(item);setShowForm(true);}}
            onDelete={(item) => setDeleteConfirmItem(item)}
            showConfigColunas={showConfigColunas}
            setShowConfigColunas={setShowConfigColunas} />
          
          </motion.div>
        }
      </AnimatePresence>

      <ConfirmDialog open={!!deleteConfirmItem} onOpenChange={() => setDeleteConfirmItem(null)} title="Confirmar exclusão" description="Ao excluir, o estoque será revertido e a medição do ativo será ajustada para o valor anterior disponível." onConfirm={() => {deleteMutation.mutate(deleteConfirmItem);setDeleteConfirmItem(null);}} confirmText="Excluir" cancelText="Cancelar" variant="destructive" />
    </div>);

}