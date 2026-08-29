import React, { useCallback, useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import SankhyaListToolbar from "@/components/common/SankhyaListToolbar";
import SankhyaFilterPanel from "@/components/common/SankhyaFilterPanel";
import { toast } from "sonner";
import FormularioLote from "@/components/lotes/FormularioLote";
import TabelaLotes from "@/components/lotes/TabelaLotes";
import ConfiguracaoCamposLoteDialog from "@/components/lotes/ConfiguracaoCamposLoteDialog";
import ConfiguracaoExportacaoPdfLotesDialog from "@/components/lotes/ConfiguracaoExportacaoPdfLotesDialog";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import RegistroAnexosDialog from "@/components/common/RegistroAnexosDialog";
import { refreshMapaCacheEntry } from "@/components/offline/mapaOfflineCache";
import loteRepository from "@/core/repositories/loteRepository";
import campoEngine from "@/services/campoEngine";
import { exportVisibleLotesTableToExcel, printVisibleLotesTable } from "@/components/lotes/loteTableExportUtils";
import { getLotesExcelExportConfig, getLotesPdfExportConfig } from "@/components/lotes/pdfExportConfig";

export default function CadastroLotes() {
  const [showForm, setShowForm] = useState(false);
  const [editingLote, setEditingLote] = useState(null);
  const [deleteState, setDeleteState] = useState({ open: false, ids: [] });
  const [showConfigColunas, setShowConfigColunas] = useState(false);
  const [showConfigCampos, setShowConfigCampos] = useState(false);
  const [showConfigPdf, setShowConfigPdf] = useState(false);
  const [showConfigExcel, setShowConfigExcel] = useState(false);
  const [viewMode, setViewMode] = useState("table");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTableItems, setSelectedTableItems] = useState([]);
  const [formVersion, setFormVersion] = useState(0);
  const [returnRecordAfterNew, setReturnRecordAfterNew] = useState(null);
  const [attachmentsRecord, setAttachmentsRecord] = useState(null);
  const [newRecordAttachmentsOpen, setNewRecordAttachmentsOpen] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filters, setFilters] = useState({ status: "todos" });
  const [appliedFilters, setAppliedFilters] = useState({ status: "todos" });
  const [visibleTableData, setVisibleTableData] = useState({ columns: [], rows: [] });
  const queryClient = useQueryClient();
  const empresaSelecionadaId = localStorage.getItem('empresa_selecionada_id');

  const { data: lotes = [] } = useQuery({
    queryKey: ['lotes-cadastro', empresaSelecionadaId],
    queryFn: () => loteRepository.list({ empresaId: empresaSelecionadaId, incluirSistema: false }),
    enabled: !!empresaSelecionadaId,
    initialData: []
  });

  const { data: areas = [] } = useQuery({
    queryKey: ['areas', empresaSelecionadaId],
    queryFn: () => loteRepository.listAreasAtivas(empresaSelecionadaId),
    enabled: !!empresaSelecionadaId,
    initialData: []
  });

  const { data: lotesComMovimentacoes = [] } = useQuery({
    queryKey: ['lotes-com-movimentacoes', empresaSelecionadaId],
    queryFn: () => loteRepository.listLotesComMovimentacoes(empresaSelecionadaId),
    enabled: !!empresaSelecionadaId,
    initialData: []
  });

  const { data: camposPersonalizadosFiltro = [] } = useQuery({
    queryKey: ["lote-campos-personalizados"],
    queryFn: () => loteRepository.listCamposPersonalizados(),
    initialData: []
  });

  const camposFiltroPersonalizados = useMemo(() => {
    return camposPersonalizadosFiltro.map(campoEngine.normalize).filter((campo) => campo.ativo !== false && campo.visivel_tabela !== false);
  }, [camposPersonalizadosFiltro]);

  const hasActiveFilters = useMemo(() => {
    return Object.entries(appliedFilters).some(([key, value]) => {
      if (key === "status") return value && value !== "todos";
      return Boolean(String(value || "").trim());
    });
  }, [appliedFilters]);

  const lotesFiltradosPainel = useMemo(() => {
    return lotes.filter((lote) => {
      const contains = (field, value) => String(field || "").toLowerCase().includes(String(value || "").toLowerCase().trim());
      if (appliedFilters.numero_lote && !contains(lote.numero_lote, appliedFilters.numero_lote)) return false;
      if (appliedFilters.nome && !contains(lote.nome, appliedFilters.nome)) return false;
      if (appliedFilters.lote_codigo && !contains(lote.numero_lote, appliedFilters.lote_codigo)) return false;
      if (appliedFilters.lote_nome && !contains(lote.nome, appliedFilters.lote_nome)) return false;
      const operators = appliedFilters._operators || {};
      const customList = (value) => String(value || "").split(/[;,\n]/).map((item) => item.trim().toLowerCase()).filter(Boolean);
      const checkText = (field, value) => {
        const filterValue = appliedFilters[field];
        const operator = operators[field] || "contains";
        const text = String(value || "").toLowerCase();
        if (operator === "empty") return !text;
        if (operator === "notEmpty") return !!text;
        if (!filterValue || filterValue === "todos") return true;
        const term = String(filterValue).toLowerCase().trim();
        if (operator === "empty") return !text;
        if (operator === "notEmpty") return !!text;
        if (operator === "exact") return text === term;
        if (operator === "different") return text !== term;
        if (operator === "startsWith") return text.startsWith(term);
        if (operator === "endsWith") return text.endsWith(term);
        if (operator === "notContains") return !text.includes(term);
        if (operator === "custom" || operator === "in") return customList(filterValue).includes(text);
        if (operator === "notIn") return !customList(filterValue).includes(text);
        return text.includes(term);
      };
      const checkNumeric = (field, value) => {
        const operator = operators[field] || "between";
        if (operator === "empty") return value === null || value === undefined || value === "" || Number.isNaN(value);
        if (operator === "notEmpty") return !(value === null || value === undefined || value === "" || Number.isNaN(value));
        if ((operator === "custom" || operator === "in") && appliedFilters[`${field}_exact`] && !customList(appliedFilters[`${field}_exact`]).includes(String(value).toLowerCase())) return false;
        if (operator === "notIn" && appliedFilters[`${field}_exact`] && customList(appliedFilters[`${field}_exact`]).includes(String(value).toLowerCase())) return false;
        if (operator === "exact" && appliedFilters[`${field}_exact`] && value !== Number(appliedFilters[`${field}_exact`])) return false;
        if (operator === "different" && appliedFilters[`${field}_exact`] && value === Number(appliedFilters[`${field}_exact`])) return false;
        if ((operator === "between" || operator === "gte" || operator === "gt") && appliedFilters[`${field}_min`] && (operator === "gt" ? value <= Number(appliedFilters[`${field}_min`]) : value < Number(appliedFilters[`${field}_min`]))) return false;
        if ((operator === "between" || operator === "lte" || operator === "lt") && appliedFilters[`${field}_max`] && (operator === "lt" ? value >= Number(appliedFilters[`${field}_max`]) : value > Number(appliedFilters[`${field}_max`]))) return false;
        return true;
      };
      if (!checkText("categoria", lote.categoria)) return false;
      if (!checkText("sexo", lote.sexo)) return false;
      if (!checkText("status", lote.status)) return false;
      if (!checkText("identificador", lote.identificador_nome)) return false;
      if (!checkText("sigla", lote.identificador_sigla)) return false;
      if (!checkText("raca", lote.raca_predominante)) return false;
      if (!checkText("sistema_produtivo", lote.sistema_produtivo)) return false;
      if (!checkText("motivo", lote.motivo_entrada)) return false;
      if (!checkText("origem", lote.origem)) return false;
      if (!checkText("fornecedor", lote.fornecedor_nome)) return false;
      if (!checkText("nota_fiscal", lote.nota_fiscal)) return false;
      if (!checkText("numero_gta", lote.numero_gta)) return false;
      if (!checkText("cidade_origem", lote.cidade_origem)) return false;
      if (!checkText("estado_origem", lote.estado_origem)) return false;
      if (!checkText("observacoes", lote.observacoes)) return false;
      if (appliedFilters.area_codigo && ![lote.area_entrada_id, lote.area_atual_id].some((value) => contains(value, appliedFilters.area_codigo))) return false;
      if (appliedFilters.area_nome && ![lote.area_entrada_nome, lote.area_atual_nome].some((value) => contains(value, appliedFilters.area_nome))) return false;
      if (appliedFilters.setor_codigo && !contains(lote.setor_id, appliedFilters.setor_codigo)) return false;
      if (appliedFilters.setor_nome && !contains(lote.setor_nome, appliedFilters.setor_nome)) return false;
      const quantidade = Number(lote.quantidade_entrada ?? lote.quantidade_cabecas ?? 0);
      if (!checkNumeric("quantidade", quantidade)) return false;
      const peso = Number(lote.peso_entrada_kg ?? lote.peso_medio_kg ?? 0);
      if (!checkNumeric("peso", peso)) return false;
      if (!checkNumeric("valor", Number(lote.valor_total_compra ?? 0))) return false;
      if (!checkNumeric("valor_por_cabeca", Number(lote.valor_por_cabeca ?? 0))) return false;
      if (!checkNumeric("valor_frete", Number(lote.valor_frete ?? 0))) return false;
      const dataEntrada = String(lote.data_entrada || "").split("T")[0];
      const dataOperator = operators.data || "between";
      if (dataOperator === "empty" && dataEntrada) return false;
      if (dataOperator === "notEmpty" && !dataEntrada) return false;
      if ((dataOperator === "custom" || dataOperator === "in") && appliedFilters.data_exact && !customList(appliedFilters.data_exact).includes(dataEntrada.toLowerCase())) return false;
      if (dataOperator === "notIn" && appliedFilters.data_exact && customList(appliedFilters.data_exact).includes(dataEntrada.toLowerCase())) return false;
      if (dataOperator === "exact" && appliedFilters.data_exact && dataEntrada !== appliedFilters.data_exact) return false;
      if (dataOperator === "different" && appliedFilters.data_exact && dataEntrada === appliedFilters.data_exact) return false;
      if ((dataOperator === "between" || dataOperator === "gte" || dataOperator === "gt") && appliedFilters.data_min && (dataOperator === "gt" ? dataEntrada <= appliedFilters.data_min : dataEntrada < appliedFilters.data_min)) return false;
      if ((dataOperator === "between" || dataOperator === "lte" || dataOperator === "lt") && appliedFilters.data_max && (dataOperator === "lt" ? dataEntrada >= appliedFilters.data_max : dataEntrada > appliedFilters.data_max)) return false;

      for (const campo of camposFiltroPersonalizados) {
        const fieldId = `custom:${campo.field_name}`;
        const rawValue = lote.campos_personalizados?.[campo.field_name];
        const displayValue = campoEngine.getValorCampo(lote, { ...campo, id: fieldId, customField: campo.field_name });
        if (["number", "calculado"].includes(campo.tipo) && !checkNumeric(fieldId, Number(rawValue || 0))) return false;
        if (campo.tipo === "date") {
          const dateValue = String(rawValue || "").split("T")[0];
          const dateOperator = operators[fieldId] || "between";
          if (dateOperator === "empty" && dateValue) return false;
          if (dateOperator === "notEmpty" && !dateValue) return false;
          if ((dateOperator === "custom" || dateOperator === "in") && appliedFilters[`${fieldId}_exact`] && !customList(appliedFilters[`${fieldId}_exact`]).includes(dateValue.toLowerCase())) return false;
          if (dateOperator === "notIn" && appliedFilters[`${fieldId}_exact`] && customList(appliedFilters[`${fieldId}_exact`]).includes(dateValue.toLowerCase())) return false;
          if (dateOperator === "exact" && appliedFilters[`${fieldId}_exact`] && dateValue !== appliedFilters[`${fieldId}_exact`]) return false;
          if (dateOperator === "different" && appliedFilters[`${fieldId}_exact`] && dateValue === appliedFilters[`${fieldId}_exact`]) return false;
          if ((dateOperator === "between" || dateOperator === "gte" || dateOperator === "gt") && appliedFilters[`${fieldId}_min`] && (dateOperator === "gt" ? dateValue <= appliedFilters[`${fieldId}_min`] : dateValue < appliedFilters[`${fieldId}_min`])) return false;
          if ((dateOperator === "between" || dateOperator === "lte" || dateOperator === "lt") && appliedFilters[`${fieldId}_max`] && (dateOperator === "lt" ? dateValue >= appliedFilters[`${fieldId}_max`] : dateValue > appliedFilters[`${fieldId}_max`])) return false;
        }
        if (!["number", "calculado", "date"].includes(campo.tipo) && !checkText(fieldId, displayValue)) return false;
      }
      return true;
    });
  }, [lotes, appliedFilters, camposFiltroPersonalizados]);

  const createLoteMutation = useMutation({
    mutationFn: (data) => loteRepository.create(data, { empresaId: empresaSelecionadaId }),
    onSuccess: async (created) => {
      if (pendingAttachments.length) {
        await Promise.all(pendingAttachments.map(({ id, ...anexo }) => base44.entities.RegistroAnexo.create({
          ...anexo,
          entity_name: "Lote",
          record_id: created.id
        })));
        setPendingAttachments([]);
      }
      queryClient.setQueryData(['lotes-cadastro', empresaSelecionadaId], (current = []) => [created, ...current]);
      await queryClient.invalidateQueries({ queryKey: ['lotes-cadastro', empresaSelecionadaId] });
      await queryClient.refetchQueries({ queryKey: ['lotes-cadastro', empresaSelecionadaId], exact: true });
      await refreshMapaCacheEntry('lotes', empresaSelecionadaId, { force: true });
      window.dispatchEvent(new CustomEvent('atualizar-mapa'));
      setShowForm(false);
      setEditingLote(null);
      toast.success('Lote cadastrado!');
    }
  });

  const updateLoteMutation = useMutation({
    mutationFn: ({ id, data, oldData }) => loteRepository.update(id, data, { oldData }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(['lotes-cadastro', empresaSelecionadaId], (current = []) =>
      current.map((item) => item.id === updated.id ? updated : item)
      );
      await queryClient.invalidateQueries({ queryKey: ['lotes-cadastro', empresaSelecionadaId] });
      await queryClient.refetchQueries({ queryKey: ['lotes-cadastro', empresaSelecionadaId], exact: true });
      await refreshMapaCacheEntry('lotes', empresaSelecionadaId, { force: true });
      window.dispatchEvent(new CustomEvent('atualizar-mapa'));
      setShowForm(false);
      setEditingLote(null);
      toast.success('Lote atualizado!');
    }
  });

  const deleteLoteMutation = useMutation({
    mutationFn: (id) => loteRepository.delete(id)
  });

  const handleSubmit = (data) => {
    if (editingLote && !editingLote._isDuplicate) {
      updateLoteMutation.mutate({ id: editingLote.id, data, oldData: editingLote });
    } else {
      const { _isDuplicate, ...cleanData } = data;
      createLoteMutation.mutate(cleanData);
    }
  };

  const handleEdit = (lote) => {
    const index = lotesFiltradosPainel.findIndex((item) => item.id === lote.id);
    if (index >= 0) setSelectedIndex(index);
    setSelectedTableItems([lote.id]);
    setEditingLote(lote);
    setShowForm(true);
    setViewMode("record");
  };

  const handleNew = () => {
    setReturnRecordAfterNew(showForm && viewMode === "record" ? editingLote || currentLote : null);
    setEditingLote(null);
    setShowForm(true);
    setViewMode("record");
    setPendingAttachments([]);
    setFormVersion((prev) => prev + 1);
  };

  const handleDuplicate = (lote) => {
    setReturnRecordAfterNew(showForm && viewMode === "record" ? lote : null);
    const { id, created_date, updated_date, created_by, numero_lote, status, ...duplicatedData } = lote;
    setEditingLote({
      ...duplicatedData,
      quantidade_cabecas: lote.quantidade_entrada ?? lote.quantidade_cabecas ?? '',
      quantidade_entrada: lote.quantidade_entrada ?? lote.quantidade_cabecas ?? '',
      categoria: lote.categoria_entrada ?? lote.categoria ?? '',
      categoria_entrada: lote.categoria_entrada ?? lote.categoria ?? '',
      categoria_manejo_id: lote.categoria_manejo_entrada_id ?? lote.categoria_manejo_id ?? '',
      categoria_manejo_nome: lote.categoria_manejo_entrada_nome ?? lote.categoria_manejo_nome ?? '',
      categoria_manejo_entrada_id: lote.categoria_manejo_entrada_id ?? lote.categoria_manejo_id ?? '',
      categoria_manejo_entrada_nome: lote.categoria_manejo_entrada_nome ?? lote.categoria_manejo_nome ?? '',
      peso_medio_kg: lote.peso_entrada_kg ?? lote.peso_medio_kg ?? '',
      peso_entrada_kg: lote.peso_entrada_kg ?? lote.peso_medio_kg ?? '',
      area_entrada_id: lote.area_entrada_id ?? lote.area_atual_id ?? '',
      area_entrada_nome: lote.area_entrada_nome ?? lote.area_atual_nome ?? '',
      area_atual_id: lote.area_entrada_id ?? lote.area_atual_id ?? '',
      area_atual_nome: lote.area_entrada_nome ?? lote.area_atual_nome ?? '',
      _isDuplicate: true
    });
    setShowForm(true);
    setViewMode("record");
    setFormVersion((prev) => prev + 1);
  };

  const handleRequestDelete = (ids) => {
    setDeleteState({ open: true, ids: Array.isArray(ids) ? ids : [ids] });
  };

  const handleOpenConfigCampos = () => {
    setFilterPanelOpen(false);
    setShowConfigCampos(true);
  };

  const currentLote = lotesFiltradosPainel[selectedIndex] || lotesFiltradosPainel[0] || null;
  const selectedTableLote = selectedTableItems.length === 1 ? lotesFiltradosPainel.find((item) => item.id === selectedTableItems[0]) : null;
  const recordForAttachments = showForm ? editingLote : selectedTableLote;

  useEffect(() => {
    if (!showForm || viewMode !== "record" || !editingLote || editingLote?._isDuplicate) return;
    if (lotesFiltradosPainel.length === 0) {
      setSelectedIndex(0);
      return;
    }

    const currentFilteredIndex = editingLote?.id ? lotesFiltradosPainel.findIndex((item) => item.id === editingLote.id) : -1;
    if (currentFilteredIndex >= 0) {
      if (selectedIndex !== currentFilteredIndex) setSelectedIndex(currentFilteredIndex);
      return;
    }

    const nextIndex = Math.min(selectedIndex, lotesFiltradosPainel.length - 1);
    setSelectedIndex(nextIndex);
    setEditingLote(lotesFiltradosPainel[nextIndex]);
    setSelectedTableItems([lotesFiltradosPainel[nextIndex].id]);
  }, [showForm, viewMode, appliedFilters, lotesFiltradosPainel, editingLote?.id, editingLote?._isDuplicate, selectedIndex]);

  const handleTableSelectionChange = useCallback((ids) => {
    setSelectedTableItems((prev) => {
      const sameSelection = prev.length === ids.length && prev.every((id, index) => id === ids[index]);
      return sameSelection ? prev : ids;
    });
    if (ids.length === 1) {
      const index = lotesFiltradosPainel.findIndex((item) => item.id === ids[0]);
      if (index >= 0) setSelectedIndex(index);
    }
  }, [lotesFiltradosPainel]);

  const handleToggleView = () => {
    if (showForm) {
      setShowForm(false);
      setEditingLote(null);
      setViewMode("table");
      return;
    }
    if (selectedTableItems.length > 1) return;
    const loteParaVisualizar = selectedTableLote || currentLote;
    if (!loteParaVisualizar) return;
    setEditingLote(loteParaVisualizar);
    setShowForm(true);
    setViewMode("record");
  };

  const navigateRecord = (index) => {
    if (!showForm) return;
    const nextIndex = Math.min(Math.max(index, 0), Math.max(lotesFiltradosPainel.length - 1, 0));
    setSelectedIndex(nextIndex);
    if (lotesFiltradosPainel[nextIndex]) {
      setEditingLote(lotesFiltradosPainel[nextIndex]);
      setSelectedTableItems([lotesFiltradosPainel[nextIndex].id]);
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['lotes-cadastro', empresaSelecionadaId] });
  };

  const handleConfirmDelete = async () => {
    const ids = deleteState.ids;
    setDeleteState({ open: false, ids: [] });

    let deletedCount = 0;

    for (const id of ids) {
      try {
        await loteRepository.ensureDeleteAllowed(id);
        await deleteLoteMutation.mutateAsync(id);
        deletedCount += 1;
      } catch {
      }
    }

    if (deletedCount > 0) {
      await queryClient.invalidateQueries({ queryKey: ['lotes-cadastro', empresaSelecionadaId] });
      await queryClient.refetchQueries({ queryKey: ['lotes-cadastro', empresaSelecionadaId], exact: true });
      await refreshMapaCacheEntry('lotes', empresaSelecionadaId, { force: true });
      window.dispatchEvent(new CustomEvent('atualizar-mapa'));
      toast.success(deletedCount === 1 ? 'Lote excluído!' : `${deletedCount} lotes excluídos!`);
    }
  };


  return (
    <div className="cadastro-lotes-rounded-scope -mt-px p-0 md:p-0 bg-[var(--background-page)] h-[calc(100dvh-var(--app-content-offset,91px))] overflow-hidden">
      {showConfigCampos && (
        <section className="w-full h-full bg-white overflow-hidden">
          <ConfiguracaoCamposLoteDialog
            open={showConfigCampos}
            onOpenChange={setShowConfigCampos}
            inline
          />
        </section>
      )}

      {!showConfigCampos && showForm &&
      <div className="flex min-h-0 h-full w-full overflow-hidden">
        <SankhyaFilterPanel
          open={filterPanelOpen}
          filters={filters}
          onChange={setFilters}
          onApply={(nextFilters) => {
            const applied = nextFilters || filters;
            setAppliedFilters(applied);
            if (applied.esconderAoAtualizar) setFilterPanelOpen(false);
          }}
          onClear={() => { setFilters({ status: "todos" }); setAppliedFilters({ status: "todos" }); }}
          lotes={lotes}
          areas={areas} />
        <div className="min-w-0 flex-1 h-full overflow-hidden">
          <FormularioLote
            key={`form-${formVersion}-${editingLote?._isDuplicate ? 'duplicate' : editingLote ? 'record' : 'new'}`}
            initialData={editingLote}
            isEditing={!!editingLote}
            onSubmit={handleSubmit}
            onCancel={() => {
              if (editingLote && !editingLote._isDuplicate) {
                setFormVersion((prev) => prev + 1);
                setViewMode("record");
                return;
              }
              if (editingLote?._isDuplicate && returnRecordAfterNew) {
                setEditingLote(returnRecordAfterNew);
                setShowForm(true);
                setViewMode("record");
                setReturnRecordAfterNew(null);
                return;
              }
              if (!editingLote && returnRecordAfterNew) {
                setEditingLote(returnRecordAfterNew);
                setShowForm(true);
                setViewMode("record");
                setReturnRecordAfterNew(null);
                return;
              }
              setShowForm(false);
              setEditingLote(null);
              setViewMode("table");
              setReturnRecordAfterNew(null);
              setPendingAttachments([]);
              setNewRecordAttachmentsOpen(false);
            }}
            onSettingsClick={handleOpenConfigCampos}
            onToggleView={handleToggleView}
            total={lotesFiltradosPainel.length}
            currentIndex={selectedIndex}
            onNew={handleNew}
            onFirst={() => navigateRecord(0)}
            onPrevious={() => navigateRecord(selectedIndex - 1)}
            onNext={() => navigateRecord(selectedIndex + 1)}
            onLast={() => navigateRecord(lotesFiltradosPainel.length - 1)}
            onDelete={() => editingLote?.id && handleRequestDelete(editingLote.id)}
            onDuplicate={() => editingLote && handleDuplicate(editingLote)}
            filterOpen={filterPanelOpen}
            filterActive={hasActiveFilters}
            onToggleFilter={() => setFilterPanelOpen((open) => !open)}
            onClearFilter={() => { setFilters({ status: "todos" }); setAppliedFilters({ status: "todos" }); }}
            onAttachClick={() => editingLote?.id ? setAttachmentsRecord(editingLote) : setNewRecordAttachmentsOpen(true)}
            attachDisabled={false}
            onRefresh={handleRefresh} />
        </div>
      </div>
      }

      <div className={showForm || showConfigCampos ? "hidden" : "flex min-h-0 h-full w-full overflow-hidden"}>
        <SankhyaFilterPanel
          open={filterPanelOpen}
          filters={filters}
          onChange={setFilters}
          onApply={(nextFilters) => {
            const applied = nextFilters || filters;
            setAppliedFilters(applied);
            if (applied.esconderAoAtualizar) setFilterPanelOpen(false);
          }}
          onClear={() => { setFilters({ status: "todos" }); setAppliedFilters({ status: "todos" }); }}
          lotes={lotes}
          areas={areas} />
        <div className="min-w-0 flex-1 h-full overflow-hidden flex flex-col">
          <SankhyaListToolbar
            viewMode={viewMode}
            total={lotesFiltradosPainel.length}
            currentIndex={selectedIndex}
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            onNew={handleNew}
            onToggleView={handleToggleView}
            toggleViewDisabled={selectedTableItems.length > 1}
            filterOpen={filterPanelOpen}
            filterActive={hasActiveFilters}
            onToggleFilter={() => setFilterPanelOpen((open) => !open)}
            onClearFilter={() => { setFilters({ status: "todos" }); setAppliedFilters({ status: "todos" }); }}
            onFirst={() => navigateRecord(0)}
            onPrevious={() => navigateRecord(selectedIndex - 1)}
            onNext={() => navigateRecord(selectedIndex + 1)}
            onLast={() => navigateRecord(lotesFiltradosPainel.length - 1)}
            onDelete={() => selectedTableItems.length > 0 && handleRequestDelete(selectedTableItems)}
            onDuplicate={() => selectedTableLote && handleDuplicate(selectedTableLote)}
            onRefresh={handleRefresh}
            onAttachClick={() => selectedTableLote && setAttachmentsRecord(selectedTableLote)}
            attachDisabled={selectedTableItems.length !== 1}

            onExportPdf={() => {
               const config = getLotesPdfExportConfig();
               const sourceColumns = config.useConfiguredColumns ? visibleTableData.allColumns || visibleTableData.columns : visibleTableData.columns;
               const sourceRows = config.useConfiguredColumns ? visibleTableData.allRows || visibleTableData.rows : visibleTableData.rows;
               const sourceSelectedRows = config.useConfiguredColumns ? visibleTableData.allSelectedRows || visibleTableData.selectedRows : visibleTableData.selectedRows;
               const sourceTotalRows = config.useConfiguredColumns ? visibleTableData.allTotalRows || visibleTableData.totalRows : visibleTableData.totalRows;
               const selectedColumns = config.useConfiguredColumns && config.columnIds.length ? sourceColumns.filter((column) => config.columnIds.includes(column.id)) : sourceColumns;
               const selectedIndexes = selectedColumns.map((column) => sourceColumns.findIndex((item) => item.id === column.id));
               const filterRows = (rows = []) => rows.map((row) => selectedIndexes.map((index) => row[index]));

               printVisibleLotesTable({
                 columns: selectedColumns,
                 rows: filterRows(selectedTableItems.length > 0 ? sourceSelectedRows || [] : sourceRows || []),
                 totalRows: filterRows(sourceTotalRows || []),
                 title: `Exportar PDF - ${new Date().toLocaleDateString('pt-BR')}`
               });
             }}
             onConfigExportPdf={() => setShowConfigPdf(true)}
             onExportExcel={() => {
               const config = getLotesExcelExportConfig();
               const sourceColumns = config.useConfiguredColumns ? visibleTableData.allColumns || visibleTableData.columns : visibleTableData.columns;
               const sourceRows = config.useConfiguredColumns ? visibleTableData.allRows || visibleTableData.rows : visibleTableData.rows;
               const sourceSelectedRows = config.useConfiguredColumns ? visibleTableData.allSelectedRows || visibleTableData.selectedRows : visibleTableData.selectedRows;
               const sourceTotalRows = config.useConfiguredColumns ? visibleTableData.allTotalRows || visibleTableData.totalRows : visibleTableData.totalRows;
               const selectedColumns = config.useConfiguredColumns && config.columnIds.length ? sourceColumns.filter((column) => config.columnIds.includes(column.id)) : sourceColumns;
               const selectedIndexes = selectedColumns.map((column) => sourceColumns.findIndex((item) => item.id === column.id));
               const filterRows = (rows = []) => rows.map((row) => selectedIndexes.map((index) => row[index]));

               exportVisibleLotesTableToExcel({
                 columns: selectedColumns,
                 rows: filterRows(selectedTableItems.length > 0 ? sourceSelectedRows || [] : sourceRows || []),
                 totalRows: filterRows(sourceTotalRows || []),
                 title: `Exportar Excel - ${new Date().toLocaleDateString('pt-BR')}`
               });
             }}
            onConfigExportExcel={() => setShowConfigExcel(true)}
            onConfigColumns={() => setShowConfigColunas(true)}
            selectedCount={selectedTableItems.length}
            title="Cadastro de Lotes"
            recordLabel="" />
          <TabelaLotes
            key="table"
            lotes={lotesFiltradosPainel}
            areas={areas}
            onEdit={handleEdit}
            onDuplicate={handleDuplicate}
            onDelete={handleRequestDelete}
            lotesComMovimentacoes={lotesComMovimentacoes}
            showConfigColunas={showConfigColunas}
            setShowConfigColunas={setShowConfigColunas}
            searchTerm={searchTerm}
            selectedRecordId={showForm ? editingLote?.id : undefined}
            onSelectionChange={handleTableSelectionChange}
            onVisibleDataChange={setVisibleTableData} />
        </div>
      </div>

      <ConfiguracaoExportacaoPdfLotesDialog
        open={showConfigPdf}
        onOpenChange={setShowConfigPdf}
        columns={visibleTableData.allColumns || visibleTableData.columns || []}
        initialConfig={getLotesPdfExportConfig()}
        tipo="pdf" />

      <ConfiguracaoExportacaoPdfLotesDialog
        open={showConfigExcel}
        onOpenChange={setShowConfigExcel}
        columns={visibleTableData.allColumns || visibleTableData.columns || []}
        initialConfig={getLotesExcelExportConfig()}
        tipo="excel" />

      <RegistroAnexosDialog
        open={!!attachmentsRecord?.id || newRecordAttachmentsOpen}
        onOpenChange={(open) => {
          if (!open) {
            setAttachmentsRecord(null);
            setNewRecordAttachmentsOpen(false);
          }
        }}
        entityName="Lote"
        recordId={attachmentsRecord?.id}
        title={attachmentsRecord?.nome || attachmentsRecord?.numero_lote || "Novo lote"}
        pendingAnexos={pendingAttachments}
        onPendingChange={setPendingAttachments} />

      <ConfirmDialog
        open={deleteState.open}
        onOpenChange={(open) => setDeleteState((prev) => ({ ...prev, open }))}
        title="Confirmar exclusão"
        description={deleteState.ids.length > 1 ? `Deseja realmente excluir ${deleteState.ids.length} lotes selecionados?` : 'Deseja realmente excluir este lote?'}
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="destructive"
        onConfirm={handleConfirmDelete} />
      
    </div>);

}