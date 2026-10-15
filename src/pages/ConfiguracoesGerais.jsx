import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Palette, Menu, Settings, Users, Save, RotateCcw, Plus, GripVertical, Edit2, Trash2, Check, ChevronRight, ChevronDown, ArrowUpAZ } from "lucide-react";
import { toast } from "sonner";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import GerenciadorIcones from "../components/configuracoes/GerenciadorIcones";

const DEFAULT_MENU = [
  { id: "dashboard", title: "Dashboard", url: "Home", icon: "Home" },
  { id: "pesagens", title: "Pesagens", url: "Pesagens", icon: "Scale" },
  { id: "custos", title: "Custos de Safra", url: "CustosSafra", icon: "TrendingUp" },
  { id: "movimentacoes", title: "Movimentações Estoque", url: "MovimentacoesEstoque", icon: "ArrowRightLeft" },
  {
    id: "pecuaria",
    title: "Pecuária",
    icon: "Package",
    submenu: [
      { id: "pec-lotes", title: "Cadastro de Lotes", url: "CadastroLotes" },
      { id: "pec-mapa-geral", title: "Mapa Geral - Manejo", url: "MapaGeral" },
      { id: "pec-mapa-cadastro", title: "Mapa - Áreas/Pontos/Linhas", url: "MapaCadastro" },
      { id: "pec-historico", title: "Histórico de Movimentações", url: "HistoricoMovimentacoesPecuaria" },
      { id: "pec-dashboard-supl", title: "Dashboard Suplementação", url: "DashboardSuplementacao" },
      { id: "pec-rel-suplementacao", title: "Relatório Suplementação", url: "RelatorioSuplementacao" },
      { id: "pec-config-fatores", title: "Configuração Fatores Consumo", url: "ConfiguracaoFatoresConsumo" },
      { id: "pec-categorias-manejo", title: "Categorias de Manejo", url: "CategoriasManejo" },
    ],
  },
  {
    id: "financeiro",
    title: "Financeiro",
    icon: "DollarSign",
    submenu: [
      { id: "fin-lancamento", title: "Lançamento Financeiro", url: "LancamentoFinanceiro" },
      { id: "fin-caixa-bancos", title: "Caixa & Bancos", url: "CaixaBancos" },
      { id: "fin-plano", title: "Plano de Contas", url: "PlanoContas" },
      { id: "fin-formas", title: "Formas de Pagamento", url: "FormasPagamento" },
      { id: "fin-grupos", title: "Grupos Financeiros", url: "GruposFinanceiros" },
      { id: "fin-fluxo", title: "Fluxo de Caixa", url: "FluxoCaixa" },
      { id: "fin-livro-caixa", title: "Livro-Caixa", url: "LivroCaixa" },
    ],
  },
  {
    id: "fiscal",
    title: "Fiscal",
    icon: "BookOpen",
    submenu: [
      { id: "fiscal-livros", title: "Livros Fiscais", url: "LivrosFiscais" },
    ],
  },
  {
    id: "cadastros",
    title: "Cadastros",
    icon: "FolderOpen",
    submenu: [
      { id: "cad-empresa", title: "Empresa", url: "Empresa" },
      { id: "cad-mapa", title: "Mapa - Áreas/Pontos/Linhas", url: "MapaCadastro" },
      { id: "cad-safras", title: "Safras", url: "GerenciarSafras" },
      { id: "cad-fornecedores", title: "Fornecedores/Clientes", url: "Fornecedores" },
      { id: "cad-produtos", title: "Produtos", url: "Produtos" },
      { id: "cad-ativos", title: "Ativos Fixos", url: "AtivosFixos" },
      { id: "cad-cidades", title: "Cidades", url: "GerenciarCidades" },
      { id: "cad-unidades", title: "Unidades de Medida", url: "UnidadesMedida" },
      { id: "cad-categorias", title: "Categorias", url: "Categorias" },
      { id: "cad-locais", title: "Locais de Estoque", url: "LocaisEstoque" },
      { id: "cad-centros", title: "Centros de Custo", url: "CentrosCusto" },
    ],
  },
  {
    id: "relatorios",
    title: "Relatórios",
    icon: "FileText",
    submenu: [
      { id: "rel-pesagens", title: "Relatório de Pesagens", url: "RelatorioPesagens" },
      { id: "rel-custos", title: "Relatório de Custos Safra", url: "RelatorioCustosSafra" },
      { id: "rel-estoque", title: "Relatório de Estoque", url: "RelatorioEstoque" },
      { id: "rel-entregas", title: "Histórico de Entregas", url: "RelatorioHistoricoEntregas" },
      { id: "rel-financeiro", title: "Relatório Financeiro", url: "RelatorioFinanceiro" },
      { id: "rel-fornecedores", title: "Lista de Fornecedores", url: "RelatorioFornecedores" },
      { id: "rel-produtos", title: "Lista de Produtos", url: "RelatorioProdutos" },
      { id: "rel-suplementacao", title: "Relatório Suplementação", url: "RelatorioSuplementacao" },
    ],
  },
  { id: "usuarios", title: "Usuários", url: "Usuarios", icon: "Shield" },
];

