import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AnimatePresence } from "framer-motion";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { normalizeTaskPriority } from "@/components/mapa/FormularioTarefaMapa";
import FormularioTarefaMapa from "@/components/mapa/FormularioTarefaMapa";
import TabelaLancamentosTarefas from "@/components/tarefas/TabelaLancamentosTarefas";
import { Settings } from "lucide-react";


export default function LancamentosTarefas() {
  const queryClient = useQueryClient();
  const empresaSelecionadaId = localStorage.getItem("empresa_selecionada_id");
  const [deleteIds, setDeleteIds] = useState([]);
  const [showConfigColunas, setShowConfigColunas] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingTarefa, setEditingTarefa] = useState(null);

  const { data: tarefas = [] } = useQuery({
    queryKey: ["gestao-tarefas-unificada", empresaSelecionadaId],
    queryFn: async () => {
      const all = await base44.entities.LancamentoTarefa.list("-updated_date");
      return all.filter((item) => item.empresa_id === empresaSelecionadaId);
    },
    enabled: !!empresaSelecionadaId,
    initialData: []
  });

  const { data: iconesPrioridade = [] } = useQuery({
    queryKey: ["icones-prioridade-gestao-tarefas"],
    queryFn: async () => {
      const all = await base44.entities.ConfiguracaoIcone.list();
      return all.filter((icone) => icone.ativo !== false && icone.tipo_entidade === "Prioridade Tarefa");
    },
    initialData: []
  });

  const grupos = useMemo(() => [...new Set(tarefas.map((item) => item.grupo_atividade_nome).filter(Boolean))].sort(), [tarefas]);

  const getIconePrioridade = (prioridade) => {
    const normalize = (value) => (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    const prioridadeNormalizada = normalize(normalizeTaskPriority(prioridade));
    return iconesPrioridade.find((icone) => normalize(icone.categoria) === prioridadeNormalizada);
  };

  const registrarHistorico = async (registro, evento, descricao) => {
    await base44.entities.HistoricoLancamentoTarefa.create({
      empresa_id: registro.empresa_id || empresaSelecionadaId,
      tarefa_id: registro.id,
      titulo_tarefa: registro.titulo,
      evento,
      data_evento: new Date().toISOString(),
      status: registro.status,
      responsavel: registro.responsavel,
      descricao
    });
  };

  const uploadImages = async (pendingImageFiles = []) => {
    const uploadedUrls = [];
    for (const file of pendingImageFiles) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      uploadedUrls.push(file_url);
    }
    return uploadedUrls;
  };

  const createMutation = useMutation({
    mutationFn: async ({ payload, pendingImageFiles = [] }) => {
      const uploadedUrls = await uploadImages(pendingImageFiles);
      const finalPayload = uploadedUrls.length > 0
        ? { ...payload, fotos: [...(payload.fotos || []), ...uploadedUrls] }
        : payload;
      const created = await base44.entities.LancamentoTarefa.create({ ...finalPayload, empresa_id: empresaSelecionadaId });
      await registrarHistorico(created, "Criação", "Tarefa criada pela gestão de tarefas.");
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gestao-tarefas-unificada"] });
      queryClient.invalidateQueries({ queryKey: ["mapa-tarefas"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas-mapa"] });
      window.dispatchEvent(new CustomEvent("atualizar-mapa"));
      toast.success("Tarefa salva.");
      setShowForm(false);
      setEditingTarefa(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ payload, pendingImageFiles = [] }) => {
      const tarefa = editingTarefa;
      const uploadedUrls = await uploadImages(pendingImageFiles);
      const finalPayload = uploadedUrls.length > 0
        ? { ...payload, fotos: [...(payload.fotos || []), ...uploadedUrls] }
        : payload;
      const updated = await base44.entities.LancamentoTarefa.update(tarefa.id, finalPayload);
      const mudouLocal = payload.coordenadas?.lat !== tarefa?.coordenadas?.lat || payload.coordenadas?.lng !== tarefa?.coordenadas?.lng;
      const mudouStatus = payload.status && payload.status !== tarefa?.status;
      const evento = mudouLocal ? "Mudança de Local" : updated.status === "Concluída" && mudouStatus ? "Conclusão" : updated.status === "Cancelada" && mudouStatus ? "Cancelamento" : mudouStatus ? "Mudança de Status" : "Edição";
      const descricao = mudouLocal ? "Local da tarefa alterado." : updated.status === "Concluída" && mudouStatus ? "Tarefa concluída." : updated.status === "Cancelada" && mudouStatus ? "Tarefa cancelada." : mudouStatus ? `Status alterado para ${updated.status}.` : "Tarefa atualizada.";
      await registrarHistorico(updated, evento, descricao);
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gestao-tarefas-unificada"] });
      queryClient.invalidateQueries({ queryKey: ["mapa-tarefas"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas-mapa"] });
      window.dispatchEvent(new CustomEvent("atualizar-mapa"));
      toast.success("Tarefa atualizada.");
      setShowForm(false);
      setEditingTarefa(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids) => {
      for (const id of ids) await base44.entities.LancamentoTarefa.delete(id);
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["gestao-tarefas-unificada"] });
      queryClient.invalidateQueries({ queryKey: ["mapa-tarefas"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas-mapa"] });
      window.dispatchEvent(new CustomEvent("atualizar-mapa"));
      toast.success(ids.length === 1 ? "Tarefa excluída!" : `${ids.length} tarefas excluídas!`);
      setDeleteIds([]);
    }
  });

  const handleEdit = (tarefa) => {
    setEditingTarefa(tarefa);
    setShowForm(true);
  };

  const handleSubmit = (data, pendingImageFiles = []) => {
    const payload = {
      ...data,
      prioridade: data.prioridade,
      solicitante: data.solicitante || "",
      responsavel: data.responsavel || "",
      responsavel_geral: data.solicitante || "",
      observacoes: data.observacoes || ""
    };
    if (editingTarefa) {
      updateMutation.mutate({ payload, pendingImageFiles });
    } else {
      createMutation.mutate({ payload, pendingImageFiles });
    }
  };

  const handleExport = () => {
    const csv = [
    ["Título", "Status", "Prioridade", "Grupo", "Tipo", "Área", "Responsável", "Prazo"].join(";"),
    ...tarefas.map((t) => [
    t.titulo || "",
    t.status || "",
    normalizeTaskPriority(t.prioridade) || "",
    t.grupo_atividade_nome || "",
    t.tipo_tarefa_nome || t.tipo || "",
    t.area_nome || "",
    t.responsavel || "",
    t.data_prevista || ""].
    join(";"))].
    join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `gestao_tarefas_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    toast.success("Exportado!");
  };

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden p-1 gap-1" style={{ overscrollBehavior: 'none' }}>
      {!showForm && <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 bg-white rounded px-1 py-1 shadow-sm border-b border-slate-200">
        <div>
          <h1 className="font-bold text-slate-900">Gestão de Tarefas</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="icon" onClick={() => setShowConfigColunas(true)} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-7 w-7">
            <Settings className="w-4 h-4" />
          </Button>
          <Button onClick={() => { setEditingTarefa(null); setShowForm(true); }} size="sm" className="bg-lime-900 text-primary-foreground px-3 text-xs font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow h-7 hover:bg-emerald-600">
            Adicionar
          </Button>
        </div>
      </div>}

      <div className="flex-1 min-h-0 overflow-hidden">
        <AnimatePresence mode="wait">
          {showForm ?
          <FormularioTarefaMapa
            key="form"
            tarefa={editingTarefa}
            onSubmit={handleSubmit}
            onCancel={() => { setShowForm(false); setEditingTarefa(null); }} /> :

          <TabelaLancamentosTarefas
            key="table"
            tarefas={tarefas}
            onDelete={(ids) => setDeleteIds(Array.isArray(ids) ? ids : [ids])}
            onEdit={handleEdit}
            normalizeTaskPriority={normalizeTaskPriority}
            showConfigColunas={showConfigColunas}
            setShowConfigColunas={setShowConfigColunas} />
          }
        </AnimatePresence>
      </div>

      <ConfirmDialog
        open={deleteIds.length > 0}
        onOpenChange={(open) => !open && setDeleteIds([])}
        title="Confirmar exclusão"
        description={deleteIds.length > 1 ? `Deseja realmente excluir ${deleteIds.length} tarefas selecionadas?` : "Deseja realmente excluir esta tarefa?"}
        onConfirm={() => deleteMutation.mutate(deleteIds)}
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="destructive" />
      
    </div>);

}