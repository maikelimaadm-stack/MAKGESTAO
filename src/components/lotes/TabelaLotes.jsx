import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import ConfiguracaoColunasLotesDialog from "@/components/lotes/ConfiguracaoColunasLotesDialog";
import { useQuery } from "@tanstack/react-query";
import loteRepository from "@/core/repositories/loteRepository";
import campoEngine from "@/services/campoEngine";
import { Filter, X, ArrowDownAZ, ArrowUpZA, GripVertical, Check } from "lucide-react";

const COLUNAS_DISPONIVEIS = [
{ id: "codigo", label: "Código", default: true, sortable: true, align: "left", width: 100 },
{ id: "nome", label: "Nome", default: true, sortable: true, align: "left", width: 200 },
{ id: "identificador", label: "Identificador", default: true, sortable: true, align: "left", width: 180 },
{ id: "sigla", label: "Sigla", default: true, sortable: true, align: "left", width: 90 },
{ id: "cor", label: "Cor", default: true, sortable: true, align: "left", width: 100 },
{ id: "cabecas", label: "Cabeças", default: true, sortable: true, align: "right", width: 100 },
{ id: "categoria", label: "Categoria", default: true, sortable: true, align: "left", width: 160 },
{ id: "categoria_manejo", label: "Categoria Manejo", default: true, sortable: true, align: "left", width: 180 },
{ id: "sexo", label: "Sexo", default: true, sortable: true, align: "left", width: 100 },
{ id: "peso", label: "Peso Médio", default: true, sortable: true, align: "right", width: 120 },
{ id: "setor", label: "Setor", default: true, sortable: true, align: "left", width: 160 },
{ id: "area", label: "Área Entrada", default: true, sortable: true, align: "left", width: 160 },
{ id: "sistema_produtivo", label: "Sistema Reprodutivo", default: true, sortable: true, align: "left", width: 180 },
{ id: "motivo", label: "Motivo", default: true, sortable: true, align: "left", width: 140 },
{ id: "data", label: "Data Entrada", default: true, sortable: true, align: "left", width: 120 },
{ id: "status", label: "Status", default: true, sortable: true, align: "left", width: 100 },
{ id: "valor", label: "Valor Total", default: true, sortable: true, align: "right", width: 140 },
{ id: "fornecedor", label: "Fornecedor", default: true, sortable: true, align: "left", width: 160 },
{ id: "origem", label: "Origem", default: true, sortable: true, align: "left", width: 140 },
{ id: "raca", label: "Raça Predominante", default: true, sortable: true, align: "left", width: 160 },
{ id: "nota_fiscal", label: "Nota Fiscal", default: true, sortable: true, align: "left", width: 130 },
{ id: "numero_gta", label: "GTA", default: true, sortable: true, align: "left", width: 120 },
{ id: "cidade_origem", label: "Cidade Origem", default: true, sortable: true, align: "left", width: 150 },
{ id: "estado_origem", label: "UF Origem", default: true, sortable: true, align: "left", width: 90 },
{ id: "valor_por_cabeca", label: "Valor/Cabeça", default: true, sortable: true, align: "right", width: 140 },
{ id: "valor_frete", label: "Valor Frete", default: true, sortable: true, align: "right", width: 130 },
{ id: "observacoes", label: "Observações", default: true, sortable: false, align: "left", width: 220 }];


const DEFAULT_VISIBLE_COLUMNS = COLUNAS_DISPONIVEIS.filter((c) => c.default).map((c) => c.id);
const COLUMN_WIDTHS_KEY = "colunas_largura_cadastro_lotes";
const FROZEN_COLUMNS_KEY = "colunas_congeladas_cadastro_lotes";
const MIN_COLUMN_WIDTH = 80;
const HEADER_ACTIONS_WIDTH = 0;
const getColumnMinWidth = (coluna) => Math.max(MIN_COLUMN_WIDTH, String(coluna?.label || "").length * 7 + HEADER_ACTIONS_WIDTH + 18);

const formatarData = (data) => {
  if (!data) return "-";
  const [ano, mes, dia] = String(data).split("T")[0].split("-");
  if (!ano || !mes || !dia) return "-";
  return `${dia}/${mes}/${ano}`;
};

const formatarValor = (valor) => {
  if (!valor) return "-";
  return `R$ ${Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
};

const escaparCsv = (valor) => {
  const texto = String(valor ?? "");
  return `"${texto.replaceAll('"', '""')}"`;
};

