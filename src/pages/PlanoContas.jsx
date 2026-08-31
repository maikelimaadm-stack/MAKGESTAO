import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Save, X, Edit2, Trash2, ChevronRight, ChevronDown, FolderTree } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import ConfirmDialog from "@/components/common/ConfirmDialog";

const PLANO_CONTAS_PADRAO = {
  Despesa: [
    { codigo: "1.0", descricao: "CUSTOS OPERACIONAIS", nivel: 1, aceita_lancamento: false },
    { codigo: "1.1", descricao: "Insumos Agrícolas", nivel: 2, pai: "1.0", aceita_lancamento: false },
    { codigo: "1.1.1", descricao: "Sementes", nivel: 3, pai: "1.1", aceita_lancamento: true },
    { codigo: "1.1.2", descricao: "Fertilizantes", nivel: 3, pai: "1.1", aceita_lancamento: true },
    { codigo: "1.1.3", descricao: "Defensivos Agrícolas", nivel: 3, pai: "1.1", aceita_lancamento: true },
    { codigo: "1.2", descricao: "Mão de Obra", nivel: 2, pai: "1.0", aceita_lancamento: false },
    { codigo: "1.2.1", descricao: "Salários e Encargos", nivel: 3, pai: "1.2", aceita_lancamento: true },
    { codigo: "1.2.2", descricao: "Serviços Terceirizados", nivel: 3, pai: "1.2", aceita_lancamento: true },
    { codigo: "1.3", descricao: "Combustíveis e Lubrificantes", nivel: 2, pai: "1.0", aceita_lancamento: true },
    { codigo: "1.4", descricao: "Manutenção de Máquinas", nivel: 2, pai: "1.0", aceita_lancamento: true },
    { codigo: "2.0", descricao: "DESPESAS ADMINISTRATIVAS", nivel: 1, aceita_lancamento: false },
    { codigo: "2.1", descricao: "Despesas com Pessoal", nivel: 2, pai: "2.0", aceita_lancamento: true },
    { codigo: "2.2", descricao: "Despesas de Escritório", nivel: 2, pai: "2.0", aceita_lancamento: true },
    { codigo: "2.3", descricao: "Serviços Profissionais", nivel: 2, pai: "2.0", aceita_lancamento: true },
    { codigo: "3.0", descricao: "DESPESAS FINANCEIRAS", nivel: 1, aceita_lancamento: false },
    { codigo: "3.1", descricao: "Juros e Encargos", nivel: 2, pai: "3.0", aceita_lancamento: true },
    { codigo: "3.2", descricao: "Tarifas Bancárias", nivel: 2, pai: "3.0", aceita_lancamento: true },
    { codigo: "4.0", descricao: "IMPOSTOS E TAXAS", nivel: 1, aceita_lancamento: false },
    { codigo: "4.1", descricao: "Impostos Federais", nivel: 2, pai: "4.0", aceita_lancamento: true },
    { codigo: "4.2", descricao: "Impostos Estaduais", nivel: 2, pai: "4.0", aceita_lancamento: true },
    { codigo: "4.3", descricao: "Impostos Municipais", nivel: 2, pai: "4.0", aceita_lancamento: true },
  ],
  Receita: [
    { codigo: "1.0", descricao: "RECEITAS OPERACIONAIS", nivel: 1, aceita_lancamento: false },
    { codigo: "1.1", descricao: "Venda de Produtos Agrícolas", nivel: 2, pai: "1.0", aceita_lancamento: false },
    { codigo: "1.1.1", descricao: "Venda de Grãos", nivel: 3, pai: "1.1", aceita_lancamento: true },
    { codigo: "1.1.2", descricao: "Venda de Algodão", nivel: 3, pai: "1.1", aceita_lancamento: true },
    { codigo: "1.1.3", descricao: "Venda de Gado", nivel: 3, pai: "1.1", aceita_lancamento: true },
    { codigo: "1.2", descricao: "Prestação de Serviços", nivel: 2, pai: "1.0", aceita_lancamento: true },
    { codigo: "2.0", descricao: "RECEITAS FINANCEIRAS", nivel: 1, aceita_lancamento: false },
    { codigo: "2.1", descricao: "Rendimentos de Aplicações", nivel: 2, pai: "2.0", aceita_lancamento: true },
    { codigo: "2.2", descricao: "Descontos Obtidos", nivel: 2, pai: "2.0", aceita_lancamento: true },
    { codigo: "3.0", descricao: "OUTRAS RECEITAS", nivel: 1, aceita_lancamento: false },
    { codigo: "3.1", descricao: "Arrendamentos", nivel: 2, pai: "3.0", aceita_lancamento: true },
    { codigo: "3.2", descricao: "Vendas Diversas", nivel: 2, pai: "3.0", aceita_lancamento: true },
  ]
};

