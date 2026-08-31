import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import TabelaSetores from "@/components/setores/TabelaSetores";
import FormularioSetor from "@/components/setores/FormularioSetor";
import { ensureDeleteAllowed } from "@/lib/entityDeleteGuards";
import { AnimatePresence } from "framer-motion";

const getInitialFormData = () => ({
  nome: "",
  sigla: "",
  tipo: "Próprio",
  responsavel: "",
  telefone: "",
  endereco: "",
  cidade: "",
  estado: "",
  area_total: "",
  capacidade_animais: "",
  observacoes: "",
  ativo: true
});

export default function CadastroSetores() {
  const empresaSelecionadaId = localStorage.getItem("empresa_selecionada_id");
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showConfigColunas, setShowConfigColunas] = useState(false);
  const [editando, setEditando] = useState(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deletarId, setDeletarId] = useState(null);

  const { data: setores = [], isLoading, refetch } = useQuery({
    queryKey: ["setores", empresaSelecionadaId],
    queryFn: async () => {
      const all = await base44.entities.Setor.list();
      return all.filter((s) => s.empresa_id === empresaSelecionadaId);
    },
    enabled: !!empresaSelecionadaId
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const allSetores = await base44.entities.Setor.list();
      const maxNum = allSetores.reduce((max, s) => Math.max(max, parseInt(s.numero_setor) || 0), 0);

      return base44.entities.Setor.create({
        ...data,
        empresa_id: empresaSelecionadaId,
        numero_setor: String(maxNum + 1),
        nome: data.nome?.toUpperCase(),
        sigla: data.sigla?.toUpperCase() || null,
        responsavel: data.responsavel?.toUpperCase() || null,
        endereco: data.endereco?.toUpperCase() || null,
        cidade: data.cidade?.toUpperCase() || null,
        observacoes: data.observacoes?.toUpperCase() || null,
        area_total: data.area_total ? parseFloat(data.area_total) : null,
        capacidade_animais: data.capacidade_animais ? parseInt(data.capacidade_animais) : null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["setores", empresaSelecionadaId] });
      toast.success("Setor cadastrado com sucesso!");
      setShowForm(false);
      setEditando(null);
    },
    onError: () => toast.error("Erro ao cadastrar setor")
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, oldData }) => {
      const updated = await base44.entities.Setor.update(id, {
        ...data,
        nome: data.nome?.toUpperCase(),
        sigla: data.sigla?.toUpperCase() || null,
        responsavel: data.responsavel?.toUpperCase() || null,
        endereco: data.endereco?.toUpperCase() || null,
        cidade: data.cidade?.toUpperCase() || null,
        observacoes: data.observacoes?.toUpperCase() || null,
        area_total: data.area_total ? parseFloat(data.area_total) : null,
        capacidade_animais: data.capacidade_animais ? parseInt(data.capacidade_animais) : null
      });

      if ((oldData?.nome || "") !== (updated?.nome || "")) {
        await base44.functions.invoke("syncEntityReferences", {
          event: { type: "update", entity_name: "Setor" },
          data: updated,
          old_data: oldData,
          changed_fields: ["nome"]
        });
      }

      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["setores", empresaSelecionadaId] });
      toast.success("Setor atualizado!");
      setShowForm(false);
      setEditando(null);
    },
    onError: () => toast.error("Erro ao atualizar setor")
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await ensureDeleteAllowed(base44, "Setor", id);
      return base44.entities.Setor.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["setores", empresaSelecionadaId] });
      toast.success("Setor excluído!");
      setShowDelete(false);
      setDeletarId(null);
    },
    onError: (error) => {
      if (String(error?.message || "").toLowerCase().includes("não é possível excluir")) return;
      toast.error(error?.message || "Erro ao excluir setor");
    }
  });

  const handleEdit = (setor) => {
    setEditando({
      ...getInitialFormData(),
      ...setor,
      area_total: setor.area_total || "",
      capacidade_animais: setor.capacidade_animais || ""
    });
    setShowForm(true);
  };

  const handleSubmit = (data) => {
    if (editando) {
      updateMutation.mutate({ id: editando.id, data, oldData: editando });
      return;
    }
    createMutation.mutate(data);
  };

  return (
    <div className="p-1 md:p-1 space-y-1">
      {!showForm && <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 bg-white rounded px-1 py-1 shadow-sm border-b border-slate-200">
        <div>
          <h1 className="font-bold text-slate-800">Cadastro de Setores</h1>
          
        </div>
        <div className="flex gap-1 flex-wrap">
          {!showForm &&
          <Button variant="outline" size="icon" onClick={() => setShowConfigColunas(true)} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-7 w-7">
              <Settings className="w-4 h-4" />
            </Button>
          }
          

          
          {!showForm &&
          <Button onClick={() => {setEditando(null);setShowForm(true);}} size="sm" className="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow rounded-md px-3 bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs">
              Adicionar
            </Button>
          }
        </div>
      </div>}

      <AnimatePresence mode="wait">
        {showForm ?
        <FormularioSetor
          initialData={editando || getInitialFormData()}
          isEditing={!!editando}
          onSubmit={handleSubmit}
          onCancel={() => {setShowForm(false);setEditando(null);}} /> :


        <TabelaSetores
          setores={setores}
          isLoading={isLoading}
          onEdit={handleEdit}
          onDelete={(id) => {setDeletarId(id);setShowDelete(true);}}
          showConfigColunas={showConfigColunas}
          setShowConfigColunas={setShowConfigColunas} />

        }
      </AnimatePresence>

      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Confirmar exclusão"
        description="Se este setor possuir registros lançados, a exclusão será bloqueada automaticamente."
        onConfirm={() => deleteMutation.mutate(deletarId)}
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="destructive" />
      
    </div>);

}