const ICONS_DISPONIVEIS = [
  'Home', 'Scale', 'TrendingUp', 'ArrowRightLeft', 'DollarSign', 'BookOpen',
  'FolderOpen', 'FileText', 'Shield', 'Package', 'Users', 'Settings'
];

const PAGINAS_DISPONIVEIS = [
  { nome: "AtivosFixos", titulo: "Ativos Fixos" },
  { nome: "CadastroLotes", titulo: "Cadastro de Lotes" },
  { nome: "CaixaBancos", titulo: "Caixa & Bancos" },
  { nome: "Categorias", titulo: "Categorias" },
  { nome: "CategoriasManejo", titulo: "Categorias de Manejo" },
  { nome: "CentrosCusto", titulo: "Centros de Custo" },
  { nome: "ConfiguracaoFatoresConsumo", titulo: "Configuração Fatores Consumo" },
  { nome: "ConfiguracoesGerais", titulo: "Configurações Gerais" },
  { nome: "CustosSafra", titulo: "Custos de Safra" },
  { nome: "DashboardSuplementacao", titulo: "Dashboard Suplementação" },
  { nome: "Empresa", titulo: "Empresa" },
  { nome: "FluxoCaixa", titulo: "Fluxo de Caixa" },
  { nome: "FormasPagamento", titulo: "Formas de Pagamento" },
  { nome: "Fornecedores", titulo: "Fornecedores/Clientes" },
  { nome: "GerenciarCidades", titulo: "Cidades" },
  { nome: "GerenciarSafras", titulo: "Safras" },
  { nome: "GruposFinanceiros", titulo: "Grupos Financeiros" },
  { nome: "HistoricoMovimentacoesPecuaria", titulo: "Histórico de Movimentações" },
  { nome: "Home", titulo: "Dashboard" },
  { nome: "LancamentoFinanceiro", titulo: "Lançamento Financeiro" },
  { nome: "LivroCaixa", titulo: "Livro-Caixa" },
  { nome: "LivrosFiscais", titulo: "Livros Fiscais" },
  { nome: "LocaisEstoque", titulo: "Locais de Estoque" },
  { nome: "MapaCadastro", titulo: "Mapa - Áreas/Pontos/Linhas" },
  { nome: "MapaGeral", titulo: "Mapa Geral - Manejo" },
  { nome: "MovimentacoesEstoque", titulo: "Movimentações Estoque" },
  { nome: "Pesagens", titulo: "Pesagens" },
  { nome: "PlanoContas", titulo: "Plano de Contas" },
  { nome: "Produtos", titulo: "Produtos" },
  { nome: "RelatorioCustosSafra", titulo: "Relatório de Custos Safra" },
  { nome: "RelatorioEstoque", titulo: "Relatório de Estoque" },
  { nome: "RelatorioFinanceiro", titulo: "Relatório Financeiro" },
  { nome: "RelatorioFornecedores", titulo: "Lista de Fornecedores" },
  { nome: "RelatorioHistoricoEntregas", titulo: "Histórico de Entregas" },
  { nome: "RelatorioPesagens", titulo: "Relatório de Pesagens" },
  { nome: "RelatorioProdutos", titulo: "Lista de Produtos" },
  { nome: "RelatorioSuplementacao", titulo: "Relatório Suplementação" },
  { nome: "UnidadesMedida", titulo: "Unidades de Medida" },
  { nome: "Usuarios", titulo: "Usuários" },
].sort((a, b) => a.titulo.localeCompare(b.titulo));