export default function PlanoContas() {
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState({});
  const [tipoFiltro, setTipoFiltro] = useState("Despesa");
  
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [formData, setFormData] = useState({
    codigo: "",
    descricao: "",
    tipo: "Despesa",
    plano_pai_id: "",
    aceita_lancamento: false
  });

  const empresaSelecionadaId = localStorage.getItem('empresa_selecionada_id');
  const queryClient = useQueryClient();

  const { data: planos = [], isLoading } = useQuery({
    queryKey: ['planos_hierarquico', empresaSelecionadaId],
    queryFn: async () => {
      const all = await base44.entities.PlanoContas.list('codigo');
      return all.filter(p => p.empresa_id === empresaSelecionadaId);
    },
    enabled: !!empresaSelecionadaId,
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const maxNum = planos.reduce((max, p) => Math.max(max, parseInt(p.numero_plano) || 0), 0);
      
      const nivel = data.plano_pai_id 
        ? (planos.find(p => p.id === data.plano_pai_id)?.nivel || 0) + 1
        : data.codigo.split('.').length;

      return base44.entities.PlanoContas.create({
        ...data,
        empresa_id: empresaSelecionadaId,
        numero_plano: String(maxNum + 1),
        nivel,
        ativo: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planos_hierarquico'] });
      setShowForm(false);
      setEditingItem(null);
      setFormData({ codigo: "", descricao: "", tipo: "Despesa", plano_pai_id: "", aceita_lancamento: false });
      toast.success('✅ Plano de contas salvo!');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PlanoContas.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planos_hierarquico'] });
      setShowForm(false);
      setEditingItem(null);
      setFormData({ codigo: "", descricao: "", tipo: "Despesa", plano_pai_id: "", aceita_lancamento: false });
      toast.success('✅ Plano atualizado!');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PlanoContas.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planos_hierarquico'] });
      toast.success('✅ Plano excluído!');
    },
  });

  const inserirPadrao = async () => {
    if (planos.length > 0) {
      if (!window.confirm('⚠️ Já existem planos cadastrados. Deseja adicionar os planos padrão mesmo assim?')) {
        return;
      }
    }

    const tipos = ['Despesa', 'Receita'];
    let contador = planos.length;

    for (const tipo of tipos) {
      const planosDoTipo = PLANO_CONTAS_PADRAO[tipo];
      const mapa = {};

      for (const plano of planosDoTipo) {
        contador++;
        
        let plano_pai_id = undefined;
        if (plano.pai) {
          plano_pai_id = mapa[plano.pai];
        }

        const created = await base44.entities.PlanoContas.create({
          empresa_id: empresaSelecionadaId,
          numero_plano: String(contador),
          codigo: plano.codigo,
          descricao: plano.descricao,
          tipo: tipo,
          plano_pai_id,
          nivel: plano.nivel,
          aceita_lancamento: plano.aceita_lancamento,
          ativo: true
        });

        mapa[plano.codigo] = created.id;
      }
    }

    queryClient.invalidateQueries({ queryKey: ['planos_hierarquico'] });
    toast.success('✅ Planos padrão inseridos!');
  };

  const buildTree = (tipo) => {
    const filtered = planos.filter(p => p.tipo === tipo && p.ativo !== false);
    const roots = filtered.filter(p => !p.plano_pai_id);
    
    const buildChildren = (parentId) => {
      return filtered.filter(p => p.plano_pai_id === parentId);
    };

    const tree = [];
    roots.forEach(root => {
      const node = { ...root, children: buildChildren(root.id) };
      const addChildren = (n) => {
        if (n.children.length > 0) {
          n.children = n.children.map(child => ({
            ...child,
            children: buildChildren(child.id)
          }));
          n.children.forEach(addChildren);
        }
      };
      addChildren(node);
      tree.push(node);
    });

    return tree;
  };

  const tree = useMemo(() => buildTree(tipoFiltro), [planos, tipoFiltro]);

  const toggleNode = (id) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const renderTree = (nodes, level = 0) => {
    return nodes.map(node => (
      <div key={node.id} className="select-none">
        <div 
          className="flex items-center gap-2 py-1.5 px-2 hover:bg-slate-50 rounded group"
          style={{ paddingLeft: `${level * 24 + 8}px` }}
        >
          {node.children.length > 0 ? (
            <button onClick={() => toggleNode(node.id)} className="w-4 h-4 flex items-center justify-center">
              {expandedNodes[node.id] ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-600" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              )}
            </button>
          ) : (
            <div className="w-4" />
          )}
          
          <span className={`font-mono text-xs ${node.aceita_lancamento === false ? 'font-bold text-blue-700' : 'text-slate-600'}`}>
            {node.codigo}
          </span>
          
          <span className={`flex-1 text-sm ${node.aceita_lancamento === false ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
            {node.descricao}
          </span>
          
          {node.aceita_lancamento === false && (
            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">Agrupador</span>
          )}
          
          <div className="opacity-0 group-hover:opacity-100 flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setEditingItem(node);
                setFormData({
                  codigo: node.codigo,
                  descricao: node.descricao,
                  tipo: node.tipo,
                  plano_pai_id: node.plano_pai_id || "",
                  aceita_lancamento: node.aceita_lancamento !== false
                });
                setShowForm(true);
              }}
              className="h-7 w-7"
            >
              <Edit2 className="w-3 h-3 text-blue-600" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeleteConfirmId(node.id)}
              className="h-7 w-7"
            >
              <Trash2 className="w-3 h-3 text-red-600" />
            </Button>
          </div>
        </div>
        
        {expandedNodes[node.id] && node.children.length > 0 && (
          <div>
            {renderTree(node.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.codigo || !formData.descricao) {
      toast.error('❌ Preencha código e descrição!');
      return;
    }

    const data = {
      codigo: formData.codigo.toUpperCase(),
      descricao: formData.descricao.toUpperCase(),
      tipo: formData.tipo,
      plano_pai_id: formData.plano_pai_id || undefined,
      aceita_lancamento: formData.aceita_lancamento
    };

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const planosParaSelect = planos.filter(p => p.tipo === formData.tipo && p.aceita_lancamento === false);

  return (
    <div className="p-4 md:p-6 space-y-2">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Plano de Contas</h1>
          <p className="text-xs text-slate-600">Estrutura hierárquica de contas</p>
        </div>
        <div className="flex gap-2">
          {planos.length === 0 && (
            <Button onClick={inserirPadrao} variant="outline" size="sm" className="gap-1 text-xs h-8">
              <FolderTree className="w-3.5 h-3.5" />
              Inserir Padrão
            </Button>
          )}
          <Button onClick={() => { setShowForm(!showForm); setEditingItem(null); setFormData({ codigo: "", descricao: "", tipo: "Despesa", plano_pai_id: "", aceita_lancamento: true }); }} size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700">
          Novo
          </Button>
        </div>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="shadow-sm border-slate-300 bg-white">
            <CardHeader className="bg-slate-50 border-b border-slate-200 py-3">
              <CardTitle className="text-sm font-semibold text-slate-900">
                {editingItem ? 'Editar' : 'Novo'} Plano de Contas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <form onSubmit={handleSubmit} className="space-y-1">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-1">
                  <div className="space-y-1">
                    <Label className="text-xs">Código *</Label>
                    <Input value={formData.codigo} onChange={(e) => setFormData({ ...formData, codigo: e.target.value })} placeholder="1.1.1" className="h-8 text-xs" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Descrição *</Label>
                    <Input value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} placeholder="DESCRIÇÃO" className="h-8 text-xs uppercase" style={{ textTransform: 'uppercase' }} />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-1">
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo *</Label>
                    <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v, plano_pai_id: "" })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Despesa" className="text-xs">Despesa</SelectItem>
                        <SelectItem value="Receita" className="text-xs">Receita</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Plano Pai (Opcional)</Label>
                    <Select value={formData.plano_pai_id} onValueChange={(v) => setFormData({ ...formData, plano_pai_id: v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Nenhum (raiz)" /></SelectTrigger>
                      <SelectContent>
                        {planosParaSelect.map(p => (
                          <SelectItem key={p.id} value={p.id} className="text-xs">{p.codigo} - {p.descricao}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox checked={formData.aceita_lancamento} onCheckedChange={(v) => setFormData({ ...formData, aceita_lancamento: v })} id="aceita_lancamento" />
                  <label htmlFor="aceita_lancamento" className="text-xs cursor-pointer">
                    Aceita lançamentos diretos (se desmarcado, funciona apenas como agrupador)
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingItem(null); }} size="sm" className="h-8 text-xs">
                    Cancelar
                  </Button>
                  <Button type="submit" size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700">
                    Salvar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b">
          <div className="flex justify-between items-center">
            <CardTitle className="text-sm">Estrutura de Contas</CardTitle>
            <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Despesa" className="text-xs">Despesas</SelectItem>
                <SelectItem value="Receita" className="text-xs">Receita</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-slate-400">Carregando...</div>
          ) : tree.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <FolderTree className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Nenhum plano de contas cadastrado</p>
              <Button onClick={inserirPadrao} variant="outline" size="sm" className="mt-3 gap-1 text-xs">
                <FolderTree className="w-3 h-3" />
                Inserir Padrão
              </Button>
            </div>
          ) : (
            <div className="p-3">
              {renderTree(tree)}
            </div>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog
        open={!!deleteConfirmId}
        onOpenChange={() => setDeleteConfirmId(null)}
        title="Confirmar exclusão"
        description="Tem certeza que deseja excluir este plano de contas? Esta ação não pode ser desfeita."
        onConfirm={() => {
          deleteMutation.mutate(deleteConfirmId);
          setDeleteConfirmId(null);
        }}
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="destructive"
      />
    </div>
  );
}