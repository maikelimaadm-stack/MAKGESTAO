import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import {
  Scale, FileText, Users, LogOut, Package, Shield, FolderOpen, Cloud,
  Thermometer, Building2, TrendingUp, ArrowRightLeft, DollarSign, Home, Map, ClipboardList,
  BookOpen, Settings, ChevronDown, Bell, User, Menu, CloudRain, CloudOff, Wifi, Search, X, ChevronRight, EyeOff, Eye, Loader2, Sparkles, Mail } from
"lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger } from
"@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
"@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger } from
"@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle } from
"@/components/ui/dialog";

import SplashScreen from "@/components/common/SplashScreen";
import BackButton from "@/components/common/BackButton";
import SendEmailDialog from "@/components/email/SendEmailDialog";
import PermissionAlertDialog from "@/components/common/PermissionAlertDialog";
import MobileSyncAction from "@/components/offline/MobileSyncAction";
import { flattenMenuPages, findMenuItemByUrl, getAllPages as getConfiguredPages } from "@/lib/menuConfig";
import { ACTION_LABELS, canAccessModule, canAccessPage, canPerformAction, detectPermissionAction, normalizePermissionRecord } from "@/lib/permissions";

import { AnimatePresence, motion } from "framer-motion";

const iconsMap = {
  Home, Scale, TrendingUp, ArrowRightLeft, DollarSign, BookOpen, FolderOpen,
  FileText, Shield, Package, Users, Settings
};

const FIXED_MOBILE_NAV_ITEMS = [
{ id: "dashboard", url: "Home", category: "DASHBOARD", Icon: Home },
{ id: "pec-mapa-geral", url: "MapaGeral", category: "MAPA GERAL MANEJO", Icon: Map },
{ id: "gt-lancamentos", url: "LancamentosTarefas", category: "LANCAMENTOS TAREFAS", Icon: ClipboardList },
{ id: "pec-lanc-pesagens", url: "LancamentoPesagensIndividuais", category: "LANCAMENTO PESAGENS", Icon: Scale }];


