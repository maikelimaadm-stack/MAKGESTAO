import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger } from
"@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import TarefaDetalhesDialog from "@/components/tarefas/TarefaDetalhesDialog";
import ConfiguracaoColunasMapaDialog from "@/components/mapa/ConfiguracaoColunasMapaDialog";
import { MoreVertical, Filter, X, ArrowDownAZ, ArrowUpZA, GripVertical, Settings } from "lucide-react";

const escaparCsv = (valor) => `"${String(valor ?? "").replaceAll('"', '""')}"`;

const PRIORIDADE_CORES = {
  Baixa: "bg-blue-300 text-black hover:bg-blue-300",
  Média: "bg-yellow-300 text-black hover:bg-yellow-300",
  Alta: "bg-red-400 text-black hover:bg-red-400",
  Concluida: "bg-slate-300 text-black hover:bg-slate-300"
};

const STATUS_CORES = {
  Pendente: "bg-yellow-300 text-black hover:bg-yellow-300",
  "Em Andamento": "bg-blue-300 text-black hover:bg-blue-300",
  Concluída: "bg-emerald-300 text-black hover:bg-emerald-300",
  Cancelada: "bg-slate-300 text-black hover:bg-slate-300"
};

const COLUNAS_DISPONIVEIS = [
{ id: "selecao", label: "Seleção", default: true, fixo: true, width: 25 },
{ id: "acoes", label: "Ações", default: true, fixo: true, width: 25 },
{ id: "titulo", label: "Tarefa", default: true, sortable: true, align: "left", width: 220 },
{ id: "descricao", label: "Descrição", default: true, sortable: false, align: "left", width: 240 },
{ id: "prioridade", label: "Prioridade", default: true, sortable: true, align: "left", width: 120 },
{ id: "status", label: "Status", default: true, sortable: true, align: "left", width: 130 },
{ id: "grupo_atividade_nome", label: "Grupo", default: true, sortable: true, align: "left", width: 170 },
{ id: "tipo", label: "Tipo Base", default: true, sortable: true, align: "left", width: 160 },
{ id: "tipo_tarefa_nome", label: "Tipo de Tarefa", default: true, sortable: true, align: "left", width: 180 },
{ id: "setor_nome", label: "Fazenda", default: true, sortable: true, align: "left", width: 160 },
{ id: "area_nome", label: "Área", default: true, sortable: true, align: "left", width: 160 },
{ id: "solicitante", label: "Solicitante", default: true, sortable: true, align: "left", width: 160 },
{ id: "responsavel", label: "Responsável", default: true, sortable: true, align: "left", width: 160 },
{ id: "data_pedido", label: "Data Pedido", default: true, sortable: true, align: "left", width: 120 },
{ id: "data_prevista", label: "Prazo", default: true, sortable: true, align: "left", width: 120 },
{ id: "data_conclusao", label: "Conclusão", default: true, sortable: true, align: "left", width: 120 },
{ id: "observacoes", label: "Observações", default: true, sortable: false, align: "left", width: 220 },
{ id: "observacoes_conclusao", label: "Obs. Conclusão", default: true, sortable: false, align: "left", width: 220 }];


const DEFAULT_VISIBLE_COLUMNS = COLUNAS_DISPONIVEIS.filter((c) => c.default).map((c) => c.id);
const COLUMN_WIDTHS_KEY = "colunas_largura_gestao_tarefas";
const MIN_COLUMN_WIDTH = 80;

