import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import ConfirmDialog from "@/components/common/ConfirmDialog";

import FormularioFormaPagamento from "../components/financeiro/FormularioFormaPagamento";
import TabelaFormasPagamento from "../components/financeiro/TabelaFormasPagamento";

const getNextNumber = async (empresaId) => {
  const all = await base44.entities.FormaPagamento.list();
  const filtered = all.filter(f => f.empresa_id === empresaId);
  const maxNum = filtered.reduce((max, f) => Math.max(max, parseInt(f.numero_forma) || 0), 0);
  return maxNum + 1;
};

export default function FormasPagamento() {
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showConfigColunas, setShowConfigColunas] = useState(false);
  const [deleteState, setDeleteState] = useState({ open: false, ids: [] });
  const empresaId = localStorage.getItem("empresa_selecionada_id");
  const queryClient = useQueryClient();

  const { data: formas = [] } = useQuery({
    queryKey: ["formas_pagamento", empresaId],
    queryFn: async () => {
      const all = await base44.entities.FormaPagamento.list();
      return all.filter(f => f && f.empresa_id === empresaId);
    },
    enabled: !!empresaId,
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const numero = await getNextNumber(empresaId);
      return base44.entities.FormaPagamento.create({ ...data, empresa_id: empresaId, numero_forma: String(numero) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["formas_pagamento"] });
      setShowForm(false);
      setEditingItem(null);
      toast.success("Forma de pagamento criada!");
    },
    onError: (err) => toast.error("Erro: " + (err.message || "Erro desconhecido")),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.FormaPagamento.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["formas_pagamento"] });
      setShowForm(false);
      setEditingItem(null);
      toast.success("Forma de pagamento atualizada!");
    },
    onError: (err) => toast.error("Erro: " + (err.message || "Erro desconhecido")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids) => {
      for (const id of ids) {
        const lancamentos = await base44.entities.LancamentoFinanceiro.list();
        if (lancamentos.some(l => l.forma_pagamento_id === id)) throw new Error("Esta forma possui lançamentos vinculados!");
        const baixas = await base44.entities.BaixaFinanceira.list();
        if (baixas.some(b => b.forma_pagamento_id === id)) throw new Error("Esta forma possui baixas vinculadas!");
        await base44.entities.FormaPagamento.delete(id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["formas_pagamento"] });
      toast.success("Forma(s) excluída(s)!");
    },
    onError: (err) => toast.error(err.message || "Erro ao excluir"),
  });

  const handleSubmit = (data) => {
    if (editingItem?.id) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setShowForm(true);
  };

  const handleRequestDelete = (id) => {
    const ids = Array.isArray(id) ? id : [id];
    setDeleteState({ open: true, ids });
  };

  const handleConfirmDelete = () => {
    deleteMutation.mutate(deleteState.ids);
    setDeleteState({ open: false, ids: [] });
  };

  return (
    <div className="p-1 md:p-1 space-y-1">
      {!showForm && (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 bg-[var(--mg-bg-card)] rounded px-1 py-1 shadow-sm border-b border-[var(--mg-border)]">
          <div>
            <h1 className="font-bold text-[var(--mg-text-1)]">Formas de Pagamento</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="icon" onClick={() => setShowConfigColunas(true)} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-7 w-7">
              <Settings className="w-4 h-4" />
            </Button>
            <Button onClick={() => { setShowForm(true); setEditingItem(null); }} size="sm" className="bg-[var(--mg-accent)] text-primary-foreground px-3 text-xs font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow h-7 hover:bg-[var(--mg-accent-dark)]">
              Adicionar
            </Button>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {showForm ? (
          <FormularioFormaPagamento
            key="form"
            initialData={editingItem}
            onSubmit={handleSubmit}
            onCancel={() => { setShowForm(false); setEditingItem(null); }}
            formasExistentes={formas}
          />
        ) : (
          <TabelaFormasPagamento
            key="table"
            formas={formas}
            onEdit={handleEdit}
            onDelete={handleRequestDelete}
            showConfigColunas={showConfigColunas}
            setShowConfigColunas={setShowConfigColunas}
          />
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={deleteState.open}
        onOpenChange={(open) => setDeleteState(prev => ({ ...prev, open }))}
        title="Confirmar exclusão"
        description={deleteState.ids.length > 1 ? `Deseja excluir ${deleteState.ids.length} formas selecionadas?` : "Deseja excluir esta forma de pagamento?"}
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}