const DEFAULT_MENU = [
{ id: "dashboard", title: "Dashboard", url: "Home", icon: "Home" },
{ id: "pesagens", title: "Pesagens", url: "Pesagens", icon: "Scale" },
{ id: "custos", title: "Custos de Safra", url: "CustosSafra", icon: "TrendingUp" },
{ id: "movimentacoes", title: "Movimentacoes Estoque", url: "MovimentacoesEstoque", icon: "ArrowRightLeft" },
{
  id: "cotacoes",
  title: "Cotacoes",
  icon: "DollarSign",
  submenu: [
  { id: "cot-produtos", title: "Cotacoes de Produtos", url: "CotacoesPecuaria" },
  { id: "cot-lotes", title: "Lotes de Animais", url: "LotesAnimaisCotacao" },
  { id: "cot-aplicacoes", title: "Aplicacoes de Medicamentos", url: "AplicacoesMedicamentos" },
  { id: "cot-simulacao", title: "Simulacao de Resultados", url: "SimulacaoResultados" }]

},
{
  id: "pecuaria",
  title: "Pecuaria",
  icon: "Package",
  submenu: [
  { id: "pec-controle", title: "Controle de Pecuaria", url: "ControlePecuaria" },
  { id: "pec-setores", title: "Cadastro de Setores", url: "CadastroSetores" },
  { id: "pec-lotes", title: "Cadastro de Lotes", url: "CadastroLotes" },
  { id: "pec-mov-lotes", title: "Movimentações de Lotes", url: "MovimentacoesLote" },
  { id: "pec-categorias-manejo", title: "Categorias de Manejo", url: "CategoriasManejo" },

  { id: "pec-dashboard-supl", title: "Dashboard Suplementacao", url: "DashboardSuplementacao" },
  { id: "pec-historico", title: "Historico de Movimentacoes", url: "HistoricoMovimentacoesPecuaria" },
  { id: "pec-pesagens-ind", title: "Pesagens Individuais", url: "PesagensIndividuais" },
  { id: "pec-lanc-pesagens", title: "Lançar Pesagens", url: "LancamentoPesagensIndividuais" },
  { id: "pec-mapa-cadastro", title: "Mapa - Areas/Pontos/Linhas", url: "MapaCadastro" },
  { id: "pec-mapa-geral", title: "Mapa Geral - Manejo", url: "MapaGeral" },
  { id: "pec-bebedouros", title: "Gestão de Bebedouros", url: "Bebedouros" },
  { id: "pec-relatorio", title: "Relatorio Suplementacao", url: "RelatorioSuplementacao" },
  { id: "pec-diagnostico-deposito", title: "Diagnóstico Depósito/Cocho", url: "DiagnosticoDepositoCocho" }]

},
{
  id: "maquinas",
  title: "Maquinas",
  icon: "Package",
  submenu: [
  { id: "maq-cadastro", title: "Cadastro de Maquinas", url: "CadastroMaquinas" },
  { id: "maq-operacoes", title: "Operacoes Agricolas", url: "OperacoesAgricolas" },
  { id: "maq-controle-areas", title: "Controle de Areas", url: "ControleAreas" },
  { id: "maq-ficha", title: "Ficha do Operador", url: "FichaOperador" },
  { id: "maq-ficha-impressao", title: "Imprimir Fichas", url: "FichaOperadorImpressao" },
  { id: "maq-ficha-combustivel", title: "Ficha Controle Combustível", url: "FichaControleCombustivel" },
  { id: "maq-lanc-abastecimento", title: "Lançamento de Abastecimento", url: "LancamentosAbastecimento" }]

},
{
  id: "gestao-tarefas",
  title: "Gestão de Tarefas",
  icon: "FolderOpen",
  submenu: [
  { id: "gt-grupos", title: "Grupos de Atividades", url: "GruposAtividades" },
  { id: "gt-tipos", title: "Tipos de Tarefa", url: "TiposTarefa" },
  { id: "gt-lancamentos", title: "Lançamentos", url: "LancamentosTarefas" }]

},

{
  id: "financeiro",
  title: "Financeiro",
  icon: "DollarSign",
  submenu: [
  { id: "fin-lancamento", title: "Lancamento Financeiro", url: "LancamentoFinanceiro" },

  { id: "fin-plano", title: "Plano de Contas", url: "PlanoContas" },
  { id: "fin-formas", title: "Formas de Pagamento", url: "FormasPagamento" },

  { id: "fin-grupos", title: "Grupos Receitas/Despesas", url: "GruposFinanceiros" },
  { id: "fin-fluxo", title: "Fluxo de Caixa", url: "FluxoCaixa" },
  { id: "fin-livro-caixa", title: "Livro-Caixa", url: "LivroCaixa" },
  { id: "fin-contas", title: "Contas Financeiras", url: "ContasFinanceiras" },
  { id: "fin-tipos-doc", title: "Tipos de Documento", url: "TiposDocumento" },
  { id: "fin-motivos-compra", title: "Motivos de Compra", url: "MotivosCompra" },
  { id: "fin-centros", title: "Centros de Custo", url: "CentrosCusto" }]

},
{
  id: "fiscal",
  title: "Fiscal",
  icon: "BookOpen",
  submenu: [
  { id: "fiscal-livros", title: "Livros Fiscais", url: "LivrosFiscais" }]

},
{
  id: "cadastros",
  title: "Cadastros",
  icon: "FolderOpen",
  submenu: [
  { id: "cad-empresa", title: "Empresa", url: "Empresa" },
  { id: "cad-mapa", title: "Mapa - Areas/Pontos/Linhas", url: "MapaCadastro" },
  { id: "cad-safras", title: "Safras", url: "GerenciarSafras" },
  { id: "cad-fornecedores", title: "Fornecedores/Clientes", url: "Fornecedores" },
  { id: "cad-produtos", title: "Produtos", url: "Produtos" },
  { id: "cad-ativos", title: "Ativos Fixos", url: "AtivosFixos" },
  { id: "cad-cidades", title: "Cidades", url: "GerenciarCidades" },
  { id: "cad-unidades", title: "Unidades de Medida", url: "UnidadesMedida" },
  { id: "cad-categorias", title: "Categorias", url: "Categorias" },
  { id: "cad-locais", title: "Locais de Estoque", url: "LocaisEstoque" },
  { id: "cad-marcas", title: "Marcas", url: "Marcas" },
  { id: "cad-centros", title: "Centros de Custo", url: "CentrosCusto" }]

},
{
  id: "relatorios",
  title: "Relatorios",
  icon: "FileText",
  submenu: [
  { id: "rel-estoque", title: "Estoque", url: "RelatoriosEstoque" },
  { id: "rel-pesagens", title: "Pesagens", url: "RelatorioPesagens" },
  { id: "rel-custos-safra", title: "Custos Safra", url: "RelatorioCustosSafra" },
  { id: "rel-entregas", title: "Historico Entregas", url: "RelatorioHistoricoEntregas" },
  { id: "rel-financeiro", title: "Financeiro", url: "RelatorioFinanceiro" },
  { id: "rel-fornecedores", title: "Fornecedores", url: "RelatorioFornecedores" },
  { id: "rel-produtos", title: "Produtos", url: "RelatorioProdutos" },
  { id: "rel-suplementacao", title: "Suplementacao", url: "RelatorioSuplementacao" },
  { id: "rel-movimentacoes-pecuaria", title: "Movimentacoes Pecuaria", url: "RelatorioMovimentacoesPecuaria" },
  { id: "rel-pesagens-ind", title: "Pesagens Individuais", url: "RelatorioPesagensIndividuais" },
  { id: "rel-fichas", title: "Fichas Personalizadas", url: "FichasPersonalizadas" },
  { id: "rel-mapa-pastos", title: "Mapa de Pastos", url: "RelatorioMapaPastos" },
  { id: "rel-pecuaria-lotacao", title: "Lotação Pecuária", url: "RelatorioPecuariaLotacao" },
  { id: "rel-gado-mapa-geral", title: "Gado Atual por Área", url: "RelatorioGadoMapaGeral" },
  { id: "rel-gestao-tarefas", title: "Gestão de Tarefas", url: "RelatorioGestaoTarefas" },
  { id: "rel-estoque-depositos", title: "Estoque Depósitos Mapa", url: "RelatorioEstoqueDepositos" }]

},
{ id: "usuarios", title: "Usuarios", url: "Usuarios", icon: "Shield" },
{ id: "editor-visual", title: "Editor Visual", url: "EditorVisualSistema", icon: "Settings" }];