export default function TabelaLotes({
  lotes = [],
  areas = [],
  onEdit,
  showConfigColunas,
  setShowConfigColunas,
  searchTerm = "",
  selectedRecordId,
  onSelectionChange,
  onVisibleDataChange
}) {
  const [selectedItems, setSelectedItems] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: "nome", direction: "asc" });
  const [menuFiltroAberto, setMenuFiltroAberto] = useState(null);
  const [buscaFiltroMenu, setBuscaFiltroMenu] = useState("");
  const [filtroTemp, setFiltroTemp] = useState({ colunaId: null, valores: [] });
  const [filtrosColunas, setFiltrosColunas] = useState({});
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const [columnWidths, setColumnWidths] = useState(() => {
    const defaults = Object.fromEntries(COLUNAS_DISPONIVEIS.map((c) => [c.id, c.width || 160]));
    const saved = localStorage.getItem(COLUMN_WIDTHS_KEY);
    if (!saved) return defaults;
    try {return { ...defaults, ...JSON.parse(saved) };} catch {return defaults;}
  });

  const [frozenColumnCount, setFrozenColumnCount] = useState(() => {
    const saved = Number(localStorage.getItem(FROZEN_COLUMNS_KEY) || 0);
    return Number.isFinite(saved) ? saved : 0;
  });

  const lastTapRef = useRef({ id: null, time: 0 });
  const lastSelectedIdRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const headerScrollRef = useRef(null);
  const tableRef = useRef(null);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);
  const [resizeColumnId, setResizeColumnId] = useState(null);
  const dragRef = useRef(null);

  const [colunasOrdem, setColunasOrdem] = useState(() => {
    const saved = localStorage.getItem("colunas_ordem_cadastro_lotes");
    if (saved) {try {return JSON.parse(saved);} catch {/* fallback */}}
    return COLUNAS_DISPONIVEIS.map((c) => c.id);
  });

  const [colunasVisiveis, setColunasVisiveis] = useState(() => {
    const saved = localStorage.getItem("colunas_visiveis_cadastro_lotes");
    if (saved) {try {return Array.from(new Set([...JSON.parse(saved), ...DEFAULT_VISIBLE_COLUMNS]));} catch {/* fallback */}}
    return DEFAULT_VISIBLE_COLUMNS;
  });

  const [layoutAggregationConfig, setLayoutAggregationConfig] = useState(() => {
    const saved = localStorage.getItem("cadastro_lotes_table_aggregation_config");
    if (!saved) return {};
    try {return JSON.parse(saved);} catch {return {};}
  });

  useEffect(() => {
    const handleStorage = () => {
      const saved = localStorage.getItem("cadastro_lotes_table_aggregation_config");
      try {setLayoutAggregationConfig(saved ? JSON.parse(saved) : {});} catch {setLayoutAggregationConfig({});}
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("cadastro-lotes-layout-updated", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("cadastro-lotes-layout-updated", handleStorage);
    };
  }, []);

  const { data: camposPersonalizados = [] } = useQuery({
    queryKey: ["lote-campos-personalizados"],
    queryFn: () => loteRepository.listCamposPersonalizados(),
    initialData: []
  });

  const colunasDisponiveis = useMemo(() => {
    const dinamicas = camposPersonalizados.
    map(campoEngine.normalize).
    filter((campo) => campo.ativo !== false && campo.visivel_tabela === true).
    map((campo) => ({
      ...campo,
      id: `custom:${campo.field_name}`,
      label: campo.label,
      default: true,
      sortable: campo.ordenavel !== false,
      filtravel: campo.filtravel !== false,
      align: campo.alinhamento || "left",
      width: campo.largura_coluna || 160,
      ordem_tabela: campo.ordem_tabela ?? campo.ordem ?? 999,
      agregacao_tipo: campo.agregacao_tipo || campo.agregacao || "",
      agregacao_campo_base: campo.agregacao_campo_base || "",
      customField: campo.field_name
    }));
    const formFieldToColumnId = {
      quantidade_cabecas: "cabecas",
      peso_medio_kg: "peso",
      valor_total_compra: "valor"
    };
    const aggregationByColumn = { ...layoutAggregationConfig };
    Object.entries(formFieldToColumnId).forEach(([fieldId, columnId]) => {
      if (layoutAggregationConfig[fieldId]?.enabled) aggregationByColumn[columnId] = layoutAggregationConfig[fieldId];
    });

    return [...COLUNAS_DISPONIVEIS, ...dinamicas.sort((a, b) => (a.ordem_tabela || 999) - (b.ordem_tabela || 999))].map((coluna) => {
      const config = aggregationByColumn[coluna.id];
      if (coluna.tipo === "number" && coluna.usar_mascara) return { ...coluna, agregacao_tipo: "", agregacao: "", align: "left" };
      return config?.enabled ? { ...coluna, agregacao_tipo: config.type, agregacao: config.type, usar_decimal: true } : { ...coluna, agregacao_tipo: "", agregacao: "" };
    });
  }, [camposPersonalizados, layoutAggregationConfig]);

  const relatedSources = useMemo(() => camposPersonalizados.
  map((campo) => {
    const normalized = campoEngine.normalize(campo);
    const entity = campoEngine.getOptionsSourceKey(normalized);
    return entity ? { entity, labelField: normalized.options_label_field || normalized.relation_display_field || "nome", valueField: normalized.options_value_field || "id" } : null;
  }).
  filter(Boolean), [camposPersonalizados]);

  const { data: relatedOptions = {} } = useQuery({
    queryKey: ["lote-related-options", relatedSources.map((source) => `${source.entity}:${source.labelField}:${source.valueField}`).join("|")],
    queryFn: () => loteRepository.listOptionsSources(relatedSources),
    enabled: relatedSources.length > 0,
    initialData: {}
  });

  useEffect(() => {
    const customVisible = colunasDisponiveis.filter((col) => col.id.startsWith("custom:") && col.default).map((col) => col.id);
    setColunasVisiveis((prev) => Array.from(new Set([...prev, ...customVisible])));
    setColunasOrdem((prev) => {
      const merged = Array.from(new Set([...prev, ...customVisible]));
      return merged.sort((a, b) => {
        const colA = colunasDisponiveis.find((col) => col.id === a);
        const colB = colunasDisponiveis.find((col) => col.id === b);
        return (colA?.ordem_tabela || colA?.ordem || 0) - (colB?.ordem_tabela || colB?.ordem || 0);
      });
    });
  }, [colunasDisponiveis]);

  useEffect(() => {localStorage.setItem(COLUMN_WIDTHS_KEY, JSON.stringify(columnWidths));}, [columnWidths]);
  useEffect(() => {localStorage.setItem(FROZEN_COLUMNS_KEY, String(frozenColumnCount));}, [frozenColumnCount]);

  const toggleResizeMode = (colunaId) => {
    setResizeColumnId((prev) => prev === colunaId ? null : colunaId);
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current) return;
      if (e.cancelable) e.preventDefault();
      const clientX = e.touches?.[0]?.clientX ?? e.clientX;
      const { columnId, startX, startWidth, minWidth } = dragRef.current;
      setColumnWidths((prev) => ({ ...prev, [columnId]: Math.max(minWidth || MIN_COLUMN_WIDTH, startWidth + (clientX - startX)) }));
    };
    const onUp = () => {if (!dragRef.current) return;dragRef.current = null;document.body.style.cursor = "";document.body.style.userSelect = "";};
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {window.removeEventListener("mousemove", onMove);window.removeEventListener("mouseup", onUp);window.removeEventListener("touchmove", onMove);window.removeEventListener("touchend", onUp);};
  }, []);

  const startDragResize = (e, coluna) => {
    e.preventDefault();e.stopPropagation();
    const clientX = e.touches?.[0]?.clientX ?? e.clientX;
    dragRef.current = { columnId: coluna.id, startX: clientX, startWidth: columnWidths[coluna.id] || coluna.width || 160, minWidth: getColumnMinWidth(coluna) };
    document.body.style.cursor = "col-resize";document.body.style.userSelect = "none";
  };

  const sameSelection = (a = [], b = []) => a.length === b.length && a.every((id, index) => id === b[index]);

  useEffect(() => {
    setSelectedItems((prev) => {
      const validIds = prev.filter((id) => lotes.some((l) => l.id === id));
      return sameSelection(prev, validIds) ? prev : validIds;
    });
  }, [lotes]);

  useEffect(() => {
    onSelectionChange?.(selectedItems);
  }, [selectedItems, onSelectionChange]);

  useEffect(() => {
    if (!selectedRecordId) return;
    setSelectedItems((prev) => prev.length === 1 && prev[0] === selectedRecordId ? prev : [selectedRecordId]);
    lastSelectedIdRef.current = selectedRecordId;
  }, [selectedRecordId]);

  const toggleColuna = (colunaId) => {
    const novas = colunasVisiveis.includes(colunaId) ? colunasVisiveis.filter((id) => id !== colunaId) : [...colunasVisiveis, colunaId];
    setColunasVisiveis(novas);
    localStorage.setItem("colunas_visiveis_cadastro_lotes", JSON.stringify(novas));
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(colunasOrdem);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);
    setColunasOrdem(items);
    localStorage.setItem("colunas_ordem_cadastro_lotes", JSON.stringify(items));
  };

  const handleColumnLayoutChange = ({ visiveis, ordem, frozenColumnCount: nextFrozenColumnCount }) => {
    setColunasVisiveis(visiveis);
    setColunasOrdem(ordem);
    if (nextFrozenColumnCount !== undefined) setFrozenColumnCount(Math.max(0, Math.min(Number(nextFrozenColumnCount) || 0, visiveis.length)));
    localStorage.setItem("colunas_visiveis_cadastro_lotes", JSON.stringify(visiveis));
    localStorage.setItem("colunas_ordem_cadastro_lotes", JSON.stringify(ordem));
  };

  const handleResetColumnLayout = () => {
    const defaultOrder = colunasDisponiveis.filter((coluna) => !coluna.fixo).map((coluna) => coluna.id);
    const defaultVisible = colunasDisponiveis.filter((coluna) => !coluna.fixo && coluna.default).map((coluna) => coluna.id);
    handleColumnLayoutChange({ visiveis: defaultVisible, ordem: defaultOrder });
  };

  const colunasOrdenadas = useMemo(() => {
    return colunasOrdem.map((id) => colunasDisponiveis.find((c) => c.id === id)).filter((c) => c && colunasVisiveis.includes(c.id));
  }, [colunasOrdem, colunasVisiveis, colunasDisponiveis]);

  useEffect(() => {
    setFrozenColumnCount((current) => Math.min(current, colunasOrdenadas.length));
  }, [colunasOrdenadas.length]);

  const colunasTodasOrdenadas = useMemo(() => {
    return colunasOrdem.map((id) => colunasDisponiveis.find((c) => c.id === id)).filter((c) => c && !c.fixo);
  }, [colunasOrdem, colunasDisponiveis]);

  const columnPixelWidths = useMemo(() => {
    return Object.fromEntries(
      colunasOrdenadas.map((coluna) => [
        coluna.id,
        Math.max(columnWidths[coluna.id] || coluna.width || 160, getColumnMinWidth(coluna))
      ])
    );
  }, [colunasOrdenadas, columnWidths]);

  const totalTableWidth = useMemo(() => {
    const minWidth = isMobile ? 720 : 900;
    const columnsWidth = colunasOrdenadas.reduce((total, coluna) => total + (columnPixelWidths[coluna.id] || 160), 0);
    return Math.max(minWidth, columnsWidth);
  }, [colunasOrdenadas, columnPixelWidths, isMobile]);

  const frozenOffsets = useMemo(() => {
    let left = 0;
    return colunasOrdenadas.reduce((acc, coluna, index) => {
      if (index < frozenColumnCount) {
        acc[coluna.id] = left;
        left += columnPixelWidths[coluna.id] || 160;
      }
      return acc;
    }, {});
  }, [colunasOrdenadas, columnPixelWidths, frozenColumnCount]);

  // Field value extraction for filters
  const getFieldValue = (lote, colunaId) => {
    const coluna = colunasDisponiveis.find((item) => item.id === colunaId);
    return campoEngine.getValorCampo(lote, coluna || { id: colunaId }, relatedOptions);
  };

  const columnOptions = useMemo(() => {
    const opts = {};
    colunasDisponiveis.filter((c) => !c.fixo).forEach((col) => {
      opts[col.id] = [...new Set(lotes.map((item) => getFieldValue(item, col.id)).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "pt-BR", { numeric: true, sensitivity: "base" }));
    });
    return opts;
  }, [lotes, colunasDisponiveis, relatedOptions]);

  const hasActiveFilter = (colunaId) => (filtrosColunas[colunaId] || []).length > 0;
  const getValoresFiltro = (colunaId) => filtrosColunas[colunaId] || [];
  const setValoresFiltro = (colunaId, values) => setFiltrosColunas((prev) => ({ ...prev, [colunaId]: values }));
  const clearColumnFilter = (colunaId) => setValoresFiltro(colunaId, []);
  const getColumnFilterType = (coluna) => {
    if (coluna?.tipo === "date" || coluna?.id === "data") return "date";
    if (coluna?.tipo === "number" && coluna?.usar_mascara) return "list";
    if (["number", "calculado"].includes(coluna?.tipo) || ["codigo", "cabecas", "peso", "valor", "valor_por_cabeca", "valor_frete"].includes(coluna?.id)) return "number";
    return "list";
  };

  const getColumnAlignClass = (coluna) => {
    const type = getColumnFilterType(coluna);
    if (type === "date") return "text-center";
    if (type === "number") return "text-right";
    return "text-left";
  };
  const getComparableValue = (lote, coluna) => {
    if (coluna.id === "codigo") return Number(lote.numero_lote || 0);
    if (coluna.id === "cabecas") return Math.trunc(Number(lote.quantidade_entrada || lote.quantidade_cabecas || 0));
    if (coluna.id === "peso") return Number(lote.peso_entrada_kg || lote.peso_medio_kg || 0);
    if (coluna.id === "valor") return Number(lote.valor_total_compra || 0);
    if (coluna.id === "data") return String(lote.data_entrada || "").split("T")[0];
    return campoEngine.getValorBruto(lote, coluna);
  };

  const lotesFiltrados = useMemo(() => {
    const termo = String(searchTerm || "").toLowerCase().trim();
    return lotes.filter((lote) => {
      if (termo) {
        const matchesSearch = colunasDisponiveis.filter((c) => !c.fixo).some((col) => String(getFieldValue(lote, col.id) || "").toLowerCase().includes(termo));
        if (!matchesSearch) return false;
      }
      return colunasDisponiveis.filter((c) => !c.fixo).every((col) => {
        const filtro = filtrosColunas[col.id] || [];
        if (filtro.length === 0) return true;
        const filterType = getColumnFilterType(col);
        const raw = getComparableValue(lote, col);
        if (filterType === "number") {
          const numberValue = Number(raw);
          const min = filtro.find((item) => String(item).startsWith("min:"));
          const max = filtro.find((item) => String(item).startsWith("max:"));
          const listValues = filtro.filter((item) => !String(item).startsWith("min:") && !String(item).startsWith("max:"));
          if (min && numberValue < Number(String(min).replace("min:", ""))) return false;
          if (max && numberValue > Number(String(max).replace("max:", ""))) return false;
          if (listValues.length > 0) return listValues.includes(getFieldValue(lote, col.id));
          return true;
        }
        if (filterType === "date") {
          const dateValue = String(raw || "").split("T")[0];
          const start = filtro.find((item) => String(item).startsWith("start:"));
          const end = filtro.find((item) => String(item).startsWith("end:"));
          const listValues = filtro.filter((item) => !String(item).startsWith("start:") && !String(item).startsWith("end:"));
          if (start && dateValue < String(start).replace("start:", "")) return false;
          if (end && dateValue > String(end).replace("end:", "")) return false;
          if (listValues.length > 0) return listValues.includes(getFieldValue(lote, col.id));
          return true;
        }
        const val = getFieldValue(lote, col.id);
        return filtro.includes(val);
      });
    });
  }, [lotes, filtrosColunas, colunasDisponiveis, relatedOptions, searchTerm]);

  const lotesOrdenados = useMemo(() => {
    const sorted = [...lotesFiltrados];
    sorted.sort((a, b) => {
      const numericKeys = { codigo: "numero_lote", cabecas: null, peso: null, valor: "valor_total_compra" };
      if (sortConfig.key === "codigo") {
        const aV = Number(a.numero_lote || 0);const bV = Number(b.numero_lote || 0);
        return sortConfig.direction === "asc" ? aV - bV : bV - aV;
      }
      if (sortConfig.key === "cabecas") {
        const aV = Number(a.quantidade_entrada || a.quantidade_cabecas || 0);const bV = Number(b.quantidade_entrada || b.quantidade_cabecas || 0);
        return sortConfig.direction === "asc" ? aV - bV : bV - aV;
      }
      if (sortConfig.key === "peso") {
        const aV = Number(a.peso_entrada_kg || a.peso_medio_kg || 0);const bV = Number(b.peso_entrada_kg || b.peso_medio_kg || 0);
        return sortConfig.direction === "asc" ? aV - bV : bV - aV;
      }
      if (sortConfig.key === "valor") {
        const aV = Number(a.valor_total_compra || 0);const bV = Number(b.valor_total_compra || 0);
        return sortConfig.direction === "asc" ? aV - bV : bV - aV;
      }
      const aVal = String(getFieldValue(a, sortConfig.key)).toLowerCase();
      const bVal = String(getFieldValue(b, sortConfig.key)).toLowerCase();
      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [lotesFiltrados, sortConfig, colunasDisponiveis, relatedOptions]);

  const handleSort = (key) => setSortConfig((prev) => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));

  const toggleSelectAll = () => {
    if (selectedItems.length === lotesFiltrados.length && lotesFiltrados.length > 0) {setSelectedItems([]);return;}
    setSelectedItems(lotesFiltrados.map((l) => l.id));
  };

  const toggleSelectItem = (id) => {
    setSelectedItems((prev) => prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]);
    lastSelectedIdRef.current = id;
  };

  const handleRowSelect = (lote, event) => {
    if (event?.target?.closest?.("button, input, [role='checkbox'], [data-radix-popper-content-wrapper]")) return;

    if (event?.shiftKey && lastSelectedIdRef.current) {
      const startIndex = lotesOrdenados.findIndex((item) => item.id === lastSelectedIdRef.current);
      const endIndex = lotesOrdenados.findIndex((item) => item.id === lote.id);
      if (startIndex >= 0 && endIndex >= 0) {
        const [from, to] = [Math.min(startIndex, endIndex), Math.max(startIndex, endIndex)];
        setSelectedItems(lotesOrdenados.slice(from, to + 1).map((item) => item.id));
        return;
      }
    }

    if (event?.ctrlKey || event?.metaKey) {
      toggleSelectItem(lote.id);
      return;
    }

    if (selectedItems.includes(lote.id)) {
      setSelectedItems([]);
      lastSelectedIdRef.current = null;
      return;
    }

    setSelectedItems([lote.id]);
    lastSelectedIdRef.current = lote.id;
  };

  const handleTableKeyDown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
      event.preventDefault();
      setSelectedItems(lotesOrdenados.map((lote) => lote.id));
    }
  };

  const handleRowTouch = (lote, event) => {
    const hadMultipleSelected = selectedItems.length > 1;
    const now = Date.now();
    if (lastTapRef.current.id === lote.id && now - lastTapRef.current.time < 300) {
      event.preventDefault();
      if (!hadMultipleSelected) onEdit(lote);
    } else {
      handleRowSelect(lote, event);
    }
    lastTapRef.current = { id: lote.id, time: now };
  };

  const renderCell = (lote, colunaId) => {
    if (colunaId === "cabecas") {
      return Number(lote.quantidade_entrada || lote.quantidade_cabecas || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
    }

    const coluna = colunasDisponiveis.find((item) => item.id === colunaId);
    return campoEngine.getValorCampo(lote, coluna || { id: colunaId }, relatedOptions);
  };

  const agregacoes = useMemo(() => {
    return campoEngine.calcularAgregacoes(lotesOrdenados, colunasOrdenadas, relatedOptions);
  }, [lotesOrdenados, colunasOrdenadas, relatedOptions]);

  const agregacoesTodas = useMemo(() => {
    return campoEngine.calcularAgregacoes(lotesOrdenados, colunasTodasOrdenadas, relatedOptions);
  }, [lotesOrdenados, colunasTodasOrdenadas, relatedOptions]);

  const formatTotalValue = (valor, coluna) => {
    const tipo = String(coluna.tipo || coluna.field_type || "").toLowerCase();
    const integerColumns = ["cabecas", "quantidade_cabecas", "quantidade_entrada"];
    const isInteger = integerColumns.includes(coluna.id) || integerColumns.includes(coluna.field_name);
    const decimalPlaces = Math.min(6, Math.max(0, Number(coluna.decimal_places ?? coluna.casas_decimais ?? 2)));
    const isDecimal = !isInteger && (coluna.usar_decimal === true || tipo.includes("decimal") || tipo.includes("moeda") || tipo.includes("currency") || ["peso", "valor", "valor_por_cabeca", "valor_frete"].includes(coluna.id));

    return Number(valor).toLocaleString("pt-BR", isDecimal ? {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces
    } : {
      maximumFractionDigits: 0
    });
  };

  const exportarTabela = (apenasSelecionados = false) => {
    const colunasExportaveis = colunasOrdenadas.filter((coluna) => !coluna.fixo);
    const lotesParaExportar = apenasSelecionados ? lotesOrdenados.filter((lote) => selectedItems.includes(lote.id)) : lotesOrdenados;
    const header = colunasExportaveis.map((coluna) => escaparCsv(coluna.label)).join(';');
    const rows = lotesParaExportar.map((lote) => {
      return colunasExportaveis.map((coluna) => escaparCsv(getFieldValue(lote, coluna.id))).join(';');
    });

    const csv = [header, ...rows].join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `lotes_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const colunasExportaveis = colunasOrdenadas.filter((coluna) => !coluna.fixo);
    const buildColumns = (cols) => cols.map((coluna) => ({
      id: coluna.id,
      label: coluna.label,
      width: Math.max(columnWidths[coluna.id] || coluna.width || 160, getColumnMinWidth(coluna))
    }));
    const buildRows = (items, cols) => items.map((lote) => cols.map((coluna) => getFieldValue(lote, coluna.id)));
    const buildTotalRow = (cols, totals) => Object.keys(totals).length > 0 ? cols.map((coluna, index) => {
      if (index === 0) return "Totais";
      return totals[coluna.id] !== undefined ? formatTotalValue(totals[coluna.id], coluna) : "";
    }) : null;
    const totalRow = buildTotalRow(colunasExportaveis, agregacoes);
    const allTotalRow = buildTotalRow(colunasTodasOrdenadas, agregacoesTodas);
    const selectedLotes = lotesOrdenados.filter((lote) => selectedItems.includes(lote.id));

    onVisibleDataChange?.({
      columns: buildColumns(colunasExportaveis),
      rows: buildRows(lotesOrdenados, colunasExportaveis),
      selectedRows: buildRows(selectedLotes, colunasExportaveis),
      totalRows: totalRow ? [totalRow] : [],
      allColumns: buildColumns(colunasTodasOrdenadas),
      allRows: buildRows(lotesOrdenados, colunasTodasOrdenadas),
      allSelectedRows: buildRows(selectedLotes, colunasTodasOrdenadas),
      allTotalRows: allTotalRow ? [allTotalRow] : []
    });
  }, [colunasOrdenadas, colunasTodasOrdenadas, lotesOrdenados, relatedOptions, selectedItems, onVisibleDataChange, agregacoes, agregacoesTodas, columnWidths]);

  const renderFilterControl = (colunaId) => {
    const buttonClass = `h-4 w-4 min-w-4 p-0 ${hasActiveFilter(colunaId) ? "text-emerald-700" : "text-slate-500 hover:text-slate-700"}`;
    const coluna = colunasDisponiveis.find((c) => c.id === colunaId);
    const columnLabel = coluna?.label || colunaId;
    const options = columnOptions[colunaId] || [];
    const filterType = getColumnFilterType(coluna);
    const isRangeFilter = filterType === "number" || filterType === "date";
    const valoresSelecionados = filtroTemp.colunaId === colunaId ? filtroTemp.valores : getValoresFiltro(colunaId);
    const filteredOptions = options.filter((o) => String(o).toLowerCase().includes(buscaFiltroMenu.toLowerCase()));
    const allVisibleSelected = filteredOptions.length > 0 && filteredOptions.every((o) => valoresSelecionados.includes(o));

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
            <Filter className="w-3.5 h-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" side="bottom" sideOffset={4} className="w-[310px] p-0 z-[9999] rounded-none">
          <div className="space-y-0.5 border-b px-1 py-1">
            <button type="button" className="flex items-center w-full h-8 text-xs hover:bg-slate-100 rounded pr-2 pl-2" onClick={() => {handleSort(colunaId);setMenuFiltroAberto(null);}}>
              <ArrowDownAZ className="w-4 h-4 mr-2" /> Classificar do Menor para o Maior
            </button>
            <button type="button" className="flex items-center w-full px-2 h-8 text-xs hover:bg-slate-100 rounded" onClick={() => {setSortConfig({ key: colunaId, direction: "desc" });setMenuFiltroAberto(null);}}>
              <ArrowUpZA className="w-4 h-4 mr-2" /> Classificar do Maior para o Menor
            </button>
            <button
              type="button"
              className={`flex items-center w-full px-2 h-8 text-xs rounded ${hasActiveFilter(colunaId) ? 'hover:bg-slate-100 text-slate-700' : 'text-slate-300 cursor-not-allowed'}`}
              disabled={!hasActiveFilter(colunaId)}
              onClick={() => {clearColumnFilter(colunaId);setMenuFiltroAberto(null);}}>
              
              <X className="w-4 h-4 mr-2" /> Limpar Filtro de "{columnLabel}"
            </button>
          </div>
          <div className="p-1 space-y-1">
            {isRangeFilter ?
            <div className="space-y-1">
                <div className="text-[11px] leading-none font-semibold text-slate-500">Entre</div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1">
                  <Input
                  type={filterType === "date" ? "date" : "number"}
                  value={String(valoresSelecionados.find((item) => String(item).startsWith(filterType === "date" ? "start:" : "min:")) || "").replace(filterType === "date" ? "start:" : "min:", "")}
                  onChange={(e) => setFiltroTemp((prev) => ({ ...prev, valores: [e.target.value ? `${filterType === "date" ? "start" : "min"}:${e.target.value}` : "", ...prev.valores.filter((item) => !String(item).startsWith(filterType === "date" ? "start:" : "min:"))].filter(Boolean) }))}
                  placeholder="De"
                  className="h-[22px] text-xs rounded-none shadow-none focus-visible:ring-0 px-1" />
                  <span className="text-xs text-slate-500">a</span>
                  <Input
                  type={filterType === "date" ? "date" : "number"}
                  value={String(valoresSelecionados.find((item) => String(item).startsWith(filterType === "date" ? "end:" : "max:")) || "").replace(filterType === "date" ? "end:" : "max:", "")}
                  onChange={(e) => setFiltroTemp((prev) => ({ ...prev, valores: [e.target.value ? `${filterType === "date" ? "end" : "max"}:${e.target.value}` : "", ...prev.valores.filter((item) => !String(item).startsWith(filterType === "date" ? "end:" : "max:"))].filter(Boolean) }))}
                  placeholder="Até"
                  className="h-[22px] text-xs rounded-none shadow-none focus-visible:ring-0 px-1" />
                </div>
              </div> :
            <Input value={buscaFiltroMenu} onChange={(e) => setBuscaFiltroMenu(e.target.value)} placeholder="PESQUISAR" className="h-[22px] text-xs uppercase rounded-none shadow-none focus-visible:ring-0 px-1" />}
            {(filterType === "list" || isRangeFilter) && <div className="border border-slate-300 rounded-none max-h-64 overflow-y-auto p-1 bg-white">
              <label className="flex h-8 items-center gap-2 px-2 py-0 text-xs text-slate-700 border-b border-slate-200 whitespace-nowrap overflow-hidden">
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={(checked) => {
                    setFiltroTemp((prev) => {
                      const restantes = prev.valores.filter((v) => !filteredOptions.includes(v));
                      return { ...prev, valores: checked ? [...new Set([...restantes, ...filteredOptions])] : restantes };
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
                    setFiltroTemp((prev) => ({ ...prev, valores: checked ? [...prev.valores, option] : prev.valores.filter((i) => i !== option) }));
                  }}
                  className="h-3.5 w-3.5 shrink-0" />
                
                  <span className="block flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{option}</span>
                </label>
              )}
            </div>}
            <div className="flex items-center justify-end gap-0 pt-2">
              <Button variant="outline" size="icon" title="Aplicar filtro" className="h-8 w-10 rounded-none border-slate-200 text-slate-800 hover:bg-slate-50" onClick={() => {setValoresFiltro(colunaId, filtroTemp.valores);setMenuFiltroAberto(null);setBuscaFiltroMenu("");setFiltroTemp({ colunaId: null, valores: [] });}}>
                <Check className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" title="Cancelar" className="h-8 w-10 rounded-none -ml-px border-slate-200 text-slate-800 hover:bg-slate-50" onClick={() => {setMenuFiltroAberto(null);setBuscaFiltroMenu("");setFiltroTemp({ colunaId: null, valores: [] });}}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>);

  };

  useEffect(() => {
    const updateScrollbarWidth = () => {
      const el = scrollContainerRef.current;
      if (!el) return;
      setScrollbarWidth(Math.max(0, el.offsetWidth - el.clientWidth));
    };
    updateScrollbarWidth();
    window.addEventListener("resize", updateScrollbarWidth);
    return () => window.removeEventListener("resize", updateScrollbarWidth);
  }, [lotesOrdenados.length, colunasOrdenadas.length]);

  const handleBodyScroll = (event) => {
    if (headerScrollRef.current) headerScrollRef.current.scrollLeft = event.currentTarget.scrollLeft;
  };

  return (
    <div className="flex-1 min-h-0 overflow-hidden bg-white select-none">
      <Card className="h-full overflow-hidden rounded-none border-0 shadow-none">
        <CardContent className="h-full p-0 overflow-hidden rounded-none">
          <div className="relative h-full overflow-hidden flex flex-col">
            <div ref={headerScrollRef} className="flex-none w-full overflow-hidden bg-white" style={{ paddingRight: scrollbarWidth }}>
              <Table style={{ width: totalTableWidth, minWidth: totalTableWidth }} className="border-separate border-spacing-0 table-fixed select-none">
                <TableHeader className="bg-white shadow-[0_1px_0_0_#d1d5db]">
                  <TableRow className="bg-white">
                    {colunasOrdenadas.map((coluna, columnIndex) => {
                      const width = columnPixelWidths[coluna.id] || 160;
                      const isFrozen = columnIndex < frozenColumnCount;
                      const isResizing = resizeColumnId === coluna.id;
                      const filterControl = renderFilterControl(coluna.id);

                      return (
                        <TableHead
                          key={coluna.id}
                          style={{ width, minWidth: width, maxWidth: width, left: isFrozen ? frozenOffsets[coluna.id] : undefined }}
                          className={`group ${isFrozen ? "sticky z-40" : "relative"} align-middle text-gray-900 px-2 text-xs font-medium border-r border-b border-gray-300 bg-white whitespace-nowrap h-7 py-0 select-none cursor-pointer ${getColumnAlignClass(coluna)}`}
                          onDoubleClick={() => handleSort(coluna.id)}>

                          <div className="block w-full h-full leading-7 whitespace-nowrap overflow-hidden text-ellipsis">
                           {coluna.label}
                          </div>

                          {filterControl &&
                          <div className={`absolute right-2 top-1/2 -translate-y-1/2 z-50 flex items-center gap-0.5 bg-white/95 pl-1 transition-opacity ${hasActiveFilter(coluna.id) || isResizing ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`} onClick={(e) => e.stopPropagation()}>
                              {filterControl}
                              <button
                              type="button"
                              className={`h-5 w-4 flex items-center justify-center rounded cursor-col-resize ${isResizing ? 'text-emerald-700 bg-emerald-100' : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'}`}
                              onMouseDown={(e) => startDragResize(e, coluna)}
                              onTouchStart={(e) => startDragResize(e, coluna)}
                              onClick={(e) => e.stopPropagation()}
                              title="Arrastar para redimensionar coluna">
                                <GripVertical className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          }

                          {isResizing &&
                          <div className="absolute top-0 right-0 h-full w-5 z-50 flex items-center justify-center cursor-col-resize bg-lime-800 "
                          onMouseDown={(e) => startDragResize(e, coluna)}
                          onTouchStart={(e) => startDragResize(e, coluna)}
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
              </Table>
            </div>

            <div ref={scrollContainerRef} tabIndex={0} onKeyDown={handleTableKeyDown} onScroll={handleBodyScroll} className="relative flex-1 min-h-0 w-full overflow-auto outline-none" style={{ overscrollBehavior: 'none', WebkitOverflowScrolling: 'touch' }}>
              <Table ref={tableRef} style={{ width: totalTableWidth, minWidth: totalTableWidth }} className="border-separate border-spacing-0 table-fixed">
                <TableBody>
                  {lotesOrdenados.length === 0 ?
                  <TableRow>
                      <TableCell colSpan={colunasOrdenadas.length} className="text-center py-8 text-xs text-slate-400 border border-gray-300">
                        Nenhum lote encontrado
                      </TableCell>
                    </TableRow> :

                  lotesOrdenados.map((lote, index) =>
                  <TableRow
                    key={lote.id}
                    className={`${selectedItems.includes(lote.id) ? "bg-green-500 hover:bg-green-600 text-white" : index % 2 === 0 ? "bg-gray-100 hover:bg-gray-200" : "bg-white hover:bg-gray-100"} transition-colors border-b cursor-pointer select-none`}
                    onClick={(event) => handleRowSelect(lote, event)}
                    onDoubleClick={() => selectedItems.length <= 1 && onEdit(lote)}
                    onTouchEnd={(event) => handleRowTouch(lote, event)}>
                    
                        {colunasOrdenadas.map((coluna, columnIndex) => {
                      const width = Math.max(columnWidths[coluna.id] || coluna.width || 160, getColumnMinWidth(coluna));
                      const isFrozen = columnIndex < frozenColumnCount;

                      return (
                        <TableCell
                          key={`${lote.id}-${coluna.id}`}
                          style={{ width, minWidth: width, maxWidth: width, left: isFrozen ? frozenOffsets[coluna.id] : undefined }}
                          className={`py-1 text-xs align-middle border-r border-b whitespace-nowrap overflow-hidden select-none px-2 ${isFrozen ? "sticky z-20" : ""} ${getColumnAlignClass(coluna)} ${selectedItems.includes(lote.id) ? "bg-green-500 text-white border-green-600" : index % 2 === 0 ? "bg-gray-100 text-gray-700 border-gray-300" : "bg-white text-gray-700 border-gray-300"}`}
                          title={String(renderCell(lote, coluna.id) ?? "")}>
                          
                              {renderCell(lote, coluna.id)}
                            </TableCell>);

                    })}
                      </TableRow>
                  )
                  }
                  {Object.keys(agregacoes).length > 0 &&
                  <TableRow className="sticky bottom-0 z-30 bg-slate-200 font-medium shadow-[0_-1px_0_0_#d1d5db]">
                      {colunasOrdenadas.map((coluna, columnIndex) => {
                      const width = Math.max(columnWidths[coluna.id] || coluna.width || 160, getColumnMinWidth(coluna));
                      const isFrozen = columnIndex < frozenColumnCount;

                      return (
                        <TableCell
                          key={`total-${coluna.id}`}
                          style={{ width, minWidth: width, maxWidth: width, left: isFrozen ? frozenOffsets[coluna.id] : undefined }}
                          className={`h-5 px-2 py-0 text-[11px] leading-5 align-middle border-r border-b border-gray-300 whitespace-nowrap overflow-hidden text-ellipsis select-none bg-slate-200 text-slate-900 ${isFrozen ? "sticky z-40" : ""} ${getColumnAlignClass(coluna)}`}>
                            {agregacoes[coluna.id] !== undefined ? formatTotalValue(agregacoes[coluna.id], coluna) : ""}
                          </TableCell>);
                    })}
                    </TableRow>
                  }
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfiguracaoColunasLotesDialog
        open={showConfigColunas}
        onOpenChange={setShowConfigColunas}
        colunasDisponiveis={colunasDisponiveis}
        colunasVisiveis={colunasVisiveis}
        colunasOrdem={colunasOrdem}
        frozenColumnCount={frozenColumnCount}
        onChange={handleColumnLayoutChange}
        onResetDefault={handleResetColumnLayout} />
      
    </div>);

}