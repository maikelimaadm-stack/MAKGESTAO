import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import ConfiguracaoColunasMapaDialog from "@/components/mapa/ConfiguracaoColunasMapaDialog";
import { MoreVertical, Filter, X, ArrowDownAZ, ArrowUpZA, GripVertical, Loader2 } from "lucide-react";

const COLUNAS_DISPONIVEIS = [
  { id: "selecao", label: "Seleção", default: true, fixo: true, width: 25 },
  { id: "acoes", label: "Ações", default: true, fixo: true, width: 25 },
  { id: "numero", label: "Nº", default: true, sortable: true, align: "left", width: 70 },
  { id: "nome", label: "Nome do Produto", default: true, sortable: true, align: "left", width: 260 },
  { id: "tipo_uso", label: "Tipo de Uso", default: true, sortable: true, align: "left", width: 130 },
  { id: "codigo", label: "Código Interno", default: true, sortable: true, align: "left", width: 120 },
  { id: "categoria", label: "Categoria", default: true, sortable: true, align: "left", width: 140 },
  { id: "marca", label: "Marca", default: true, sortable: true, align: "left", width: 140 },
  { id: "unidade", label: "Unidade", default: true, sortable: true, align: "left", width: 80 },
  { id: "preco_custo", label: "Preço Custo", default: true, sortable: true, align: "right", width: 110 },
  { id: "preco_venda", label: "Preço Venda", default: true, sortable: true, align: "right", width: 110 },
  { id: "estoque", label: "Estoque Atual", default: true, sortable: true, align: "right", width: 110 },
  { id: "estoque_min", label: "Estoque Mínimo", default: false, sortable: true, align: "right", width: 110 },
  { id: "barras", label: "Cód. Barras", default: false, sortable: true, align: "left", width: 140 },
  { id: "local", label: "Local Estoque", default: false, sortable: true, align: "left", width: 140 },
  { id: "tipo_consumo", label: "Tipo Consumo", default: false, sortable: true, align: "left", width: 120 },
  { id: "ativo", label: "Ativo", default: true, sortable: true, align: "center", width: 80 },
];

const DEFAULT_VISIBLE = COLUNAS_DISPONIVEIS.filter(c => c.default).map(c => c.id);
const STORAGE_PREFIX = "colunas_produtos_v2";
const COLUMN_WIDTHS_KEY = `${STORAGE_PREFIX}_largura`;
const MIN_COLUMN_WIDTH = 80;