const getAllPages = (menuItems) => {
  const pages = [];

  const traverse = (items, categoria = '') => {
    items.forEach((item) => {
      if (item.url) {
        pages.push({
          id: item.id,
          title: item.title,
          url: item.url,
          categoria: categoria || 'Geral'
        });
      }
      if (item.submenu) {
        traverse(item.submenu, item.title);
      }
    });
  };

  traverse(menuItems);
  return pages;
};

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [weather, setWeather] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [userPermissions, setUserPermissions] = useState(null);
  const [permissionDialog, setPermissionDialog] = useState({ open: false, title: "", description: "" });
  const permissionRedirectRef = useRef(null);
  const isChangingEmpresa = useRef(false);
  const [menuOculto, setMenuOculto] = useState(() => {
    return localStorage.getItem('menu_oculto') === 'true';
  });

  // Prevenir tradução automática do navegador
  React.useEffect(() => {
    document.documentElement.setAttribute('translate', 'no');
    document.documentElement.setAttribute('lang', 'pt-BR');
  }, []);

  // Splash: mínimo 5s; só esconder quando o app estiver pronto
  const [minTimePassed, setMinTimePassed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMinTimePassed(true), 5000);
    return () => clearTimeout(t);
  }, []);


  const [menuItems, setMenuItems] = useState(() => {
    const saved = localStorage.getItem('custom_menu');
    const menuVersion = localStorage.getItem('menu_version');
    const CURRENT_VERSION = '2026-06-17-diagnostico-deposito-v1'; // Atualizar esta versão quando adicionar novos menus

    // Se não tem menu salvo ou a versão mudou, usa o DEFAULT_MENU
    if (!saved || menuVersion !== CURRENT_VERSION) {
      localStorage.setItem('custom_menu', JSON.stringify(DEFAULT_MENU));
      localStorage.setItem('menu_version', CURRENT_VERSION);
      return DEFAULT_MENU;
    }

    try {
      return JSON.parse(saved);
    } catch {
      return DEFAULT_MENU;
    }
  });

  const [empresaSelecionada, setEmpresaSelecionada] = useState(() => {
    return localStorage.getItem('empresa_selecionada_id') || null;
  });

  // ATUALIZAR MENU - SEM LOOP!
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('custom_menu');
      if (saved) {
        try {
          setMenuItems(JSON.parse(saved));
        } catch (e) {
          console.error('Erro ao parsear menu:', e);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const { data: empresas = [], isLoading: empresasLoading } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => base44.entities.Empresa.list(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: mobileMenuIcons = [] } = useQuery({
    queryKey: ['mobile-menu-icons'],
    queryFn: async () => {
      const all = await base44.entities.ConfiguracaoIcone.list();
      return all.filter((item) => item.ativo !== false && item.tipo_entidade === 'Icone Menu Mobile');
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  // Ocultar splash somente após 5s mínimos + dados prontos
  useEffect(() => {
    if (minTimePassed && !authLoading && !empresasLoading) {
      setShowSplash(false);
    }
  }, [minTimePassed, authLoading, empresasLoading]);

  const empresaAtual = React.useMemo(() => {
    if (!empresaSelecionada || !empresas.length) return null;
    return empresas.find((e) => e.id === empresaSelecionada) || null;
  }, [empresaSelecionada, empresas]);

  // Selecionar primeira empresa SOMENTE UMA VEZ
  useEffect(() => {
    if (!empresaSelecionada && empresas.length > 0 && !isChangingEmpresa.current) {
      const primeiraEmpresa = empresas[0].id;
      setEmpresaSelecionada(primeiraEmpresa);
      localStorage.setItem('empresa_selecionada_id', primeiraEmpresa);
    }
  }, [empresas.length]); // Apenas quando o tamanho mudar

  const handleEmpresaChange = (empresaId) => {
    if (empresaId === empresaSelecionada) return;
    isChangingEmpresa.current = true;
    setEmpresaSelecionada(empresaId);
    localStorage.setItem('empresa_selecionada_id', empresaId);
  };

  useEffect(() => {
    const loadUser = async () => {
      try {
        let currentUser = null;
        if (navigator.onLine) {
          currentUser = await base44.auth.me();
          localStorage.setItem('offline_current_user', JSON.stringify(currentUser));
        } else {
          const cachedUser = localStorage.getItem('offline_current_user');
          currentUser = cachedUser ? JSON.parse(cachedUser) : null;
        }

        setUser(currentUser);

        // Carregar permissões do usuário
        try {
          const allPermissoes = await base44.entities.Permissao.list();
          const permissao = allPermissoes.find((p) => p.user_email === currentUser?.email);
          setUserPermissions(permissao);
        } catch (error) {
          console.error("Erro ao carregar permissões:", error);
          setUserPermissions(null);
        }
      } catch (error) {
        console.error("Erro ao carregar usuário:", error);
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    const fetchWeather = async () => {
      if (!navigator.onLine) return;
      try {
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=-15.0067&longitude=-59.9533&current=temperature_2m,precipitation&timezone=America/Cuiaba`
        );
        if (!response.ok) return;
        const data = await response.json();
        setWeather({
          temperature: Math.round(data.current.temperature_2m),
          precipitation: data.current.precipitation > 0
        });
      } catch {
        return;
      }
    };
    fetchWeather();
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);

  const handleLogout = () => {
    base44.auth.logout();
  };

  const normalizedPermissions = React.useMemo(() => normalizePermissionRecord(userPermissions), [userPermissions]);
  const isAdminUser = React.useMemo(() => Boolean(user?.role === 'admin' || normalizedPermissions?.is_admin), [user?.role, normalizedPermissions]);

  const openPermissionDialog = (title, description, redirectTo = null) => {
    permissionRedirectRef.current = redirectTo;
    setPermissionDialog({ open: true, title, description });
  };

  const closePermissionDialog = (open) => {
    setPermissionDialog((prev) => ({ ...prev, open }));
    if (!open && permissionRedirectRef.current) {
      navigate(permissionRedirectRef.current);
      permissionRedirectRef.current = null;
    }
  };

  const filterMenuByPermissions = (items, parentModuleId = null) => {
    return items.
    map((item) => {
      const moduleId = parentModuleId || item.id;

      if (item.submenu?.length) {
        const filteredSubmenu = filterMenuByPermissions(item.submenu, item.id);
        if (!canAccessModule(normalizedPermissions, item.id) || filteredSubmenu.length === 0) return null;
        return { ...item, submenu: filteredSubmenu };
      }

      if (!canAccessPage(normalizedPermissions, item.id, moduleId)) return null;
      return item;
    }).
    filter(Boolean);
  };

  const menuItemsFiltered = React.useMemo(() => {
    if (!menuItems) return [];
    const filteredByPerms = filterMenuByPermissions(menuItems);
    const removePlanos = (items) =>
    items.
    filter((i) => i.id !== 'gt-planos').
    map((i) => i.submenu ? { ...i, submenu: removePlanos(i.submenu) } : i);
    return removePlanos(filteredByPerms);
  }, [menuItems, normalizedPermissions]);

  const currentMenuPage = React.useMemo(() => findMenuItemByUrl(menuItems, currentPageName), [menuItems, currentPageName]);
  const firstAllowedPage = React.useMemo(() => flattenMenuPages(menuItemsFiltered)[0] || null, [menuItemsFiltered]);
  const fixedMobileNavPages = React.useMemo(() => {
    const allPages = flattenMenuPages(menuItems);

    return FIXED_MOBILE_NAV_ITEMS.map((item) => {
      const existingPage = allPages.find((page) => page.id === item.id);
      return {
        ...item,
        title: existingPage?.title || item.id,
        url: existingPage?.url || item.url
      };
    });
  }, [menuItems]);

  const allowedMobilePageUrls = React.useMemo(
    () => new Set(flattenMenuPages(menuItemsFiltered).map((page) => page.url)),
    [menuItemsFiltered]
  );

  const allowedMobilePageIds = React.useMemo(() => {
    return new Set(flattenMenuPages(menuItemsFiltered).map((page) => page.id));
  }, [menuItemsFiltered]);

  useEffect(() => {
    if (!currentMenuPage) return;
    if (canAccessPage(normalizedPermissions, currentMenuPage.id, currentMenuPage.moduleId)) return;

    openPermissionDialog(
      "Tela bloqueada",
      "Você não tem permissão para visualizar esta tela.",
      createPageUrl(firstAllowedPage?.url || "Home")
    );
  }, [currentMenuPage, normalizedPermissions, firstAllowedPage]);

  useEffect(() => {
    if (!currentMenuPage || currentMenuPage.id === 'pec-mapa-geral') return;

    const handleBlockedActions = (event) => {
      const interactive = event.target?.closest?.("button, a, [role='button']");
      if (!interactive || interactive.closest("nav")) return;

      const label = interactive.textContent || interactive.getAttribute("aria-label") || interactive.getAttribute("title") || "";
      const action = detectPermissionAction(label);
      if (!action) return;
      if (canPerformAction(normalizedPermissions, currentMenuPage.id, currentMenuPage.moduleId, action)) return;

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }

      openPermissionDialog("Ação bloqueada", `Você não tem permissão para ${ACTION_LABELS[action]} nesta tela.`);
    };

    document.addEventListener("click", handleBlockedActions, true);
    return () => document.removeEventListener("click", handleBlockedActions, true);
  }, [currentMenuPage, normalizedPermissions]);

  const isActive = (item) => {
    if (item.url) return location.pathname === createPageUrl(item.url);
    if (item.submenu) return item.submenu.some((sub) => {
      if (sub.url) return location.pathname === createPageUrl(sub.url);
      if (sub.submenu) return sub.submenu.some((subsub) => subsub.url && location.pathname === createPageUrl(subsub.url));
      return false;
    });
    return false;
  };

  const allPages = getConfiguredPages(menuItemsFiltered);
  const filteredPages = searchTerm ?
  allPages.filter((p) =>
  p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
  p.categoria.toLowerCase().includes(searchTerm.toLowerCase())
  ) :
  allPages;

  const pagesByCategory = filteredPages.reduce((acc, page) => {
    if (!acc[page.categoria]) acc[page.categoria] = [];
    acc[page.categoria].push(page);
    return acc;
  }, {});

  const isFolha = (currentPageName || '').toLowerCase().startsWith('folha');
  const isRoot = location.pathname === createPageUrl("Home");

  const appContentOffset = isFolha ? "0px" : menuOculto ? "51px" : "91px";

  return (
    <div className="h-[100dvh] overflow-hidden bg-slate-50 safe-area-top flex flex-col" translate="no" style={{ "--app-content-offset": appContentOffset }}>
      <style>{`
        html, body { overscroll-behavior: none; }
        button, [role="button"], a { -webkit-user-select: none; user-select: none; }
        .safe-area-top { padding-top: env(safe-area-inset-top); }
        .safe-area-bottom { padding-bottom: env(safe-area-inset-bottom); }
      `}</style>
      <SplashScreen visible={showSplash} logoUrl="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/690cd380760c45b456c6ef81/9d03282ce_IMG_8919.png" />
      {!isFolha &&
      <div className="bg-white border-b border-slate-200 flex-none">
        <div className="max-w-[1600px] mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Mobile Back Button replaces logo on child routes */}
              {!isRoot && <BackButton className="mr-1" />}
              <div>
                <h1 className="font-bold text-slate-900 text-base leading-tight">
                  {empresaAtual?.apelido || empresaAtual?.nome || 'MakGestão'}
                </h1>
                <p className="text-xs text-slate-600">Sistema de Gestao</p>
              </div>
            </div>

            <div className="hidden lg:flex items-center gap-6">
              {weather &&
              <>
                  <div className="flex items-center gap-2">
                    {weather.precipitation ?
                  <CloudRain className="w-4 h-4 text-blue-500" /> :

                  <CloudOff className="w-4 h-4 text-slate-400" />
                  }
                    <span className="text-xs text-slate-700 font-medium">
                      {weather.precipitation ? 'Chuva' : 'Sem chuva'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Thermometer className="w-4 h-4 text-orange-500" />
                    <span className="text-xs text-slate-700 font-medium">
                      {weather.temperature}°C
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    
                    

                  
                  </div>
                </>
              }

              


              
            </div>

            <div className="flex items-center gap-2">
              {empresas.length > 0 &&
              <Select value={empresaSelecionada || ''} onValueChange={handleEmpresaChange}>
                  <SelectTrigger className="h-8 w-[160px] text-xs hidden lg:flex border-slate-300">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((empresa) =>
                  <SelectItem key={empresa.id} value={empresa.id} className="text-xs">
                        {empresa.apelido || empresa.nome}
                      </SelectItem>
                  )}
                  </SelectContent>
                </Select>
              }

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hidden md:inline-flex"
                onClick={() => {
                  const novoEstado = !menuOculto;
                  setMenuOculto(novoEstado);
                  localStorage.setItem('menu_oculto', novoEstado.toString());
                }}
                title={menuOculto ? "Mostrar menu" : "Ocultar menu"}>
                
                {menuOculto ? <Eye className="w-4 h-4 text-slate-600" /> : <EyeOff className="w-4 h-4 text-slate-600" />}
              </Button>

              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSearchOpen(true)}>
                <Search className="w-4 h-4 text-slate-600" />
              </Button>

              <Button variant="ghost" size="icon" className="h-8 w-8 hidden md:inline-flex">
                <Bell className="w-4 h-4 text-slate-600" />
              </Button>

              {isAdminUser &&
              <Link to={createPageUrl("ConfiguracoesGerais")}>
                  

                
                </Link>
              }

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 gap-2 px-2">
                    <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center">
                      <span className="text-slate-700 font-semibold text-xs">
                        {user?.full_name?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-slate-700 hidden lg:block">
                      {user?.full_name?.split(' ')[0] || 'Usuario'}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel className="text-xs">
                    <div className="font-semibold">{user?.full_name}</div>
                    <div className="text-slate-500 font-normal">{user?.email}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  


                  
                  {isAdminUser &&
                  <>
                      <DropdownMenuItem asChild className="text-xs">
                        


                      
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="text-xs">
                        


                      
                      </DropdownMenuItem>
                    </>
                  }
                  


                  
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-xs text-red-600">
                    <LogOut className="w-3 h-3 mr-2" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetContent side="right" className="w-72 flex flex-col">
                  <SheetHeader>
                    <SheetTitle className="text-left text-sm">Menu</SheetTitle>
                  </SheetHeader>
                  
                  {/* Seletor de Empresa no Mobile */}
                  {empresas.length > 0 &&
                  <div className="mt-4 px-2">
                      <label className="text-xs text-slate-500 mb-1 block">Empresa</label>
                      <Select value={empresaSelecionada || ''} onValueChange={handleEmpresaChange}>
                        <SelectTrigger className="h-9 text-xs w-full border-slate-300">
                          <SelectValue placeholder="Selecione a empresa" />
                        </SelectTrigger>
                        <SelectContent>
                          {empresas.map((empresa) =>
                        <SelectItem key={empresa.id} value={empresa.id} className="text-xs">
                              {empresa.apelido || empresa.nome}
                            </SelectItem>
                        )}
                        </SelectContent>
                      </Select>
                    </div>
                  }

                  <MobileSyncAction onAfterSync={() => setMobileMenuOpen(false)} />
                  
                  <div className="mt-4 space-y-1 flex-1 overflow-y-auto">
                    {menuItemsFiltered.map((item) => {
                      const Icon = iconsMap[item.icon] || Home;

                      if (item.submenu) {
                        return (
                          <div key={item.id} className="space-y-1">
                            <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-slate-700">
                              <Icon className="w-3.5 h-3.5" />
                              {item.title}
                            </div>
                            <div className="ml-3 space-y-0.5">
                              {item.submenu.sort((a, b) => a.title.localeCompare(b.title)).map((sub) => {
                                // Se tem submenu aninhado (3 níveis)
                                if (sub.submenu && sub.submenu.length > 0) {
                                  return (
                                    <div key={sub.id} className="space-y-0.5">
                                      <div className="px-2 py-1 text-xs font-medium text-slate-500">{sub.title}</div>
                                      {sub.submenu.sort((a, b) => a.title.localeCompare(b.title)).map((subsub) =>
                                      <Link
                                        key={subsub.id}
                                        to={createPageUrl(subsub.url)}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className={`block px-4 py-1.5 text-xs rounded ${
                                        location.pathname === createPageUrl(subsub.url) ?
                                        'bg-emerald-100 text-emerald-800 font-medium' :
                                        'text-slate-600 hover:bg-slate-50'}`
                                        }>
                                        
                                          {subsub.title}
                                        </Link>
                                      )}
                                    </div>);

                                }
                                // Item normal com URL
                                if (!sub.url) return null;
                                return (
                                  <Link
                                    key={sub.id}
                                    to={createPageUrl(sub.url)}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={`block px-2 py-1.5 text-xs rounded ${
                                    location.pathname === createPageUrl(sub.url) ?
                                    'bg-emerald-100 text-emerald-800 font-medium' :
                                    'text-slate-600 hover:bg-slate-50'}`
                                    }>
                                    
                                    {sub.title}
                                  </Link>);

                              })}
                            </div>
                          </div>);

                      }

                      return (
                        <Link
                          key={item.id}
                          to={createPageUrl(item.url)}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center gap-2 px-2 py-1.5 text-xs rounded ${
                          location.pathname === createPageUrl(item.url) ?
                          'bg-emerald-100 text-emerald-800 font-medium' :
                          'text-slate-600 hover:bg-slate-50'}`
                          }>
                          
                          <Icon className="w-3.5 h-3.5" />
                          {item.title}
                        </Link>);

                    })}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </div>
      }

      {!isFolha &&
      <nav className={`flex-none bg-white border-b border-slate-200 shadow-sm transition-all duration-300 hidden md:block ${menuOculto ? 'md:h-0 md:overflow-hidden md:border-0 md:py-0' : ''}`}>
        <div className="max-w-[1600px] mx-auto px-4">
          <div className="flex items-center gap-0.5 h-10">
            <div className="hidden md:flex items-center gap-0.5">
              {menuItemsFiltered.map((item) => {
                const Icon = iconsMap[item.icon] || Home;
                const active = isActive(item);

                if (item.submenu) {
                  return (
                    <div key={item.id} className="relative group">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-8 px-2.5 gap-1 text-xs font-medium rounded ${
                        active ?
                        'bg-emerald-600 text-white hover:bg-emerald-700' :
                        'text-slate-700 hover:text-slate-900 hover:bg-slate-100'}`
                        }>
                        
                        
                        {item.title}
                        <ChevronDown className="w-3 h-3 opacity-50" />
                      </Button>
                      
                      <div className="absolute left-0 mt-1 w-52 bg-white rounded-md shadow-lg border border-slate-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                        <div className="py-1">
                          {item.submenu.sort((a, b) => a.title.localeCompare(b.title)).map((sub) => {
                            if (sub.submenu && sub.submenu.length > 0) {
                              return (
                                <div key={sub.id} className="relative group/sub">
                                  <div className={`flex items-center justify-between px-4 py-2 text-xs hover:bg-slate-50 cursor-pointer ${
                                  sub.url && location.pathname === createPageUrl(sub.url) ?
                                  'bg-emerald-50 text-emerald-800 font-medium' :
                                  'text-slate-700'}`
                                  }>
                                    <span>{sub.title}</span>
                                    <ChevronRight className="w-3 h-3 opacity-50" />
                                  </div>
                                  
                                  <div className="absolute left-full top-0 ml-1 w-52 bg-white rounded-md shadow-lg border border-slate-200 opacity-0 invisible group-hover/sub:opacity-100 group-hover/sub:visible transition-all duration-200 z-50">
                                    <div className="py-1">
                                      {sub.submenu.sort((a, b) => a.title.localeCompare(b.title)).map((subsub) => {
                                        if (!subsub.url) return null;
                                        return (
                                          <Link
                                            key={subsub.id}
                                            to={createPageUrl(subsub.url)}
                                            className={`block px-4 py-2 text-xs hover:bg-slate-50 ${
                                            location.pathname === createPageUrl(subsub.url) ?
                                            'bg-emerald-50 text-emerald-800 font-medium' :
                                            'text-slate-700'}`
                                            }>
                                            
                                            {subsub.title}
                                          </Link>);

                                      })}
                                    </div>
                                  </div>
                                </div>);

                            }

                            return (
                              <Link
                                key={sub.id}
                                to={createPageUrl(sub.url)}
                                className={`block px-4 py-2 text-xs hover:bg-slate-50 ${
                                location.pathname === createPageUrl(sub.url) ?
                                'bg-emerald-50 text-emerald-800 font-medium' :
                                'text-slate-700'}`
                                }>
                                
                                {sub.title}
                              </Link>);

                          })}
                        </div>
                      </div>
                    </div>);

                }

                return (
                  <Link key={item.id} to={createPageUrl(item.url)}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-8 px-2.5 gap-1 text-xs font-medium rounded ${
                      active ?
                      'bg-emerald-600 text-white hover:bg-emerald-700' :
                      'text-slate-700 hover:text-slate-900 hover:bg-slate-100'}`
                      }>
                      
                      
                      {item.title}
                    </Button>
                  </Link>);

              })}
            </div>
          </div>
        </div>
      </nav>
      }

      <SendEmailDialog
        open={showEmailDialog}
        onOpenChange={setShowEmailDialog}
        senderEmail="suporte@makestaopecuaria.com"
        senderName={empresaAtual?.apelido || empresaAtual?.nome || "MakGestão Pecuária"} />
      

      <PermissionAlertDialog
        open={permissionDialog.open}
        onOpenChange={closePermissionDialog}
        title={permissionDialog.title}
        description={permissionDialog.description} />
      

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Search className="w-4 h-4 text-emerald-600" />
              Buscar em todo o sistema
            </DialogTitle>
          </DialogHeader>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Digite para buscar paginas..."
              className="pl-10 h-10"
              autoFocus />
            
            {searchTerm &&
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8"
              onClick={() => setSearchTerm("")}>
              
                <X className="w-4 h-4" />
              </Button>
            }
          </div>

          <div className="flex-1 overflow-auto mt-4">
            {Object.keys(pagesByCategory).length === 0 ?
            <div className="text-center py-12 text-slate-500">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Nenhuma pagina encontrada</p>
              </div> :

            <div className="space-y-4">
                {Object.entries(pagesByCategory).
              sort(([a], [b]) => a.localeCompare(b)).
              map(([categoria, pages]) =>
              <div key={categoria}>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2 px-2">{categoria}</h3>
                    <div className="space-y-1">
                      {pages.sort((a, b) => a.title.localeCompare(b.title)).map((page) =>
                  <Link
                    key={page.id}
                    to={createPageUrl(page.url)}
                    onClick={() => {setSearchOpen(false);setSearchTerm("");}}
                    className="block px-3 py-2 text-sm hover:bg-emerald-50 rounded-md transition-colors">
                    
                          <div className="font-medium text-slate-900">{page.title}</div>
                          <div className="text-xs text-slate-500">{categoria}</div>
                        </Link>
                  )}
                    </div>
                  </div>
              )}
              </div>
            }
          </div>
        </DialogContent>
      </Dialog>


      <main className={(isFolha ? "max-w-none" : "max-w-[1600px] mx-auto") + " flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden pb-16 md:pb-0"}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ x: 30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative min-h-full">
            
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile bottom navigation */}
      {!isFolha &&
      <nav className="fixed bottom-0 inset-x-0 md:hidden bg-white border-t border-slate-200 shadow-lg safe-area-bottom">
          <div className="max-w-[1600px] mx-auto px-4 py-2 grid grid-cols-5 gap-3">
            {fixedMobileNavPages.map((page) => {
            const isCurrent = location.pathname === createPageUrl(page.url);
            const hasAccess = allowedMobilePageUrls.has(page.url);
            const Icon = page.Icon;

            return hasAccess ?
            <Link
              key={page.id}
              to={createPageUrl(page.url)}
              aria-label={page.label}
              className={`flex items-center justify-center h-12 rounded-xl border transition-colors ${isCurrent ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-600'}`}>
                <Icon className="w-6 h-6" />
                </Link> :

            <button
              key={page.id}
              type="button"
              aria-label={page.label}
              onClick={() => openPermissionDialog("Tela bloqueada", "Você não tem permissão para visualizar esta tela.")}
              className="flex items-center justify-center h-12 rounded-xl border bg-white border-slate-200 text-slate-300">
                <Icon className="w-6 h-6" />
              </button>;


          })}
            <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Menu"
            className="flex items-center justify-center h-12 rounded-xl border bg-white border-slate-200 text-slate-600">
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </nav>
      }

      </div>);

}

export const getEmpresaSelecionada = () => {
  return localStorage.getItem('empresa_selecionada_id');
};