export default function TabelaLancamentosTarefas({
  tarefas = [],
  grupos = [],
  onDelete,
  onEdit,
  normalizeTaskPriority,
  showConfigColunas,
  setShowConfigColunas,
  showHeaderActions = false,
  onAdd,
  headerTitle,
  headerDescription
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroStatus, setFiltroStatus] = useState([]);
  const [filtroPrioridade, setFiltroPrioridade] = useState([]);
  const [filtroGrupo, setFiltroGrupo] = useState([]);
  const [filtroTipoTarefa, setFiltroTipoTarefa] = useState([]);
  const [filtroArea, setFiltroArea] = useState([]);
  const [filtroSetor, setFiltroSetor] = useState([]);
  const [filtroTitulo, setFiltroTitulo] = useState([]);
  const [filtroDescricao, setFiltroDescricao] = useState([]);
  const [filtroResponsavel, setFiltroResponsavel] = useState([]);
  const [filtroSolicitante, setFiltroSolicitante] = useState([]);
  const [menuFiltroAberto, setMenuFiltroAberto] = useState(null);
  const [buscaFiltroMenu, setBuscaFiltroMenu] = useState("");
  const [filtroTemp, setFiltroTemp] = useState({ colunaId: null, valores: [] });
  const [sortConfig, setSortConfig] = useState({ key: "titulo", direction: "asc" });
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const [selectedItems, setSelectedItems] = useState([]);
  const [detalheTarefa, setDetalheTarefa] = useState(null);
  const [columnWidths, setColumnWidths] = useState(() => {
    const defaults = Object.fromEntries(COLUNAS_DISPONIVEIS.map((coluna) => [coluna.id, coluna.width || 160]));
    const saved = localStorage.getItem(COLUMN_WIDTHS_KEY);
    if (!saved) return defaults;
    try {
      return { ...defaults, ...JSON.parse(saved) };
    } catch {
      return defaults;
    }
  });

  const lastTapRef = useRef({ id: null, time: 0 });
  const headerTapRef = useRef({ id: null, time: 0 });
  const scrollContainerRef = useRef(null);
  const tableRef = useRef(null);
  const [resizeColumnId, setResizeColumnId] = useState(null);
  const dragRef = useRef(null);

  const [colunasOrdem, setColunasOrdem] = useState(() => {
    const saved = localStorage.getItem("colunas_ordem_gestao_tarefas");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return COLUNAS_DISPONIVEIS.map((c) => c.id);
      }
    }
    return COLUNAS_DISPONIVEIS.map((c) => c.id);
  });

  const [colunasVisiveis, setColunasVisiveis] = useState(() => {
    const saved = localStorage.getItem("colunas_visiveis_gestao_tarefas");
    if (saved) {
      try {
        return Array.from(new Set([...JSON.parse(saved), ...DEFAULT_VISIBLE_COLUMNS]));
      } catch {
        return DEFAULT_VISIBLE_COLUMNS;
      }
    }
    return DEFAULT_VISIBLE_COLUMNS;
  });

  useEffect(() => {
    localStorage.setItem(COLUMN_WIDTHS_KEY, JSON.stringify(columnWidths));
  }, [columnWidths]);

  const toggleResizeMode = (colunaId) => {
    if (colunaId === "selecao" || colunaId === "acoes") return;
    setResizeColumnId((prev) => prev === colunaId ? null : colunaId);
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current) return;
      if (e.cancelable) e.preventDefault();
      const clientX = e.touches?.[0]?.clientX ?? e.clientX;
      const { columnId, startX, startWidth } = dragRef.current;
      const nextWidth = Math.max(MIN_COLUMN_WIDTH, startWidth + (clientX - startX));
      setColumnWidths((prev) => ({ ...prev, [columnId]: nextWidth }));
    };
    const onUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, []);

  const startDragResize = (e, colunaId) => {
    e.preventDefault();
    e.stopPropagation();
    const clientX = e.touches?.[0]?.clientX ?? e.clientX;
    dragRef.current = { columnId: colunaId, startX: clientX, startWidth: columnWidths[colunaId] || 160 };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    setSelectedItems((prev) => prev.filter((id) => tarefas.some((item) => item.id === id)));
  }, [tarefas]);



  const toggleColuna = (colunaId) => {
    const novas = colunasVisiveis.includes(colunaId) ?
    colunasVisiveis.filter((id) => id !== colunaId) :
    [...colunasVisiveis, colunaId];
    setColunasVisiveis(novas);
    localStorage.setItem("colunas_visiveis_gestao_tarefas", JSON.stringify(novas));
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(colunasOrdem);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);
    setColunasOrdem(items);
    localStorage.setItem("colunas_ordem_gestao_tarefas", JSON.stringify(items));
  };

  const colunasOrdenadas = useMemo(() => {
    return colunasOrdem.
    map((id) => COLUNAS_DISPONIVEIS.find((coluna) => coluna.id === id)).
    filter((coluna) => coluna && colunasVisiveis.includes(coluna.id));
  }, [colunasOrdem, colunasVisiveis]);

  const setores = useMemo(() => [...new Set(tarefas.map((item) => item.setor_nome).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" })), [tarefas]);
  const tiposTarefa = useMemo(() => [...new Set(tarefas.map((item) => item.tipo_tarefa_nome || item.tipo).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" })), [tarefas]);
  const areas = useMemo(() => [...new Set(tarefas.flatMap((item) => item.area_nomes?.length ? item.area_nomes : (item.area_nome ? [item.area_nome] : [])).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" })), [tarefas]);
  const titulos = useMemo(() => [...new Set(tarefas.map((item) => item.titulo).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" })), [tarefas]);
  const descricoes = useMemo(() => [...new Set(tarefas.map((item) => item.descricao).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" })), [tarefas]);
  const responsaveis = useMemo(() => [...new Set(tarefas.map((item) => item.responsavel).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" })), [tarefas]);
  const solicitantes = useMemo(() => [...new Set(tarefas.map((item) => item.solicitante).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" })), [tarefas]);

  const abrirDetalhe = (tarefa) => setDetalheTarefa(tarefa);

  const handleRowTouch = (tarefa, event) => {
    const now = Date.now();
    if (lastTapRef.current.id === tarefa.id && now - lastTapRef.current.time < 300) {
      event.preventDefault();
      abrirDetalhe(tarefa);
    }
    lastTapRef.current = { id: tarefa.id, time: now };
  };

  const tarefasFiltradas = useMemo(() => {
    const incluiValor = (filtro, valor) => filtro.length === 0 || filtro.includes(String(valor || ""));

    return tarefas.filter((tarefa) => {
      const termo = searchTerm.toLowerCase();
      const prioridade = normalizeTaskPriority(tarefa.prioridade);
      const matchSearch = !termo || [
      tarefa.titulo,
      tarefa.descricao,
      tarefa.tipo,
      tarefa.tipo_tarefa_nome,
      tarefa.grupo_atividade_nome,
      tarefa.area_nome,
      tarefa.responsavel,
      tarefa.solicitante,
      tarefa.setor_nome,
      tarefa.observacoes,
      tarefa.observacoes_conclusao].
      some((value) => String(value || "").toLowerCase().includes(termo));

      const matchStatus = incluiValor(filtroStatus, tarefa.status);
      const matchPrioridade = incluiValor(filtroPrioridade, prioridade);
      const matchGrupo = incluiValor(filtroGrupo, tarefa.grupo_atividade_nome);
      const matchTipoTarefa = incluiValor(filtroTipoTarefa, tarefa.tipo_tarefa_nome || tarefa.tipo);
      const matchArea = filtroArea.length === 0 || (tarefa.area_nomes?.length > 0 ? tarefa.area_nomes.some((nome) => filtroArea.includes(String(nome || ""))) : filtroArea.includes(String(tarefa.area_nome || "")));
      const matchSetor = incluiValor(filtroSetor, tarefa.setor_nome);
      const matchTitulo = incluiValor(filtroTitulo, tarefa.titulo);
      const matchDescricao = incluiValor(filtroDescricao, tarefa.descricao);
      const matchResponsavel = incluiValor(filtroResponsavel, tarefa.responsavel);
      const matchSolicitante = incluiValor(filtroSolicitante, tarefa.solicitante);

      return matchSearch && matchStatus && matchPrioridade && matchGrupo && matchTipoTarefa && matchArea && matchSetor && matchTitulo && matchDescricao && matchResponsavel && matchSolicitante;
    });
  }, [tarefas, searchTerm, filtroStatus, filtroPrioridade, filtroGrupo, filtroTipoTarefa, filtroArea, filtroSetor, filtroTitulo, filtroDescricao, filtroResponsavel, filtroSolicitante, normalizeTaskPriority]);

  const tarefasOrdenadas = useMemo(() => {
    const sorted = [...tarefasFiltradas];
    sorted.sort((a, b) => {
      const resolve = (item) => {
        if (sortConfig.key === "prioridade") return String(normalizeTaskPriority(item.prioridade) || "").toLowerCase();
        if (sortConfig.key === "tipo_tarefa_nome") return String(item.tipo_tarefa_nome || item.tipo || "").toLowerCase();
        return String(item[sortConfig.key] || "").toLowerCase();
      };
      const aVal = resolve(a);
      const bVal = resolve(b);
      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [tarefasFiltradas, sortConfig, normalizeTaskPriority]);



  const handleSort = (key) => {
    setSortConfig((prev) => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === tarefasFiltradas.length && tarefasFiltradas.length > 0) {
      setSelectedItems([]);
      return;
    }
    setSelectedItems(tarefasFiltradas.map((item) => item.id));
  };

  const formatarData = (data) => {
    if (!data) return "-";
    const d = new Date(data + "T00:00:00");
    return d.toLocaleDateString("pt-BR");
  };

  const limparFiltros = () => {
    setSearchTerm("");
    setFiltroStatus([]);
    setFiltroPrioridade([]);
    setFiltroGrupo([]);
    setFiltroTipoTarefa([]);
    setFiltroArea([]);
    setFiltroSetor([]);
    setFiltroTitulo([]);
    setFiltroDescricao([]);
    setFiltroResponsavel([]);
    setFiltroSolicitante([]);
  };

  const exportarTabela = () => {
    const colunasExportaveis = colunasOrdenadas.filter((coluna) => !coluna.fixo);
    const tarefasSelecionadas = tarefasOrdenadas.filter((item) => selectedItems.includes(item.id));
    const header = colunasExportaveis.map((coluna) => escaparCsv(coluna.label)).join(';');
    const rows = tarefasSelecionadas.map((item) => (
      colunasExportaveis.map((coluna) => escaparCsv(String(coluna.id.startsWith('data_') ? formatarData(item[coluna.id]) : (item[coluna.id] ?? (coluna.id === 'prioridade' ? normalizeTaskPriority(item.prioridade) : ''))))).join(';')
    ));
    const csv = [header, ...rows].join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `tarefas_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderCell = (tarefa, colunaId) => {
    const prioridade = normalizeTaskPriority(tarefa.prioridade);
    const prioridadeClassName = tarefa.status === "Concluída" ? PRIORIDADE_CORES.Concluida : PRIORIDADE_CORES[prioridade] || PRIORIDADE_CORES.Baixa;

    if (colunaId === "titulo") return tarefa.titulo || "-";
    if (colunaId === "descricao") return tarefa.descricao || "-";
    if (colunaId === "prioridade") return <div className="flex items-center gap-2"><Badge className={`text-[10px] ${prioridadeClassName}`}>{prioridade || "-"}</Badge></div>;
    if (colunaId === "status") return <Badge className={`text-[10px] ${STATUS_CORES[tarefa.status] || STATUS_CORES.Pendente}`}>{tarefa.status || "-"}</Badge>;
    if (colunaId === "grupo_atividade_nome") return tarefa.grupo_atividade_nome || "-";
    if (colunaId === "tipo") return tarefa.tipo || "-";
    if (colunaId === "tipo_tarefa_nome") return tarefa.tipo_tarefa_nome || tarefa.tipo || "-";
    if (colunaId === "setor_nome") return tarefa.setor_nome || "-";
    if (colunaId === "area_nome") return (tarefa.area_nomes?.length > 0 ? tarefa.area_nomes.join(", ") : tarefa.area_nome) || "-";
    if (colunaId === "responsavel") return tarefa.responsavel || "-";
    if (colunaId === "data_pedido") return formatarData(tarefa.data_pedido);
    if (colunaId === "data_prevista") return formatarData(tarefa.data_prevista);
    if (colunaId === "data_conclusao") return formatarData(tarefa.data_conclusao);
    if (colunaId === "solicitante") return tarefa.solicitante || "-";
    if (colunaId === "observacoes") return tarefa.observacoes || "-";
    if (colunaId === "observacoes_conclusao") return tarefa.observacoes_conclusao || "-";
    return "-";
  };

  const hasActiveFilter = (colunaId) => {
    return colunaId === "titulo" && filtroTitulo.length > 0 ||
    colunaId === "descricao" && filtroDescricao.length > 0 ||
    colunaId === "prioridade" && filtroPrioridade.length > 0 ||
    colunaId === "status" && filtroStatus.length > 0 ||
    colunaId === "grupo_atividade_nome" && filtroGrupo.length > 0 ||
    (colunaId === "tipo_tarefa_nome" || colunaId === "tipo") && filtroTipoTarefa.length > 0 ||
    colunaId === "setor_nome" && filtroSetor.length > 0 ||
    colunaId === "area_nome" && filtroArea.length > 0 ||
    colunaId === "responsavel" && filtroResponsavel.length > 0 ||
    colunaId === "solicitante" && filtroSolicitante.length > 0;
  };

  const getValoresFiltro = (colunaId) => {
    if (colunaId === "titulo") return filtroTitulo;
    if (colunaId === "descricao") return filtroDescricao;
    if (colunaId === "prioridade") return filtroPrioridade;
    if (colunaId === "status") return filtroStatus;
    if (colunaId === "grupo_atividade_nome") return filtroGrupo;
    if (colunaId === "tipo_tarefa_nome" || colunaId === "tipo") return filtroTipoTarefa;
    if (colunaId === "setor_nome") return filtroSetor;
    if (colunaId === "area_nome") return filtroArea;
    if (colunaId === "responsavel") return filtroResponsavel;
    if (colunaId === "solicitante") return filtroSolicitante;
    return [];
  };

  const setValoresFiltro = (colunaId, values) => {
    if (colunaId === "titulo") setFiltroTitulo(values);
    if (colunaId === "descricao") setFiltroDescricao(values);
    if (colunaId === "prioridade") setFiltroPrioridade(values);
    if (colunaId === "status") setFiltroStatus(values);
    if (colunaId === "grupo_atividade_nome") setFiltroGrupo(values);
    if (colunaId === "tipo_tarefa_nome" || colunaId === "tipo") setFiltroTipoTarefa(values);
    if (colunaId === "setor_nome") setFiltroSetor(values);
    if (colunaId === "area_nome") setFiltroArea(values);
    if (colunaId === "responsavel") setFiltroResponsavel(values);
    if (colunaId === "solicitante") setFiltroSolicitante(values);
  };

  const clearColumnFilter = (colunaId) => {
    setValoresFiltro(colunaId, []);
  };

  const getColumnOptions = (colunaId) => {
    if (colunaId === "titulo") return titulos;
    if (colunaId === "descricao") return descricoes;
    if (colunaId === "prioridade") return ["Baixa", "Média", "Alta"];
    if (colunaId === "status") return ["Pendente", "Em Andamento", "Concluída", "Cancelada"];
    if (colunaId === "grupo_atividade_nome") return grupos || [];
    if (colunaId === "tipo_tarefa_nome" || colunaId === "tipo") return tiposTarefa || [];
    if (colunaId === "setor_nome") return setores || [];
    if (colunaId === "area_nome") return areas || [];
    if (colunaId === "responsavel") return responsaveis || [];
    if (colunaId === "solicitante") return solicitantes || [];
    return [];
  };

  const renderFilterControl = (colunaId) => {
    const buttonClass = `h-3 w-3 min-w-3 p-0 ${hasActiveFilter(colunaId) ? "text-emerald-600" : "text-slate-300 hover:text-slate-400"}`;
    const columnLabel = COLUNAS_DISPONIVEIS.find((coluna) => coluna.id === colunaId)?.label || colunaId;
    const options = getColumnOptions(colunaId);
    const valoresSelecionados = filtroTemp.colunaId === colunaId ? filtroTemp.valores : getValoresFiltro(colunaId);
    const filteredOptions = options.filter((option) => String(option).toLowerCase().includes(buscaFiltroMenu.toLowerCase()));
    const allVisibleSelected = filteredOptions.length > 0 && filteredOptions.every((option) => valoresSelecionados.includes(option));

    return (
      <Popover
        open={menuFiltroAberto === colunaId}
        onOpenChange={(open) => {
          setMenuFiltroAberto(open ? colunaId : null);
          setBuscaFiltroMenu("");
          setFiltroTemp(open ? { colunaId, valores: [...getValoresFiltro(colunaId)] } : { colunaId: null, valores: [] });
        }}>
        
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className={buttonClass}>
            <Filter className="w-2 h-2" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" side="bottom" sideOffset={4} className="w-[310px] p-0 z-[9999]">
          <div className="p-1 space-y-0.5 border-b">
            <button
              type="button"
              className="flex items-center w-full px-2 h-8 text-xs hover:bg-slate-100 rounded"
              onClick={() => {handleSort(colunaId);setMenuFiltroAberto(null);}}>
              
              <ArrowDownAZ className="w-4 h-4 mr-2" />
              Classificar do Menor para o Maior
            </button>
            <button
              type="button"
              className="flex items-center w-full px-2 h-8 text-xs hover:bg-slate-100 rounded"
              onClick={() => {setSortConfig({ key: colunaId, direction: "desc" });setMenuFiltroAberto(null);}}>
              
              <ArrowUpZA className="w-4 h-4 mr-2" />
              Classificar do Maior para o Menor
            </button>
            <button
              type="button"
              className={`flex items-center w-full px-2 h-8 text-xs rounded ${hasActiveFilter(colunaId) ? 'hover:bg-slate-100 text-slate-700' : 'text-slate-300 cursor-not-allowed'}`}
              disabled={!hasActiveFilter(colunaId)}
              onClick={() => {clearColumnFilter(colunaId);setMenuFiltroAberto(null);}}>
              
              <X className="w-4 h-4 mr-2" />
              Limpar Filtro de "{columnLabel}"
            </button>
          </div>

          <div className="p-2 space-y-2">
            <Input
              value={buscaFiltroMenu}
              onChange={(e) => setBuscaFiltroMenu(e.target.value)}
              placeholder="PESQUISAR"
              className="h-8 text-xs uppercase" />
            

            <div className="border border-slate-300 rounded-sm max-h-64 overflow-y-auto p-1 bg-white">
              <label className="flex h-8 items-center gap-2 px-2 py-0 text-xs text-slate-700 border-b border-slate-200 whitespace-nowrap overflow-hidden">
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={(checked) => {
                    setFiltroTemp((prev) => {
                      const restantes = prev.valores.filter((value) => !filteredOptions.includes(value));
                      return {
                        ...prev,
                        valores: checked ? [...new Set([...restantes, ...filteredOptions])] : restantes
                      };
                    });
                  }}
                  className="h-3.5 w-3.5 shrink-0" />
                
                <span className="block flex-1 overflow-hidden text-ellipsis whitespace-nowrap">(Selecionar Tudo)</span>
              </label>
              {filteredOptions.map((option) =>
              <label key={option} className="flex h-6 items-center gap-2 px-2 py-0 text-xs text-slate-700 hover:bg-slate-50 whitespace-nowrap overflow-hidden">
                  <Checkbox
                  checked={valoresSelecionados.includes(option)}
                  onCheckedChange={(checked) => {
                    setFiltroTemp((prev) => ({
                      ...prev,
                      valores: checked ?
                      [...prev.valores, option] :
                      prev.valores.filter((item) => item !== option)
                    }));
                  }}
                  className="h-3.5 w-3.5 shrink-0" />
                
                  <span className="block flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{option}</span>
                </label>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => {
                setMenuFiltroAberto(null);
                setBuscaFiltroMenu("");
                setFiltroTemp({ colunaId: null, valores: [] });
              }}>
                Cancelar
              </Button>
              <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => {
                setValoresFiltro(colunaId, filtroTemp.valores);
                setMenuFiltroAberto(null);
                setBuscaFiltroMenu("");
                setFiltroTemp({ colunaId: null, valores: [] });
              }}>
                OK
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>);

  };

  return (
    <div className="flex flex-col h-full w-full min-w-0 space-y-1">
      {showHeaderActions &&
      <div className="bg-white px-1 py-1 rounded flex flex-col md:flex-row justify-between items-start md:items-center gap-2 shadow-sm border-b border-slate-200">
  
  <div>
    <h1 className="font-bold text-slate-900">
     {headerTitle || "Gestão de Tarefas"}
    </h1>
  </div>

  <div className="flex flex-nowrap justify-end gap-2 w-full md:w-auto">
    
    <Button
            variant="outline"
            size="icon"
            onClick={() => setShowConfigColunas?.(true)}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-7 w-7">
            
      <Settings className="w-4 h-4" />
    </Button>

    <Button
            onClick={() => onAdd?.()}
            size="sm"
            className="bg-lime-900 text-primary-foreground px-3 text-xs font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow h-7 hover:bg-emerald-600">
            
      Adicionar
    </Button>

  </div>
</div>

      }

      <div className="flex justify-between items-center px-1 gap-2 flex-wrap">
        <div className="text-xs text-slate-500">
          {tarefasFiltradas.length} de {tarefas.length} registros
        </div>
        <div className="flex gap-2 flex-wrap">
          {selectedItems.length > 0 &&
          <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs">Ações ({selectedItems.length})</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={exportarTabela} className="text-xs">Exportar Selecionados</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => {onDelete(selectedItems);setSelectedItems([]);}} className="text-xs text-red-600">Excluir Selecionados</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSelectedItems([])} className="text-xs">Limpar Seleção</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          }
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0 overflow-hidden">
          <div className="relative w-full overflow-x-auto">
            <div ref={scrollContainerRef} className="relative w-full overflow-auto max-h-[calc(100dvh-200px)]" style={{ overscrollBehavior: 'none', WebkitOverflowScrolling: 'touch' }}>
              <Table ref={tableRef} className={`${isMobile ? "min-w-[1280px]" : "min-w-[1600px]"} border-separate border-spacing-0 table-fixed`}>
              <TableHeader className="bg-white">
                <TableRow className="sticky top-0 z-40 bg-white">
                  {colunasOrdenadas.map((coluna) => {
                      const width = columnWidths[coluna.id] || coluna.width || 160;
                      const isResizing = resizeColumnId === coluna.id;

                      if (coluna.id === "selecao") {
                        return (
                          <TableHead
                            key="selecao"
                            style={{ width: 25, minWidth: 25, maxWidth: 25 }}
                            className="sticky top-0 z-40 h-7 p-0 bg-white text-muted-foreground font-medium text-center align-middle px-0 border-r border-b border-gray-200">
                            
                          <div className="flex items-center justify-center w-full h-full">
                          <Checkbox checked={selectedItems.length === tarefasFiltradas.length && tarefasFiltradas.length > 0} onCheckedChange={toggleSelectAll} className="peer shrink-0 shadow disabled:opacity-50 h-4 w-4 rounded-full border-2 border-gray-400 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground" />
                          </div>
                        </TableHead>);

                      }

                      if (coluna.id === "acoes") {
                        return (
                          <TableHead
                            key="acoes"
                            style={{ width: 25, minWidth: 25, maxWidth: 25 }}
                            className="sticky top-0 z-40 h-7 p-0 bg-white text-muted-foreground font-medium text-center align-middle px-0 border-r border-b border-gray-200" />);


                      }

                      const filterControl = renderFilterControl(coluna.id);

                      return (
                        <TableHead
                          key={coluna.id}
                          style={{ width, minWidth: width, maxWidth: width }}
                          className={`sticky top-0 z-40 relative align-middle text-gray-900 px-2 pr-7 text-xs font-medium text-center border-r border-b border-gray-200 bg-white whitespace-nowrap h-7`}>
                          
                        <div className="inline-flex items-center justify-center gap-1 h-full w-full whitespace-nowrap overflow-hidden text-ellipsis">
                          {coluna.label}
                        </div>

                        {filterControl &&
                          <div className="absolute right-1 top-1/2 -translate-y-1/2 z-50 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            {filterControl}
                            <button
                              type="button"
                              className={`h-4 w-4 flex items-center justify-center rounded ${isResizing ? 'text-emerald-600 bg-emerald-100' : 'text-slate-300 hover:text-slate-500'}`}
                              onClick={(e) => {e.stopPropagation();toggleResizeMode(coluna.id);}}
                              onTouchEnd={(e) => {e.stopPropagation();e.preventDefault();toggleResizeMode(coluna.id);}}
                              title="Redimensionar coluna">
                              
                              <GripVertical className="w-2.5 h-2.5" />
                            </button>
                          </div>
                          }

                        {isResizing &&
                          <div className="absolute top-0 -right-0 h-full w-5 z-50 flex items-center justify-center cursor-col-resize bg-lime-800 "

                          onMouseDown={(e) => startDragResize(e, coluna.id)}
                          onTouchStart={(e) => startDragResize(e, coluna.id)}
                          onClick={(e) => {e.stopPropagation();setResizeColumnId(null);}}
                          onDoubleClick={(e) => e.stopPropagation()}
                          onTouchEnd={(e) => e.stopPropagation()}>
                            
                            <GripVertical className="w-3.5 h-3.5 text-white" />
                          </div>
                          }
                      </TableHead>);

                    })}
                </TableRow>
              </TableHeader>

              <TableBody>
                {tarefasOrdenadas.length === 0 ?
                  <TableRow>
                    <TableCell colSpan={colunasOrdenadas.length} className="text-center py-8 text-xs text-slate-400 border border-gray-300">
                      Nenhuma tarefa encontrada
                    </TableCell>
                  </TableRow> :

                  tarefasOrdenadas.map((tarefa) =>
                  <TableRow
                    key={tarefa.id}
                    className="data-[state=selected]:bg-muted transition-colors border-b hover:bg-gray-100"
                    onDoubleClick={() => abrirDetalhe(tarefa)}
                    onTouchEnd={(event) => handleRowTouch(tarefa, event)}>
                    
                      {colunasOrdenadas.map((coluna) => {
                      const width = columnWidths[coluna.id] || coluna.width || 160;

                      if (coluna.id === "selecao") {
                        return (
                          <TableCell
                            key={`${tarefa.id}-selecao`}
                            style={{ width: 25, minWidth: 25, maxWidth: 25 }}
                            className="p-0 text-muted-foreground font-medium text-center align-middle px-0 h-7 border-r border-b border-gray-300"
                            onClick={(event) => event.stopPropagation()}
                            onTouchEnd={(event) => event.stopPropagation()}>
                            
                              <div className="flex items-center justify-center w-full h-full">
                              <Checkbox checked={selectedItems.includes(tarefa.id)} onCheckedChange={(checked) => setSelectedItems((prev) => checked ? [...prev, tarefa.id] : prev.filter((id) => id !== tarefa.id))} className="peer shrink-0 shadow disabled:opacity-50 h-4 w-4 rounded-full border-2 border-gray-400 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground" />
                              </div>
                            </TableCell>);

                      }

                      if (coluna.id === "acoes") {
                        return (
                          <TableCell
                            key={`${tarefa.id}-acoes`}
                            style={{ width: 25, minWidth: 25, maxWidth: 25 }}
                            className="p-0 text-muted-foreground font-medium text-center align-middle px-0 h-7 border-r border-b border-gray-300"
                            onClick={(event) => event.stopPropagation()}
                            onTouchEnd={(event) => event.stopPropagation()}>
                            
                              <div className="flex items-center justify-center w-full h-full">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6">
                                    <MoreVertical className="w-3.5 h-3.5 text-slate-600" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                  <DropdownMenuItem onClick={() => onEdit && onEdit(tarefa)} className="text-xs">
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => onDelete(tarefa.id)} className="text-xs text-red-600">
                                    Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              </div>
                            </TableCell>);

                      }

                      return (
                        <TableCell
                          key={`${tarefa.id}-${coluna.id}`}
                          style={{ width, minWidth: width, maxWidth: width }}
                          className="px-2 py-1 text-gray-700 text-xs align-middle border-r border-b border-gray-300 whitespace-normal break-words">
                          
                            {renderCell(tarefa, coluna.id)}
                          </TableCell>);

                    })}
                    </TableRow>
                  )
                  }
              </TableBody>
              </Table>
            </div>
          </div>

        </CardContent>
      </Card>


      <ConfiguracaoColunasMapaDialog
        open={showConfigColunas}
        onOpenChange={setShowConfigColunas}
        colunasDisponiveis={COLUNAS_DISPONIVEIS}
        colunasVisiveis={colunasVisiveis}
        colunasOrdem={colunasOrdem}
        toggleColuna={toggleColuna}
        handleDragEnd={handleDragEnd}
        droppableId="colunas-gestao-tarefas" />
      

      <TarefaDetalhesDialog
        open={!!detalheTarefa}
        onOpenChange={(open) => !open && setDetalheTarefa(null)}
        tarefa={detalheTarefa}
        onSaved={(updated) => setDetalheTarefa(updated)} />
      
    </div>);

}