export default function ConfiguracoesGerais() {
  const [menuItems, setMenuItems] = useState(() => {
    const saved = localStorage.getItem('custom_menu');
    return saved ? JSON.parse(saved) : DEFAULT_MENU;
  });

  const { data: currentUser = null, isLoading: isLoadingUser } = useQuery({
    queryKey: ['configuracoes-gerais-user'],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: permissoes = [], isLoading: isLoadingPermissoes } = useQuery({
    queryKey: ['configuracoes-gerais-permissoes'],
    queryFn: () => base44.entities.Permissao.list(),
    staleTime: 5 * 60 * 1000,
  });

  const permissaoAtual = useMemo(
    () => permissoes.find((item) => item.user_email === currentUser?.email) || null,
    [permissoes, currentUser?.email]
  );

  const isAdmin = currentUser?.role === 'admin' || permissaoAtual?.is_admin === true;

  const [expandedMenus, setExpandedMenus] = useState({});
  const [showAddMenuItem, setShowAddMenuItem] = useState(false);
  const [showAddSubmenu, setShowAddSubmenu] = useState(false);
  const [showAddSubSubmenu, setShowAddSubSubmenu] = useState(false);
  const [showEditMenuItem, setShowEditMenuItem] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [parentMenuForSubmenu, setParentMenuForSubmenu] = useState(null);
  const [parentSubmenuForSubSubmenu, setParentSubmenuForSubSubmenu] = useState(null);

  const [newMenuItem, setNewMenuItem] = useState({ title: "", url: "", icon: "Home" });
  const [newSubmenuItem, setNewSubmenuItem] = useState({ title: "", url: "" });
  const [newSubSubmenuItem, setNewSubSubmenuItem] = useState({ title: "", url: "" });

  const saveMenu = (newMenu) => {
    setMenuItems(newMenu);
    localStorage.setItem('custom_menu', JSON.stringify(newMenu));
    toast.success('✅ Menu atualizado! Recarregue a página.');
  };

  const toggleMenu = (menuId) => {
    setExpandedMenus(prev => ({ ...prev, [menuId]: !prev[menuId] }));
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(menuItems);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    saveMenu(items);
  };

  const handleAddMenuItem = () => {
    if (!newMenuItem.title || !newMenuItem.url) {
      toast.error('Preencha título e página!');
      return;
    }
    const newItem = { id: `custom-${Date.now()}`, title: newMenuItem.title, url: newMenuItem.url, icon: newMenuItem.icon };
    saveMenu([...menuItems, newItem]);
    setNewMenuItem({ title: "", url: "", icon: "Home" });
    setShowAddMenuItem(false);
  };

  const handleEditMenuItem = () => {
    if (!editingItem.title) {
      toast.error('Preencha o título!');
      return;
    }
    const updatedMenu = menuItems.map(item =>
      item.id === editingItem.id ? { ...item, title: editingItem.title, icon: editingItem.icon, url: editingItem.url } : item
    );
    saveMenu(updatedMenu);
    setShowEditMenuItem(false);
    setEditingItem(null);
  };

  const handleAddSubmenuItem = () => {
    if (!newSubmenuItem.title || !newSubmenuItem.url || !parentMenuForSubmenu) {
      toast.error('Preencha título e página!');
      return;
    }
    const updatedMenu = menuItems.map(item => {
      if (item.id === parentMenuForSubmenu) {
        return { ...item, submenu: [...(item.submenu || []), { id: `submenu-${Date.now()}`, title: newSubmenuItem.title, url: newSubmenuItem.url }] };
      }
      return item;
    });
    saveMenu(updatedMenu);
    setNewSubmenuItem({ title: "", url: "" });
    setParentMenuForSubmenu(null);
    setShowAddSubmenu(false);
  };

  const handleAddSubSubmenuItem = () => {
    if (!newSubSubmenuItem.title || !newSubSubmenuItem.url || !parentMenuForSubmenu || !parentSubmenuForSubSubmenu) {
      toast.error('Preencha todos os campos!');
      return;
    }
    const updatedMenu = menuItems.map(item => {
      if (item.id === parentMenuForSubmenu) {
        const updatedSubmenu = (item.submenu || []).map(sub => {
          if (sub.id === parentSubmenuForSubSubmenu) {
            return { ...sub, submenu: [...(sub.submenu || []), { id: `subsubmenu-${Date.now()}`, title: newSubSubmenuItem.title, url: newSubSubmenuItem.url }] };
          }
          return sub;
        });
        return { ...item, submenu: updatedSubmenu };
      }
      return item;
    });
    saveMenu(updatedMenu);
    setNewSubSubmenuItem({ title: "", url: "" });
    setParentMenuForSubmenu(null);
    setParentSubmenuForSubSubmenu(null);
    setShowAddSubSubmenu(false);
  };

  const handleOrdenarAlfabeticamente = () => {
    if (window.confirm('Ordenar todos os menus e submenus alfabeticamente?')) {
      const sortRecursive = (items) => {
        return items.map(item => {
          const newItem = { ...item };
          if (newItem.submenu) {
            newItem.submenu = sortRecursive(newItem.submenu);
          }
          return newItem;
        }).sort((a, b) => a.title.localeCompare(b.title));
      };
      saveMenu(sortRecursive(menuItems));
    }
  };

  const handleDeleteMenuItem = (id) => {
    if (window.confirm('Deseja excluir este item?')) {
      saveMenu(menuItems.filter(item => item.id !== id));
    }
  };

  const handleDeleteSubmenuItem = (menuId, submenuId) => {
    if (window.confirm('Deseja excluir este subitem?')) {
      const updatedMenu = menuItems.map(item => {
        if (item.id === menuId) {
          return { ...item, submenu: item.submenu.filter(sub => sub.id !== submenuId) };
        }
        return item;
      });
      saveMenu(updatedMenu);
    }
  };

  const handleDeleteSubSubmenuItem = (menuId, submenuId, subSubmenuId) => {
    if (window.confirm('Deseja excluir este sub-subitem?')) {
      const updatedMenu = menuItems.map(item => {
        if (item.id === menuId) {
          return {
            ...item,
            submenu: item.submenu.map(sub => {
              if (sub.id === submenuId) {
                return { ...sub, submenu: (sub.submenu || []).filter(subsub => subsub.id !== subSubmenuId) };
              }
              return sub;
            })
          };
        }
        return item;
      });
      saveMenu(updatedMenu);
    }
  };

  const handleResetMenu = () => {
    if (window.confirm('⚠️ Resetar menu? Todas personalizações serão perdidas.')) {
      saveMenu(DEFAULT_MENU);
    }
  };

  const handleReloadPage = () => {
    window.location.reload();
  };

  const openEditDialog = (item) => {
    setEditingItem({ ...item });
    setShowEditMenuItem(true);
  };

  if (isLoadingUser || isLoadingPermissoes) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Card className="shadow-sm">
          <CardContent className="p-6 text-xs text-slate-500">Carregando configurações...</CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Card className="shadow-sm border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-900">Acesso restrito</CardTitle>
            <CardDescription className="text-xs text-amber-700">
              As configurações e parâmetros do sistema são exibidos apenas para administrador.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Configurações Gerais</h1>
        <p className="text-xs text-slate-600">Personalize menus, aparência e parâmetros</p>
      </div>

      <Tabs defaultValue="menus" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-4 h-8">
          <TabsTrigger value="menus" className="gap-1.5 text-xs h-7"><Menu className="w-3 h-3" />Menus</TabsTrigger>
          <TabsTrigger value="identidade" className="gap-1.5 text-xs h-7"><Palette className="w-3 h-3" />Identidade</TabsTrigger>
          <TabsTrigger value="parametros" className="gap-1.5 text-xs h-7"><Settings className="w-3 h-3" />Parâmetros</TabsTrigger>
          <TabsTrigger value="usuarios" className="gap-1.5 text-xs h-7"><Users className="w-3 h-3" />Usuários</TabsTrigger>
        </TabsList>

        <TabsContent value="menus" className="space-y-3 mt-3">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Editor de Menus (3 níveis)</CardTitle>
              <CardDescription className="text-xs">Arraste para reordenar ou clique em A-Z para ordenar alfabeticamente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                <Button onClick={() => setShowAddMenuItem(true)} size="sm" className="h-8 gap-1 text-xs bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="w-3 h-3" />Novo Menu Principal
                </Button>
                <Button onClick={() => setShowAddSubmenu(true)} variant="outline" size="sm" className="h-8 gap-1 text-xs">
                  <Plus className="w-3 h-3" />Novo Submenu
                </Button>
                <Button onClick={() => setShowAddSubSubmenu(true)} variant="outline" size="sm" className="h-8 gap-1 text-xs">
                  <Plus className="w-3 h-3" />Novo Sub-Submenu
                </Button>
                <Button onClick={handleOrdenarAlfabeticamente} variant="outline" size="sm" className="h-8 gap-1 text-xs">
                  <ArrowUpAZ className="w-3 h-3" />Ordenar A-Z
                </Button>
                <Button onClick={handleResetMenu} variant="outline" size="sm" className="h-8 text-xs">
                  <RotateCcw className="w-3 h-3 mr-1" />Resetar
                </Button>
                <Button onClick={handleReloadPage} variant="outline" size="sm" className="h-8 text-xs ml-auto">Recarregar</Button>
              </div>

              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="menu">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                      {menuItems.map((item, index) => (
                        <Draggable key={item.id} draggableId={item.id} index={index}>
                          {(provided) => (
                            <div ref={provided.innerRef} {...provided.draggableProps} className="bg-white border rounded p-2.5 space-y-1.5 shadow-sm">
                              <div className="flex items-center gap-2">
                                <div {...provided.dragHandleProps}>
                                  <GripVertical className="w-3.5 h-3.5 text-slate-400 cursor-move" />
                                </div>
                                {item.submenu && (
                                  <Button variant="ghost" size="icon" onClick={() => toggleMenu(item.id)} className="h-6 w-6">
                                    {expandedMenus[item.id] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                  </Button>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-xs">{item.title}</div>
                                  {item.url && <div className="text-[10px] text-slate-500">Página: {item.url}</div>}
                                  {item.submenu && <div className="text-[10px] text-slate-500">{item.submenu.length} subitem(ns)</div>}
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-7 w-7 text-blue-600 hover:bg-blue-50" title="Editar">
                                  <Edit2 className="w-3 h-3" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDeleteMenuItem(item.id)} className="h-7 w-7 text-red-600 hover:bg-red-50" title="Excluir">
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>

                              {item.submenu && item.submenu.length > 0 && expandedMenus[item.id] && (
                                <div className="ml-6 space-y-1 border-l-2 border-slate-200 pl-2">
                                  {item.submenu.map((sub) => (
                                    <div key={sub.id}>
                                      <div className="flex items-center justify-between py-1 bg-slate-50 px-2 rounded">
                                        {sub.submenu && (
                                          <Button variant="ghost" size="icon" onClick={() => toggleMenu(sub.id)} className="h-5 w-5">
                                            {expandedMenus[sub.id] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                          </Button>
                                        )}
                                        <div className="flex-1 min-w-0 ml-1">
                                          <div className="text-xs font-medium">{sub.title}</div>
                                          {sub.url && <div className="text-[10px] text-slate-500">Página: {sub.url}</div>}
                                          {sub.submenu && <div className="text-[10px] text-slate-500">{sub.submenu.length} sub-subitem(ns)</div>}
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteSubmenuItem(item.id, sub.id)} className="h-6 w-6 text-red-600 hover:bg-red-50">
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </div>

                                      {sub.submenu && sub.submenu.length > 0 && expandedMenus[sub.id] && (
                                        <div className="ml-6 space-y-1 border-l-2 border-emerald-200 pl-2 mt-1">
                                          {sub.submenu.map((subsub) => (
                                            <div key={subsub.id} className="flex items-center justify-between py-1 bg-emerald-50 px-2 rounded">
                                              <div className="flex-1 min-w-0">
                                                <div className="text-xs font-medium">{subsub.title}</div>
                                                {subsub.url && <div className="text-[10px] text-slate-500">Página: {subsub.url}</div>}
                                              </div>
                                              <Button variant="ghost" size="icon" onClick={() => handleDeleteSubSubmenuItem(item.id, sub.id, subsub.id)} className="h-6 w-6 text-red-600 hover:bg-red-50">
                                                <Trash2 className="w-3 h-3" />
                                              </Button>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="identidade" className="space-y-3 mt-3">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Identidade Visual</CardTitle>
              <CardDescription className="text-xs">Configure logo, cores e tema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Logo do Sistema</Label>
                <Input type="file" accept="image/*" className="h-8 text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Cor Principal</Label>
                  <Input type="color" defaultValue="#10b981" className="h-8" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Cor Secundária</Label>
                  <Input type="color" defaultValue="#3b82f6" className="h-8" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs">Modo Escuro</Label>
                  <p className="text-[10px] text-slate-500">Ativar tema escuro</p>
                </div>
                <Switch />
              </div>
              <Button size="sm" className="h-8 gap-1 text-xs">
                <Save className="w-3 h-3" />Salvar
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parametros" className="space-y-3 mt-3">
          <GerenciadorIcones />
          
          <Card className="shadow-sm mt-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Regras de Ícones Mistos</CardTitle>
              <CardDescription className="text-xs">Configure ícones para áreas com múltiplas categorias</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-3">
                <div className="text-xs font-semibold text-amber-900 mb-1">💡 Como funciona</div>
                <div className="text-[10px] text-amber-700 space-y-1">
                  <p>• Quando há múltiplos lotes de categorias diferentes na mesma área, o sistema agrupa e mostra o total de cabeças.</p>
                  <p>• O ícone exibido será o configurado com a categoria <strong>"MISTO"</strong> na seção "Gerenciar Ícones" acima.</p>
                  <p>• Clicando no gerenciador acima, adicione um ícone do tipo "Lote" com categoria "MISTO".</p>
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <div className="text-xs font-semibold text-blue-900 mb-2">📋 Exemplo de uso:</div>
                <div className="text-[10px] text-blue-700 space-y-1">
                  <p>✅ Área com 50 Bezerros + 30 Vacas = Mostra 80 cabeças com ícone MISTO</p>
                  <p>✅ Área com apenas 100 Bois = Mostra 100 cabeças com ícone específico de Boi</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Parâmetros Gerais</CardTitle>
              <CardDescription className="text-xs">Configurações globais</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome da Empresa</Label>
                <Input placeholder="Minha Empresa" className="h-8 text-xs" />
              </div>
              <Button size="sm" className="h-8 gap-1 text-xs">
                <Save className="w-3 h-3" />Salvar
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usuarios" className="space-y-3 mt-3">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Usuários e Permissões</CardTitle>
              <CardDescription className="text-xs">Gerencie acessos</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-500">Configure na aba <strong>Usuários</strong> do menu.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showAddMenuItem} onOpenChange={setShowAddMenuItem}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Novo Menu Principal</DialogTitle>
            <DialogDescription className="text-xs">Crie um novo item no menu</DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5">
            <div className="space-y-1.5">
              <Label className="text-xs">Título *</Label>
              <Input value={newMenuItem.title} onChange={(e) => setNewMenuItem({ ...newMenuItem, title: e.target.value })} placeholder="Ex: Relatórios" className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Página *</Label>
              <Select value={newMenuItem.url} onValueChange={(v) => {
                const paginaSelecionada = PAGINAS_DISPONIVEIS.find(p => p.nome === v);
                setNewMenuItem({ ...newMenuItem, url: v, title: newMenuItem.title || paginaSelecionada?.titulo || "" });
              }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione a página" /></SelectTrigger>
                <SelectContent>
                  {PAGINAS_DISPONIVEIS.map(pag => (
                    <SelectItem key={pag.nome} value={pag.nome} className="text-xs">{pag.titulo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ícone</Label>
              <Select value={newMenuItem.icon} onValueChange={(v) => setNewMenuItem({ ...newMenuItem, icon: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ICONS_DISPONIVEIS.map(iconName => (
                    <SelectItem key={iconName} value={iconName} className="text-xs">{iconName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAddMenuItem(false)} size="sm" className="h-8 text-xs">Cancelar</Button>
              <Button onClick={handleAddMenuItem} size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700">Adicionar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddSubmenu} onOpenChange={setShowAddSubmenu}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Novo Submenu</DialogTitle>
            <DialogDescription className="text-xs">Adicione submenu a um menu principal</DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5">
            <div className="space-y-1.5">
              <Label className="text-xs">Menu Principal *</Label>
              <Select value={parentMenuForSubmenu || ''} onValueChange={setParentMenuForSubmenu}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {menuItems.map(item => (
                    <SelectItem key={item.id} value={item.id} className="text-xs">{item.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Título *</Label>
              <Input value={newSubmenuItem.title} onChange={(e) => setNewSubmenuItem({ ...newSubmenuItem, title: e.target.value })} placeholder="Ex: Plano de Contas" className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Página *</Label>
              <Select value={newSubmenuItem.url} onValueChange={(v) => {
                const paginaSelecionada = PAGINAS_DISPONIVEIS.find(p => p.nome === v);
                setNewSubmenuItem({ ...newSubmenuItem, url: v, title: newSubmenuItem.title || paginaSelecionada?.titulo || "" });
              }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione a página" /></SelectTrigger>
                <SelectContent>
                  {PAGINAS_DISPONIVEIS.map(pag => (
                    <SelectItem key={pag.nome} value={pag.nome} className="text-xs">{pag.titulo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAddSubmenu(false)} size="sm" className="h-8 text-xs">Cancelar</Button>
              <Button onClick={handleAddSubmenuItem} size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700">Adicionar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddSubSubmenu} onOpenChange={setShowAddSubSubmenu}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Novo Sub-Submenu (Nível 2)</DialogTitle>
            <DialogDescription className="text-xs">Adicione sub-submenu a um submenu existente</DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5">
            <div className="space-y-1.5">
              <Label className="text-xs">Menu Principal *</Label>
              <Select value={parentMenuForSubmenu || ''} onValueChange={(v) => { setParentMenuForSubmenu(v); setParentSubmenuForSubSubmenu(null); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {menuItems.filter(m => m.submenu && m.submenu.length > 0).map(item => (
                    <SelectItem key={item.id} value={item.id} className="text-xs">{item.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {parentMenuForSubmenu && (
              <div className="space-y-1.5">
                <Label className="text-xs">Submenu (Nível 1) *</Label>
                <Select value={parentSubmenuForSubSubmenu || ''} onValueChange={setParentSubmenuForSubSubmenu}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {menuItems.find(m => m.id === parentMenuForSubmenu)?.submenu?.map(sub => (
                      <SelectItem key={sub.id} value={sub.id} className="text-xs">{sub.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Título *</Label>
              <Input value={newSubSubmenuItem.title} onChange={(e) => setNewSubSubmenuItem({ ...newSubSubmenuItem, title: e.target.value })} placeholder="Ex: Cadastro de Contas" className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Página *</Label>
              <Select value={newSubSubmenuItem.url} onValueChange={(v) => {
                const paginaSelecionada = PAGINAS_DISPONIVEIS.find(p => p.nome === v);
                setNewSubSubmenuItem({ ...newSubSubmenuItem, url: v, title: newSubSubmenuItem.title || paginaSelecionada?.titulo || "" });
              }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione a página" /></SelectTrigger>
                <SelectContent>
                  {PAGINAS_DISPONIVEIS.map(pag => (
                    <SelectItem key={pag.nome} value={pag.nome} className="text-xs">{pag.titulo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAddSubSubmenu(false)} size="sm" className="h-8 text-xs">Cancelar</Button>
              <Button onClick={handleAddSubSubmenuItem} size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700">Adicionar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditMenuItem} onOpenChange={setShowEditMenuItem}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Editar Menu</DialogTitle>
            <DialogDescription className="text-xs">Altere título, página ou ícone</DialogDescription>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-2.5">
              <div className="space-y-1.5">
                <Label className="text-xs">Título *</Label>
                <Input value={editingItem.title} onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })} className="h-8 text-xs" />
              </div>
              {editingItem.url !== undefined && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Página</Label>
                  <Select value={editingItem.url || ''} onValueChange={(v) => setEditingItem({ ...editingItem, url: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione a página" /></SelectTrigger>
                    <SelectContent>
                      {PAGINAS_DISPONIVEIS.map(pag => (
                        <SelectItem key={pag.nome} value={pag.nome} className="text-xs">{pag.titulo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Ícone</Label>
                <Select value={editingItem.icon} onValueChange={(v) => setEditingItem({ ...editingItem, icon: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ICONS_DISPONIVEIS.map(iconName => (
                      <SelectItem key={iconName} value={iconName} className="text-xs">{iconName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowEditMenuItem(false)} size="sm" className="h-8 text-xs">Cancelar</Button>
                <Button onClick={handleEditMenuItem} size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700">
                  <Check className="w-3 h-3 mr-1" />Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}