const formatarNumero = (numero) => {
  if (numero === null || numero === undefined || numero === "") return "0,00";
  return Number(numero).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

function getFieldValue(item, colunaId) {
  if (colunaId === "numero") return item.numero_produto || "";
  if (colunaId === "nome") return item.nome_produto || "";
  if (colunaId === "tipo_uso") return item.tipo_uso || "";
  if (colunaId === "codigo") return item.codigo_interno || "";
  if (colunaId === "categoria") return item.categoria || "";
  if (colunaId === "marca") return item.marca || "";
  if (colunaId === "unidade") return item.unidade_medida || "";
  if (colunaId === "preco_custo") return String(item.preco_custo || 0);
  if (colunaId === "preco_venda") return String(item.preco_venda || 0);
  if (colunaId === "estoque") return String(item.estoque_atual || 0);
  if (colunaId === "estoque_min") return String(item.estoque_minimo || 0);
  if (colunaId === "barras") return item.codigo_barras || "";
  if (colunaId === "local") return item.local_estoque || "";
  if (colunaId === "tipo_consumo") return item.tipo_consumo || "";
  if (colunaId === "ativo") return item.ativo !== false ? "Ativo" : "Inativo";
  return "";
}

export default function TabelaProdutos({
  produtos = [], onEdit, onDelete, onPrint, isLoading, showConfigColunas, setShowConfigColunas
}) {
  const [selectedItems, setSelectedItems] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: "nome", direction: "asc" });
  const [menuFiltroAberto, setMenuFiltroAberto] = useState(null);
  const [buscaFiltroMenu, setBuscaFiltroMenu] = useState("");
  const [filtroTemp, setFiltroTemp] = useState({ colunaId: null, valores: [] });
  const [filtrosColunas, setFiltrosColunas] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState({ current: 0, total: 0 });
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const [columnWidths, setColumnWidths] = useState(() => {
    const defaults = Object.fromEntries(COLUNAS_DISPONIVEIS.map(c => [c.id, c.width || 160]));
    const saved = localStorage.getItem(COLUMN_WIDTHS_KEY);
    if (!saved) return defaults;
    try { return { ...defaults, ...JSON.parse(saved) }; } catch { return defaults; }
  });

  const lastTapRef = useRef({ id: null, time: 0 });
  const scrollContainerRef = useRef(null);
  const tableRef = useRef(null);
  const [resizeColumnId, setResizeColumnId] = useState(null);
  const dragRef = useRef(null);

  const [colunasOrdem, setColunasOrdem] = useState(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}_ordem`);
    if (saved) { try { return JSON.parse(saved); } catch { /* fallback */ } }
    return COLUNAS_DISPONIVEIS.map(c => c.id);
  });

  const [colunasVisiveis, setColunasVisiveis] = useState(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}_visiveis`);
    if (saved) { try { return Array.from(new Set([...JSON.parse(saved), ...DEFAULT_VISIBLE.filter(id => COLUNAS_DISPONIVEIS.find(c => c.id === id)?.fixo)])); } catch { /* fallback */ } }
    return DEFAULT_VISIBLE;
  });

  useEffect(() => { localStorage.setItem(COLUMN_WIDTHS_KEY, JSON.stringify(columnWidths)); }, [columnWidths]);

  const toggleResizeMode = (colunaId) => {
    if (colunaId === "selecao" || colunaId === "acoes") return;
    setResizeColumnId(prev => prev === colunaId ? null : colunaId);
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current) return;
      if (e.cancelable) e.preventDefault();
      const clientX = e.touches?.[0]?.clientX ?? e.clientX;
      const { columnId, startX, startWidth } = dragRef.current;
      setColumnWidths(prev => ({ ...prev, [columnId]: Math.max(MIN_COLUMN_WIDTH, startWidth + (clientX - startX)) }));
    };
    const onUp = () => { if (!dragRef.current) return; dragRef.current = null; document.body.style.cursor = ""; document.body.style.userSelect = ""; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); window.removeEventListener("touchmove", onMove); window.removeEventListener("touchend", onUp); };
  }, []);

  const startDragResize = (e, colunaId) => {
    e.preventDefault(); e.stopPropagation();
    const clientX = e.touches?.[0]?.clientX ?? e.clientX;
    dragRef.current = { columnId: colunaId, startX: clientX, startWidth: columnWidths[colunaId] || 160 };
    document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none";
  };

  useEffect(() => { setSelectedItems(prev => prev.filter(id => produtos.some(p => p.id === id))); }, [produtos]);

  const produtosFiltrados = useMemo(() => {
    return produtos.filter(p => {
      return COLUNAS_DISPONIVEIS.filter(c => !c.fixo).every(col => {
        const filtro = filtrosColunas[col.id] || [];
        if (filtro.length === 0) return true;
        return filtro.includes(getFieldValue(p, col.id));
      });
    });
  }, [produtos, filtrosColunas]);

  const produtosOrdenados = useMemo(() => {
    const sorted = [...produtosFiltrados];
    sorted.sort((a, b) => {
      let aVal, bVal;
      const key = sortConfig.key;
      if (["preco_custo", "preco_venda", "estoque", "estoque_min", "numero"].includes(key)) {
        const fieldMap = { numero: "numero_produto", preco_custo: "preco_custo", preco_venda: "preco_venda", estoque: "estoque_atual", estoque_min: "estoque_minimo" };
        aVal = Number(a[fieldMap[key]] || 0);
        bVal = Number(b[fieldMap[key]] || 0);
      } else {
        aVal = getFieldValue(a, key).toLowerCase();
        bVal = getFieldValue(b, key).toLowerCase();
      }
      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [produtosFiltrados, sortConfig]);

  const toggleColuna = (colunaId) => {
    const novas = colunasVisiveis.includes(colunaId) ? colunasVisiveis.filter(id => id !== colunaId) : [...colunasVisiveis, colunaId];
    setColunasVisiveis(novas);
    localStorage.setItem(`${STORAGE_PREFIX}_visiveis`, JSON.stringify(novas));
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(colunasOrdem);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);
    setColunasOrdem(items);
    localStorage.setItem(`${STORAGE_PREFIX}_ordem`, JSON.stringify(items));
  };

  const colunasOrdenadas = useMemo(() => {
    return colunasOrdem.map(id => COLUNAS_DISPONIVEIS.find(c => c.id === id)).filter(c => c && colunasVisiveis.includes(c.id));
  }, [colunasOrdem, colunasVisiveis]);

  const handleSort = (key) => setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
  const toggleSelectAll = () => {
    if (selectedItems.length === produtosOrdenados.length && produtosOrdenados.length > 0) { setSelectedItems([]); return; }
    setSelectedItems(produtosOrdenados.map(r => r.id));
  };

  const handleRowTouch = (item, event) => {
    const now = Date.now();
    if (lastTapRef.current.id === item.id && now - lastTapRef.current.time < 300) { event.preventDefault(); onEdit(item); }
    lastTapRef.current = { id: item.id, time: now };
  };

  const hasActiveFilter = (colunaId) => (filtrosColunas[colunaId] || []).length > 0;
  const getValoresFiltro = (colunaId) => filtrosColunas[colunaId] || [];
  const setValoresFiltro = (colunaId, values) => setFiltrosColunas(prev => ({ ...prev, [colunaId]: values }));
  const clearColumnFilter = (colunaId) => setValoresFiltro(colunaId, []);

  const columnOptions = useMemo(() => {
    const opts = {};
    COLUNAS_DISPONIVEIS.filter(c => !c.fixo).forEach(col => {
      opts[col.id] = [...new Set(produtos.map(item => getFieldValue(item, col.id)).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" }));
    });
    return opts;
  }, [produtos]);

  const executeBulkDelete = async () => {
    setBulkDeleteConfirm(false);
    setIsDeletingBulk(true);
    setDeleteProgress({ current: 0, total: selectedItems.length });
    let deleted = 0;
    for (const id of selectedItems) {
      try { await onDelete(id, true); deleted += 1; } catch { /* skip */ }
      setDeleteProgress({ current: deleted, total: selectedItems.length });
    }
    setTimeout(() => { setIsDeletingBulk(false); setSelectedItems([]); }, 500);
  };

  const deleteProgressPercentage = deleteProgress.total > 0 ? Math.round((deleteProgress.current / deleteProgress.total) * 100) : 0;

  const renderCell = (produto, colunaId) => {
    const estoqueAbaixoMinimo = Number(produto.estoque_atual || 0) <= Number(produto.estoque_minimo || 0);
    if (colunaId === "numero") return <span className="font-mono">{produto.numero_produto || "-"}</span>;
    if (colunaId === "nome") return <span className={`uppercase ${produto.ativo === false ? 'text-slate-400 line-through' : ''}`}>{produto.nome_produto || "-"}</span>;
    if (colunaId === "tipo_uso") return produto.tipo_uso || "-";
    if (colunaId === "codigo") return produto.codigo_interno || "-";
    if (colunaId === "categoria") return produto.categoria || "-";
    if (colunaId === "marca") return produto.marca || "-";
    if (colunaId === "unidade") return produto.unidade_medida || "-";
    if (colunaId === "preco_custo") return `R$ ${formatarNumero(produto.preco_custo || 0)}`;
    if (colunaId === "preco_venda") return `R$ ${formatarNumero(produto.preco_venda || 0)}`;
    if (colunaId === "estoque") return <span className={estoqueAbaixoMinimo ? "text-red-600 font-semibold" : "font-semibold"}>{formatarNumero(produto.estoque_atual || 0)}</span>;
    if (colunaId === "estoque_min") return formatarNumero(produto.estoque_minimo || 0);
    if (colunaId === "barras") return produto.codigo_barras || "-";
    if (colunaId === "local") return produto.local_estoque || "-";
    if (colunaId === "tipo_consumo") return produto.tipo_consumo || "-";
    if (colunaId === "ativo") return produto.ativo !== false ? <Badge className="text-[10px] bg-emerald-100 text-emerald-700">Ativo</Badge> : <Badge className="text-[10px] bg-slate-100 text-slate-500">Inativo</Badge>;
    return "-";
  };

  const renderFilterControl = (colunaId) => {
    const buttonClass = `h-3 w-3 min-w-3 p-0 ${hasActiveFilter(colunaId) ? "text-emerald-600" : "text-slate-300 hover:text-slate-400"}`;
    const columnLabel = COLUNAS_DISPONIVEIS.find(c => c.id === colunaId)?.label || colunaId;
    const options = columnOptions[colunaId] || [];
    const valoresSelecionados = filtroTemp.colunaId === colunaId ? filtroTemp.valores : getValoresFiltro(colunaId);
    const filteredOptions = options.filter(o => String(o).toLowerCase().includes(buscaFiltroMenu.toLowerCase()));
    const allVisibleSelected = filteredOptions.length > 0 && filteredOptions.every(o => valoresSelecionados.includes(o));

    return (
      <Popover open={menuFiltroAberto === colunaId} onOpenChange={(open) => {
        setMenuFiltroAberto(open ? colunaId : null);
        setBuscaFiltroMenu("");
        setFiltroTemp(open ? { colunaId, valores: [...getValoresFiltro(colunaId)] } : { colunaId: null, valores: [] });
      }}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className={buttonClass}><Filter className="w-2 h-2" /></Button>
        </PopoverTrigger>
        <PopoverContent align="end" side="bottom" sideOffset={4} className="w-[310px] p-0 z-[9999]">
          <div className="p-1 space-y-0.5 border-b">
            <button type="button" className="flex items-center w-full px-2 h-8 text-xs hover:bg-slate-100 rounded" onClick={() => { handleSort(colunaId); setMenuFiltroAberto(null); }}>
              <ArrowDownAZ className="w-4 h-4 mr-2" /> Classificar do Menor para o Maior
            </button>
            <button type="button" className="flex items-center w-full px-2 h-8 text-xs hover:bg-slate-100 rounded" onClick={() => { setSortConfig({ key: colunaId, direction: "desc" }); setMenuFiltroAberto(null); }}>
              <ArrowUpZA className="w-4 h-4 mr-2" /> Classificar do Maior para o Menor
            </button>
            <button type="button" className={`flex items-center w-full px-2 h-8 text-xs rounded ${hasActiveFilter(colunaId) ? 'hover:bg-slate-100 text-slate-700' : 'text-slate-300 cursor-not-allowed'}`} disabled={!hasActiveFilter(colunaId)} onClick={() => { clearColumnFilter(colunaId); setMenuFiltroAberto(null); }}>
              <X className="w-4 h-4 mr-2" /> Limpar Filtro de "{columnLabel}"
            </button>
          </div>
          <div className="p-2 space-y-2">
            <Input value={buscaFiltroMenu} onChange={(e) => setBuscaFiltroMenu(e.target.value)} placeholder="PESQUISAR" className="h-8 text-xs uppercase" />
            <div className="border border-slate-300 rounded-sm max-h-64 overflow-y-auto p-1 bg-white">
              <label className="flex h-8 items-center gap-2 px-2 py-0 text-xs text-slate-700 border-b border-slate-200 whitespace-nowrap overflow-hidden">
                <Checkbox checked={allVisibleSelected} onCheckedChange={(checked) => {
                  setFiltroTemp(prev => {
                    const restantes = prev.valores.filter(v => !filteredOptions.includes(v));
                    return { ...prev, valores: checked ? [...new Set([...restantes, ...filteredOptions])] : restantes };
                  });
                }} className="h-3.5 w-3.5 shrink-0" />
                <span className="block flex-1 overflow-hidden text-ellipsis whitespace-nowrap">(Selecionar Tudo)</span>
              </label>
              {filteredOptions.map(option => (
                <label key={option} className="flex h-6 items-center gap-2 px-2 py-0 text-xs text-slate-700 hover:bg-slate-50 whitespace-nowrap overflow-hidden">
                  <Checkbox checked={valoresSelecionados.includes(option)} onCheckedChange={(checked) => {
                    setFiltroTemp(prev => ({ ...prev, valores: checked ? [...prev.valores, option] : prev.valores.filter(i => i !== option) }));
                  }} className="h-3.5 w-3.5 shrink-0" />
                  <span className="block flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{option}</span>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setMenuFiltroAberto(null); setBuscaFiltroMenu(""); setFiltroTemp({ colunaId: null, valores: [] }); }}>Cancelar</Button>
              <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setValoresFiltro(colunaId, filtroTemp.valores); setMenuFiltroAberto(null); setBuscaFiltroMenu(""); setFiltroTemp({ colunaId: null, valores: [] }); }}>OK</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <>
      <div className="space-y-1 overflow-hidden">
        <div className="flex justify-between items-center px-1 gap-2 flex-wrap">
          <div className="text-xs text-slate-500">{produtosFiltrados.length} de {produtos.length} registros</div>
          <div className="flex gap-2 flex-wrap">
            {selectedItems.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs">Ações ({selectedItems.length})</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel className="text-xs">Ações em Lote</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => { selectedItems.forEach(id => { const p = produtos.find(x => x.id === id); if (p) onPrint(p); }); }} className="text-xs">Imprimir Todos</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setBulkDeleteConfirm(true)} className="text-xs text-red-600">Excluir Selecionados</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setSelectedItems([])} className="text-xs">Limpar Seleção</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-0 overflow-hidden">
            <div className="relative overflow-hidden">
              <div ref={scrollContainerRef} className="relative w-full overflow-auto max-h-[calc(100dvh-240px)] md:max-h-[calc(100dvh-150px)]" style={{ overscrollBehavior: 'none', WebkitOverflowScrolling: 'touch' }}>
                <Table ref={tableRef} className={`w-full ${isMobile ? "min-w-[720px]" : "min-w-[1200px]"} border-separate border-spacing-0 table-fixed`}>
                  <TableHeader className="bg-white">
                    <TableRow className="sticky top-0 z-40 bg-white">
                      {colunasOrdenadas.map(coluna => {
                        const width = columnWidths[coluna.id] || coluna.width || 160;
                        const isResizing = resizeColumnId === coluna.id;

                        if (coluna.id === "selecao") {
                          return (
                            <TableHead key="selecao" style={{ width: 25, minWidth: 25, maxWidth: 25 }} className="sticky top-0 z-40 h-7 p-0 bg-white text-muted-foreground font-medium text-center align-middle px-0 border-r border-b border-gray-200">
                              <div className="flex items-center justify-center w-full h-full">
                                <Checkbox checked={selectedItems.length === produtosOrdenados.length && produtosOrdenados.length > 0} onCheckedChange={toggleSelectAll} className="peer shrink-0 shadow disabled:opacity-50 h-4 w-4 rounded-full border-2 border-gray-400 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground" />
                              </div>
                            </TableHead>
                          );
                        }
                        if (coluna.id === "acoes") {
                          return (
                            <TableHead key="acoes" style={{ width: 25, minWidth: 25, maxWidth: 25 }} className="[&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] sticky top-0 z-40 h-7 p-0 bg-white text-muted-foreground font-medium text-center align-middle px-0 border-r border-b border-gray-200" />
                          );
                        }

                        const filterControl = renderFilterControl(coluna.id);
                        return (
                          <TableHead key={coluna.id} style={{ width, minWidth: width, maxWidth: width }} className={`sticky top-0 z-40 relative align-middle text-gray-900 px-2 pr-7 text-xs font-medium text-center border-r border-b border-gray-200 bg-white whitespace-normal break-words overflow-hidden h-7 ${coluna.align === "right" ? "text-right" : "text-left"}`}>
                            <div className={`inline-flex items-center h-full w-full overflow-hidden ${coluna.align === "right" ? "justify-end" : coluna.align === "center" ? "justify-center" : "justify-start"}`}>
                              <span className="truncate">{coluna.label}</span>
                            </div>
                            {filterControl && (
                              <div className="absolute right-1 top-1/2 -translate-y-1/2 z-50 flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                {filterControl}
                                <button type="button" className={`h-4 w-4 flex items-center justify-center rounded ${isResizing ? 'text-emerald-600 bg-emerald-100' : 'text-slate-300 hover:text-slate-500'}`} onClick={e => { e.stopPropagation(); toggleResizeMode(coluna.id); }} onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); toggleResizeMode(coluna.id); }} title="Redimensionar coluna">
                                  <GripVertical className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            )}
                            {isResizing && (
                              <div className="absolute top-0 -right-0 h-full w-5 z-50 flex items-center justify-center cursor-col-resize bg-lime-800" onMouseDown={e => startDragResize(e, coluna.id)} onTouchStart={e => startDragResize(e, coluna.id)} onClick={e => { e.stopPropagation(); setResizeColumnId(null); }} onDoubleClick={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
                                <GripVertical className="w-3.5 h-3.5 text-white" />
                              </div>
                            )}
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={colunasOrdenadas.length} className="text-center py-8 text-xs text-slate-400 border border-gray-300">Carregando...</TableCell>
                      </TableRow>
                    ) : produtosOrdenados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={colunasOrdenadas.length} className="text-center py-8 text-xs text-slate-400 border border-gray-300">Nenhum produto encontrado</TableCell>
                      </TableRow>
                    ) : (
                      produtosOrdenados.map(produto => {
                        const estoqueAbaixoMinimo = Number(produto.estoque_atual || 0) <= Number(produto.estoque_minimo || 0);
                        return (
                          <TableRow key={produto.id} className={`data-[state=selected]:bg-muted transition-colors border-b hover:bg-gray-100 ${estoqueAbaixoMinimo ? "bg-red-50/40" : ""}`} onDoubleClick={() => onEdit(produto)} onTouchEnd={(event) => handleRowTouch(produto, event)}>
                            {colunasOrdenadas.map(coluna => {
                              const width = columnWidths[coluna.id] || coluna.width || 160;
                              if (coluna.id === "selecao") {
                                return (
                                  <TableCell key={`${produto.id}-selecao`} style={{ width: 25, minWidth: 25, maxWidth: 25 }} className="p-0 text-muted-foreground font-medium text-center align-middle px-0 h-7 border-r border-b border-gray-300" onClick={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
                                    <div className="flex items-center justify-center w-full h-full">
                                      <Checkbox checked={selectedItems.includes(produto.id)} onCheckedChange={(checked) => setSelectedItems(prev => checked ? [...prev, produto.id] : prev.filter(id => id !== produto.id))} className="rounded-full peer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed shrink-0 shadow disabled:opacity-50 h-4 w-4 border-2 border-gray-400 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground" />
                                    </div>
                                  </TableCell>
                                );
                              }
                              if (coluna.id === "acoes") {
                                return (
                                  <TableCell key={`${produto.id}-acoes`} style={{ width: 25, minWidth: 25, maxWidth: 25 }} className="p-0 text-muted-foreground font-medium text-center align-middle px-0 h-7 border-r border-b border-gray-300" onClick={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
                                    <div className="flex items-center justify-center w-full h-full">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6"><MoreVertical className="w-3.5 h-3.5 text-slate-600" /></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="start">
                                          <DropdownMenuItem onClick={() => onEdit(produto)} className="text-xs">Editar</DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => onPrint(produto)} className="text-xs">Imprimir Ficha</DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem onClick={() => setDeleteConfirm(produto)} className="text-xs text-red-600">Excluir</DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </TableCell>
                                );
                              }
                              return (
                                <TableCell key={`${produto.id}-${coluna.id}`} style={{ width, minWidth: width, maxWidth: width }} className={`px-2 py-1 text-gray-700 text-xs align-middle border-r border-b border-gray-300 whitespace-normal break-words overflow-hidden ${coluna.align === "right" ? "text-right font-mono" : "uppercase"} ${coluna.align === "center" ? "text-center" : ""}`}>
                                  {renderCell(produto, coluna.id)}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfiguracaoColunasMapaDialog
        open={showConfigColunas}
        onOpenChange={setShowConfigColunas}
        colunasDisponiveis={COLUNAS_DISPONIVEIS}
        colunasVisiveis={colunasVisiveis}
        colunasOrdem={colunasOrdem}
        toggleColuna={toggleColuna}
        handleDragEnd={handleDragEnd}
        droppableId="colunas-produtos"
      />

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
        title="Confirmar exclusão"
        description="Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita."
        onConfirm={() => { onDelete(deleteConfirm.id); setDeleteConfirm(null); }}
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="destructive"
      />

      <ConfirmDialog
        open={bulkDeleteConfirm}
        onOpenChange={() => setBulkDeleteConfirm(false)}
        title="Confirmar exclusão"
        description={`Tem certeza que deseja excluir ${selectedItems.length} item(ns)? Esta ação não pode ser desfeita.`}
        onConfirm={executeBulkDelete}
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="destructive"
      />

      <Dialog open={isDeletingBulk} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-red-600" />
              Excluindo Produtos
            </DialogTitle>
            <DialogDescription>Aguarde enquanto excluímos os produtos selecionados...</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Progresso</span>
                <span className="font-semibold text-slate-900">{deleteProgress.current} de {deleteProgress.total}</span>
              </div>
              <Progress value={deleteProgressPercentage} className="h-3" />
              <p className="text-center text-sm font-medium text-red-600">{deleteProgressPercentage}%</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}