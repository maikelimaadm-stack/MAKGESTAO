import React, { useState, useEffect, useMemo, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Settings, MoreVertical, Filter, X, ArrowDownAZ, ArrowUpZA, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import ConfiguracaoColunasMapaDialog from "@/components/mapa/ConfiguracaoColunasMapaDialog";

const getNextLocalNumber = async () => { try { const all = await base44.entities.LocalEstoque.list(); const nums = all.map(l => parseInt(l.numero_local) || 0).filter(n => n > 0); return nums.length > 0 ? Math.max(...nums) + 1 : 1; } catch { return 1; } };

const COLUNAS_DISPONIVEIS = [
  { id: 'selecao', label: 'Seleção', default: true, fixo: true, width: 25 },
  { id: 'acoes', label: 'Ações', default: true, fixo: true, width: 25 },
  { id: 'numero', label: 'Nº', default: true, sortable: true, align: 'left', width: 60 },
  { id: 'nome', label: 'Nome', default: true, sortable: true, align: 'left', width: 220 },
  { id: 'capacidade', label: 'Capacidade', default: true, sortable: true, align: 'left', width: 150 },
  { id: 'descricao', label: 'Descrição', default: true, sortable: false, align: 'left', width: 250 },
  { id: 'ativo', label: 'Ativo', default: true, sortable: true, align: 'center', width: 80 },
];
const DEFAULT_VISIBLE = COLUNAS_DISPONIVEIS.filter(c => c.default).map(c => c.id);
const STORAGE_PREFIX = "colunas_locais_estoque";
const WIDTHS_KEY = `${STORAGE_PREFIX}_largura`;
const MIN_COL_W = 60;

const FL = ({ label, required, error, children, dataField }) => (<div data-field={dataField}><label className="text-[12px] text-slate-500 pl-1 leading-none">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label><div className={`rounded-md border ${error ? 'border-red-500 bg-red-50' : 'border-slate-300'} focus-within:border-emerald-500 transition-colors`}>{children}</div></div>);

function getFieldValue(item, colId) {
  if (colId === "numero") return item.numero_local || "";
  if (colId === "nome") return item.nome || "";
  if (colId === "capacidade") return item.capacidade || "";
  if (colId === "descricao") return item.descricao || "";
  if (colId === "ativo") return item.ativo !== false ? "Ativo" : "Inativo";
  return "";
}

export default function LocaisEstoque() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ nome: "", descricao: "", capacidade: "", ativo: true });
  const [showConfigColunas, setShowConfigColunas] = useState(false);
  const [deleteState, setDeleteState] = useState({ open: false, ids: [] });
  const [selectedItems, setSelectedItems] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: "nome", direction: "asc" });
  const [menuFiltroAberto, setMenuFiltroAberto] = useState(null);
  const [buscaFiltroMenu, setBuscaFiltroMenu] = useState("");
  const [filtroTemp, setFiltroTemp] = useState({ colunaId: null, valores: [] });
  const [filtrosColunas, setFiltrosColunas] = useState({});
  const [errors, setErrors] = useState({});
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const [columnWidths, setColumnWidths] = useState(() => { const d = Object.fromEntries(COLUNAS_DISPONIVEIS.map(c => [c.id, c.width || 160])); const s = localStorage.getItem(WIDTHS_KEY); if (!s) return d; try { return { ...d, ...JSON.parse(s) }; } catch { return d; } });
  const lastTapRef = useRef({ id: null, time: 0 }); const scrollContainerRef = useRef(null); const tableRef = useRef(null); const [resizeColumnId, setResizeColumnId] = useState(null); const dragRef = useRef(null);
  const [colunasOrdem, setColunasOrdem] = useState(() => { const s = localStorage.getItem(`${STORAGE_PREFIX}_ordem`); if (s) try { return JSON.parse(s); } catch {} return COLUNAS_DISPONIVEIS.map(c => c.id); });
  const [colunasVisiveis, setColunasVisiveis] = useState(() => { const s = localStorage.getItem(`${STORAGE_PREFIX}_visiveis`); if (s) try { return Array.from(new Set([...JSON.parse(s), ...DEFAULT_VISIBLE])); } catch {} return DEFAULT_VISIBLE; });
  useEffect(() => { localStorage.setItem(WIDTHS_KEY, JSON.stringify(columnWidths)); }, [columnWidths]);
  const toggleResizeMode = (colunaId) => { if (colunaId === "selecao" || colunaId === "acoes") return; setResizeColumnId(prev => prev === colunaId ? null : colunaId); };
  useEffect(() => { const onMove = (e) => { if (!dragRef.current) return; if (e.cancelable) e.preventDefault(); const cX = e.touches?.[0]?.clientX ?? e.clientX; const { columnId, startX, startWidth } = dragRef.current; setColumnWidths(prev => ({ ...prev, [columnId]: Math.max(MIN_COL_W, startWidth + (cX - startX)) })); }; const onUp = () => { if (!dragRef.current) return; dragRef.current = null; document.body.style.cursor = ""; document.body.style.userSelect = ""; }; window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp); window.addEventListener("touchmove", onMove, { passive: false }); window.addEventListener("touchend", onUp); return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); window.removeEventListener("touchmove", onMove); window.removeEventListener("touchend", onUp); }; }, []);
  const startDragResize = (e, colunaId) => { e.preventDefault(); e.stopPropagation(); const cX = e.touches?.[0]?.clientX ?? e.clientX; dragRef.current = { columnId: colunaId, startX: cX, startWidth: columnWidths[colunaId] || 160 }; document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none"; };
  const queryClient = useQueryClient();
  const { data: locais = [], isLoading } = useQuery({ queryKey: ['locais_estoque'], queryFn: () => base44.entities.LocalEstoque.list(), initialData: [] });

  useEffect(() => { const fn = async () => { const sem = locais.filter(l => !l.numero_local); if (sem.length > 0) { for (const l of sem) { try { const n = await getNextLocalNumber(); await base44.entities.LocalEstoque.update(l.id, { numero_local: String(n) }); } catch {} } queryClient.invalidateQueries({ queryKey: ['locais_estoque'] }); } }; if (locais.length > 0) fn(); }, [locais, queryClient]);

  const createMutation = useMutation({ mutationFn: async (data) => { const n = await getNextLocalNumber(); return base44.entities.LocalEstoque.create({ ...data, numero_local: String(n) }); }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['locais_estoque'] }); setShowForm(false); setEditing(null); toast.success('Local cadastrado!'); }, onError: (err) => toast.error(err.message || 'Erro.') });

  // Sincroniza alteração de Local de Estoque com o Depósito vinculado no mapa
  const syncDepositoVinculado = async (localId, novoNome) => {
    const pontosSupl = await base44.entities.PontoSuplementacao.list();
    const pontoVinculado = pontosSupl.find((p) => p.local_estoque_id === localId && p.categoria_ponto === "DEPOSITO");
    if (!pontoVinculado) return;

    await base44.entities.PontoSuplementacao.update(pontoVinculado.id, { nome_ponto: novoNome, local_estoque_nome: novoNome });

    const pontosRef = await base44.entities.PontoReferencia.list();
    const refVinculada = pontosRef.find((r) => {
      if (!r.coordenadas || !pontoVinculado.coordenadas) return false;
      return r.coordenadas.lat === pontoVinculado.coordenadas.lat && r.coordenadas.lng === pontoVinculado.coordenadas.lng;
    });
    if (refVinculada) await base44.entities.PontoReferencia.update(refVinculada.id, { nome: novoNome });

    const cochosVinculados = pontosSupl.filter((p) => p.deposito_origem_id === pontoVinculado.id);
    await Promise.all(cochosVinculados.map((c) => base44.entities.PontoSuplementacao.update(c.id, { deposito_origem_nome: novoNome })));
  };

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const localAntigo = locais.find((l) => l.id === id);
      const updated = await base44.entities.LocalEstoque.update(id, data);
      if (localAntigo && data.nome && localAntigo.nome !== data.nome) {
        await syncDepositoVinculado(id, data.nome);
      }
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locais_estoque'] });
      queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && ["pontos", "pontos-suplementacao-form", "mapa-pontos", "mapa-pontos-supl", "pontos-suplementacao"].includes(q.queryKey[0]) });
      window.dispatchEvent(new CustomEvent("atualizar-mapa"));
      setShowForm(false); setEditing(null); toast.success('Local atualizado!');
    },
    onError: (err) => toast.error(err.message || 'Erro.')
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids) => {
      const prods = await base44.entities.Produto.list();
      const movs = await base44.entities.MovimentacaoEstoque.list();
      const lotes = await base44.entities.EstoqueLoteNota.list();
      const pontosSupl = await base44.entities.PontoSuplementacao.list();
      for (const id of ids) {
        const l = locais.find(x => x.id === id);
        const depositoVinculado = pontosSupl.find((p) => p.local_estoque_id === id && p.categoria_ponto === "DEPOSITO");
        if (depositoVinculado) throw new Error(`❌ "${l?.nome}" pertence a um depósito do mapa. Exclua pelo mapa.`);
        // Produto guarda o NOME do local; movimentações e lotes guardam o ID do local.
        if (prods.some(p => p.local_estoque === l?.nome)) throw new Error(`❌ "${l?.nome}" possui produtos vinculados!`);
        if (movs.some(m => m.local_estoque_origem === id || m.local_estoque_destino === id)) throw new Error(`❌ "${l?.nome}" possui movimentações vinculadas!`);
        if (lotes.some(le => le.local_estoque_id === id && (le.quantidade_disponivel || 0) > 0)) throw new Error(`❌ "${l?.nome}" possui saldo de estoque (lotes) vinculado!`);
        await base44.entities.LocalEstoque.delete(id);
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['locais_estoque'] }); toast.success('Local(is) excluído(s)!'); setSelectedItems([]); },
    onError: (err) => toast.error(err.message || 'Erro.')
  });

  const handleSubmit = (e) => { e.preventDefault(); const ne = {}; if (!formData.nome?.trim()) ne.nome = true; setErrors(ne); if (Object.keys(ne).length > 0) { toast.error("PREENCHA OS CAMPOS OBRIGATÓRIOS."); return; } const data = { nome: formData.nome.toUpperCase(), descricao: formData.descricao?.toUpperCase() || undefined, capacidade: formData.capacidade?.toUpperCase() || undefined, ativo: formData.ativo }; if (editing) updateMutation.mutate({ id: editing.id, data }); else createMutation.mutate(data); };
  const handleEdit = (item) => { setEditing(item); setFormData({ nome: item.nome || "", descricao: item.descricao || "", capacidade: item.capacidade || "", ativo: item.ativo !== false }); setShowForm(true); };
  const handleRequestDelete = (id) => { const ids = Array.isArray(id) ? id : [id]; setDeleteState({ open: true, ids }); };
  const handleConfirmDelete = () => { deleteMutation.mutate(deleteState.ids); setDeleteState({ open: false, ids: [] }); };

  const sortedData = useMemo(() => { let f = locais.filter(c => COLUNAS_DISPONIVEIS.filter(col => !col.fixo).every(col => { const fv = filtrosColunas[col.id] || []; if (fv.length === 0) return true; return fv.includes(getFieldValue(c, col.id)); })); if (sortConfig.key) { f.sort((a, b) => { const va = getFieldValue(a, sortConfig.key); const vb = getFieldValue(b, sortConfig.key); const cmp = va.localeCompare(vb, "pt-BR", { numeric: true, sensitivity: "base" }); return sortConfig.direction === "asc" ? cmp : -cmp; }); } return f; }, [locais, filtrosColunas, sortConfig]);

  useEffect(() => { setSelectedItems(prev => prev.filter(id => locais.some(c => c.id === id))); }, [locais]);
  const toggleColuna = (colunaId) => { const n = colunasVisiveis.includes(colunaId) ? colunasVisiveis.filter(id => id !== colunaId) : [...colunasVisiveis, colunaId]; setColunasVisiveis(n); localStorage.setItem(`${STORAGE_PREFIX}_visiveis`, JSON.stringify(n)); };
  const handleDragEnd = (result) => { if (!result.destination) return; const items = Array.from(colunasOrdem); const [r] = items.splice(result.source.index, 1); items.splice(result.destination.index, 0, r); setColunasOrdem(items); localStorage.setItem(`${STORAGE_PREFIX}_ordem`, JSON.stringify(items)); };
  const colunasOrdenadas = useMemo(() => colunasOrdem.map(id => COLUNAS_DISPONIVEIS.find(c => c.id === id)).filter(c => c && colunasVisiveis.includes(c.id)), [colunasOrdem, colunasVisiveis]);
  const handleSort = (key) => setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
  const toggleSelectAll = () => { if (selectedItems.length === sortedData.length && sortedData.length > 0) { setSelectedItems([]); return; } setSelectedItems(sortedData.map(r => r.id)); };
  const handleRowTouch = (item, event) => { const now = Date.now(); if (lastTapRef.current.id === item.id && now - lastTapRef.current.time < 300) { event.preventDefault(); handleEdit(item); } lastTapRef.current = { id: item.id, time: now }; };
  const hasActiveFilter = (cId) => (filtrosColunas[cId] || []).length > 0;
  const getValoresFiltro = (cId) => filtrosColunas[cId] || [];
  const setValoresFiltro = (cId, v) => setFiltrosColunas(prev => ({ ...prev, [cId]: v }));
  const clearColumnFilter = (cId) => setValoresFiltro(cId, []);
  const columnOptions = useMemo(() => { const o = {}; COLUNAS_DISPONIVEIS.filter(c => !c.fixo).forEach(col => { o[col.id] = [...new Set(locais.map(i => getFieldValue(i, col.id)).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" })); }); return o; }, [locais]);

  const renderFilterControl = (colunaId) => {
    const btnCls = `h-3 w-3 min-w-3 p-0 ${hasActiveFilter(colunaId) ? "text-emerald-600" : "text-slate-300 hover:text-slate-400"}`;
    const colLabel = COLUNAS_DISPONIVEIS.find(c => c.id === colunaId)?.label || colunaId;
    const opts = columnOptions[colunaId] || [];
    const vals = filtroTemp.colunaId === colunaId ? filtroTemp.valores : getValoresFiltro(colunaId);
    const fOpts = opts.filter(o => String(o).toLowerCase().includes(buscaFiltroMenu.toLowerCase()));
    const allSel = fOpts.length > 0 && fOpts.every(o => vals.includes(o));
    return (
      <Popover open={menuFiltroAberto === colunaId} onOpenChange={(open) => { setMenuFiltroAberto(open ? colunaId : null); setBuscaFiltroMenu(""); setFiltroTemp(open ? { colunaId, valores: [...getValoresFiltro(colunaId)] } : { colunaId: null, valores: [] }); }}>
        <PopoverTrigger asChild><Button variant="ghost" size="icon" className={btnCls}><Filter className="w-2 h-2" /></Button></PopoverTrigger>
        <PopoverContent align="end" side="bottom" sideOffset={4} className="w-[310px] p-0 z-[9999]">
          <div className="p-1 space-y-0.5 border-b">
            <button type="button" className="flex items-center w-full px-2 h-8 text-xs hover:bg-slate-100 rounded" onClick={() => { handleSort(colunaId); setMenuFiltroAberto(null); }}><ArrowDownAZ className="w-4 h-4 mr-2" />Menor → Maior</button>
            <button type="button" className="flex items-center w-full px-2 h-8 text-xs hover:bg-slate-100 rounded" onClick={() => { setSortConfig({ key: colunaId, direction: "desc" }); setMenuFiltroAberto(null); }}><ArrowUpZA className="w-4 h-4 mr-2" />Maior → Menor</button>
            <button type="button" className={`flex items-center w-full px-2 h-8 text-xs rounded ${hasActiveFilter(colunaId) ? 'hover:bg-slate-100 text-slate-700' : 'text-slate-300 cursor-not-allowed'}`} disabled={!hasActiveFilter(colunaId)} onClick={() => { clearColumnFilter(colunaId); setMenuFiltroAberto(null); }}><X className="w-4 h-4 mr-2" />Limpar Filtro de "{colLabel}"</button>
          </div>
          <div className="p-2 space-y-2">
            <Input value={buscaFiltroMenu} onChange={(e) => setBuscaFiltroMenu(e.target.value)} placeholder="PESQUISAR" className="h-8 text-xs uppercase" />
            <div className="border border-slate-300 rounded-sm max-h-64 overflow-y-auto p-1 bg-white">
              <label className="flex h-8 items-center gap-2 px-2 py-0 text-xs text-slate-700 border-b border-slate-200"><Checkbox checked={allSel} onCheckedChange={(ch) => { setFiltroTemp(prev => { const rest = prev.valores.filter(v => !fOpts.includes(v)); return { ...prev, valores: ch ? [...new Set([...rest, ...fOpts])] : rest }; }); }} className="h-3.5 w-3.5 shrink-0" /><span>(Selecionar Tudo)</span></label>
              {fOpts.map(o => (<label key={o} className="flex h-6 items-center gap-2 px-2 py-0 text-xs text-slate-700 hover:bg-slate-50"><Checkbox checked={vals.includes(o)} onCheckedChange={(ch) => { setFiltroTemp(prev => ({ ...prev, valores: ch ? [...prev.valores, o] : prev.valores.filter(i => i !== o) })); }} className="h-3.5 w-3.5 shrink-0" /><span>{o}</span></label>))}
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

  const renderCell = (item, colId) => { if (colId === "numero") return item.numero_local || "-"; if (colId === "nome") return <span className={`uppercase font-medium ${item.ativo === false ? 'text-slate-400 line-through' : ''}`}>{item.nome || "-"}</span>; if (colId === "capacidade") return item.capacidade || "-"; if (colId === "descricao") return item.descricao || "-"; if (colId === "ativo") return item.ativo !== false ? <Badge className="text-[10px] bg-emerald-100 text-emerald-700">Ativo</Badge> : <Badge className="text-[10px] bg-slate-100 text-slate-500">Inativo</Badge>; return "-"; };

  return (
    <div className="p-1 md:p-1 space-y-1">
      {!showForm && (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 bg-white rounded px-1 py-1 shadow-sm border-b border-slate-200">
          <div><h1 className="font-bold text-slate-800">Locais de Estoque</h1></div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="icon" onClick={() => setShowConfigColunas(true)} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-7 w-7"><Settings className="w-4 h-4" /></Button>
            <Button onClick={() => { setShowForm(true); setEditing(null); setFormData({ nome: "", descricao: "", capacidade: "", ativo: true }); setErrors({}); }} size="sm" className="bg-lime-900 text-primary-foreground px-3 text-xs font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow h-7 hover:bg-emerald-600">Adicionar</Button>
          </div>
        </div>
      )}
      <AnimatePresence mode="wait">
        {showForm ? (
          <motion.div key="form" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <Card className="shadow-sm border-slate-300"><CardHeader className="flex flex-col space-y-1.5 p-6 bg-slate-50 border-b py-1 px-1"><CardTitle className="text-sm font-semibold text-slate-700">{editing ? 'Editar Local' : 'Novo Local'}</CardTitle></CardHeader>
              <CardContent className="p-1">
                <form onSubmit={handleSubmit} className="space-y-0.5">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-1">
                    <FL label="Nome" required error={errors.nome} dataField="nome"><Input value={formData.nome} onChange={(e) => { setErrors(p => ({ ...p, nome: false })); setFormData(p => ({ ...p, nome: e.target.value })); }} placeholder="GALPÃO 1" className="h-7 text-xs uppercase border-0 shadow-none focus-visible:ring-0 bg-transparent" style={{ textTransform: "uppercase" }} /></FL>
                    <FL label="Capacidade" dataField="capacidade"><Input value={formData.capacidade} onChange={(e) => setFormData(p => ({ ...p, capacidade: e.target.value }))} placeholder="500 SACAS" className="h-7 text-xs uppercase border-0 shadow-none focus-visible:ring-0 bg-transparent" style={{ textTransform: "uppercase" }} /></FL>
                    <FL label="Descrição" dataField="descricao"><Textarea value={formData.descricao} onChange={(e) => setFormData(p => ({ ...p, descricao: e.target.value }))} placeholder="DESCRIÇÃO" className="text-xs uppercase border-0 shadow-none focus-visible:ring-0 bg-transparent" style={{ textTransform: "uppercase" }} rows={2} /></FL>
                  </div>
                  <div className="flex flex-wrap gap-6 py-1 px-1">
                    <div className="flex items-center gap-2">
                      <Checkbox id="le_ativo" checked={formData.ativo} onCheckedChange={(v) => setFormData(p => ({ ...p, ativo: v }))} />
                      <label htmlFor="le_ativo" className="text-xs text-slate-700 cursor-pointer">Ativo</label>
                    </div>
                  </div>
                  <div className="flex flex-col-reverse lg:flex-row justify-end gap-1 pt-1 border-t"><Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditing(null); }} size="sm" className="h-7 text-xs px-3">Cancelar</Button><Button type="submit" size="sm" className="h-7 text-xs px-3 bg-emerald-600 hover:bg-emerald-700 text-white">{editing ? 'Atualizar' : 'Salvar'}</Button></div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <div key="table" className="space-y-1 overflow-hidden">
            <div className="flex justify-between items-center px-1 gap-2 flex-wrap"><div className="text-xs text-slate-500">{sortedData.length} de {locais.length} registros</div><div className="flex gap-2 flex-wrap">{selectedItems.length > 0 && (<DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-7 text-xs">Ações ({selectedItems.length})</Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuLabel className="text-xs">Ações em Lote</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem onClick={() => handleRequestDelete(selectedItems)} className="text-xs text-red-600">Excluir Selecionados</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={() => setSelectedItems([])} className="text-xs">Limpar Seleção</DropdownMenuItem></DropdownMenuContent></DropdownMenu>)}</div></div>
            <Card className="overflow-hidden"><CardContent className="p-0 overflow-hidden"><div className="relative overflow-hidden"><div ref={scrollContainerRef} className="relative w-full overflow-auto max-h-[calc(100dvh-240px)] md:max-h-[calc(100dvh-150px)]" style={{ overscrollBehavior: 'none', WebkitOverflowScrolling: 'touch' }}>
              <Table ref={tableRef} className={`w-full ${isMobile ? "min-w-[500px]" : "min-w-[700px]"} border-separate border-spacing-0 table-fixed`}>
                <TableHeader className="bg-white"><TableRow className="sticky top-0 z-40 bg-white">
                  {colunasOrdenadas.map(coluna => {
                    const w = columnWidths[coluna.id] || coluna.width || 160; const isR = resizeColumnId === coluna.id;
                    if (coluna.id === "selecao") return (<TableHead key="selecao" style={{ width: 25, minWidth: 25, maxWidth: 25 }} className="sticky top-0 z-40 h-7 p-0 bg-white text-muted-foreground font-medium text-center align-middle px-0 border-r border-b border-gray-200"><div className="flex items-center justify-center w-full h-full"><Checkbox checked={selectedItems.length === sortedData.length && sortedData.length > 0} onCheckedChange={toggleSelectAll} className="peer shrink-0 shadow disabled:opacity-50 h-4 w-4 rounded-full border-2 border-gray-400 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground" /></div></TableHead>);
                    if (coluna.id === "acoes") return <TableHead key="acoes" style={{ width: 25, minWidth: 25, maxWidth: 25 }} className="sticky top-0 z-40 h-7 p-0 bg-white text-muted-foreground font-medium text-center align-middle px-0 border-r border-b border-gray-200" />;
                    const fc = renderFilterControl(coluna.id);
                    return (<TableHead key={coluna.id} style={{ width: w, minWidth: w, maxWidth: w }} className="sticky top-0 z-40 relative align-middle text-gray-900 px-2 pr-7 text-xs font-medium text-center border-r border-b border-gray-200 bg-white whitespace-nowrap h-7"><div className="inline-flex items-center justify-center gap-1 h-full w-full whitespace-nowrap overflow-hidden text-ellipsis">{coluna.label}</div>{fc && (<div className="absolute right-1 top-1/2 -translate-y-1/2 z-50 flex items-center gap-1" onClick={e => e.stopPropagation()}>{fc}<button type="button" className={`h-4 w-4 flex items-center justify-center rounded ${isR ? 'text-emerald-600 bg-emerald-100' : 'text-slate-300 hover:text-slate-500'}`} onClick={e => { e.stopPropagation(); toggleResizeMode(coluna.id); }} onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); toggleResizeMode(coluna.id); }}><GripVertical className="w-2.5 h-2.5" /></button></div>)}{isR && (<div className="absolute top-0 -right-0 h-full w-5 z-50 flex items-center justify-center cursor-col-resize bg-lime-800" onMouseDown={e => startDragResize(e, coluna.id)} onTouchStart={e => startDragResize(e, coluna.id)} onClick={e => { e.stopPropagation(); setResizeColumnId(null); }}><GripVertical className="w-3.5 h-3.5 text-white" /></div>)}</TableHead>);
                  })}
                </TableRow></TableHeader>
                <TableBody>
                  {sortedData.length === 0 ? (<TableRow><TableCell colSpan={colunasOrdenadas.length} className="text-center py-8 text-xs text-slate-400 border border-gray-300">Nenhum local encontrado</TableCell></TableRow>) : sortedData.map(item => (
                    <TableRow key={item.id} className="data-[state=selected]:bg-muted transition-colors border-b hover:bg-gray-100" onDoubleClick={() => handleEdit(item)} onTouchEnd={(ev) => handleRowTouch(item, ev)}>
                      {colunasOrdenadas.map(coluna => { const w = columnWidths[coluna.id] || coluna.width || 160;
                        if (coluna.id === "selecao") return (<TableCell key={`${item.id}-sel`} style={{ width: 25, minWidth: 25, maxWidth: 25 }} className="p-0 text-center align-middle h-7 border-r border-b border-gray-300" onClick={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}><div className="flex items-center justify-center w-full h-full"><Checkbox checked={selectedItems.includes(item.id)} onCheckedChange={(ch) => setSelectedItems(prev => ch ? [...prev, item.id] : prev.filter(id => id !== item.id))} className="rounded-full h-4 w-4 border-2 border-gray-400 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground" /></div></TableCell>);
                        if (coluna.id === "acoes") return (<TableCell key={`${item.id}-act`} style={{ width: 25, minWidth: 25, maxWidth: 25 }} className="p-0 text-center align-middle h-7 border-r border-b border-gray-300" onClick={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}><div className="flex items-center justify-center w-full h-full"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6"><MoreVertical className="w-3.5 h-3.5 text-slate-600" /></Button></DropdownMenuTrigger><DropdownMenuContent align="start"><DropdownMenuItem onClick={() => handleEdit(item)} className="text-xs">Editar</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={() => handleRequestDelete(item.id)} className="text-xs text-red-600">Excluir</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></TableCell>);
                        const al = coluna.align === "right" ? "text-right" : coluna.align === "center" ? "text-center" : "text-left";
                        return (<TableCell key={`${item.id}-${coluna.id}`} style={{ width: w, minWidth: w, maxWidth: w }} className={`px-2 py-1 text-gray-700 text-xs align-middle border-r border-b border-gray-300 whitespace-normal break-words ${al}`}>{renderCell(item, coluna.id)}</TableCell>);
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div></div></CardContent></Card>
          </div>
        )}
      </AnimatePresence>
      <ConfiguracaoColunasMapaDialog open={showConfigColunas} onOpenChange={setShowConfigColunas} colunasDisponiveis={COLUNAS_DISPONIVEIS} colunasVisiveis={colunasVisiveis} colunasOrdem={colunasOrdem} toggleColuna={toggleColuna} handleDragEnd={handleDragEnd} droppableId="colunas-locais-estoque" />
      <ConfirmDialog open={deleteState.open} onOpenChange={(open) => setDeleteState(prev => ({ ...prev, open }))} title="Confirmar exclusão" description={deleteState.ids.length > 1 ? `Deseja excluir ${deleteState.ids.length} locais selecionados?` : "Deseja excluir este local?"} confirmText="Excluir" cancelText="Cancelar" variant="destructive" onConfirm={handleConfirmDelete} />
    </div>
  );
}