import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Filter, Plus, ChevronDown, ChevronRight } from "lucide-react";
import SankhyaFilterConfigDialog from "./SankhyaFilterConfigDialog";
import SankhyaCodeNameLookup from "./SankhyaCodeNameLookup";
import loteRepository from "@/core/repositories/loteRepository";
import campoEngine from "@/services/campoEngine";
import { buildFiltersFromPreset } from "@/components/filters/filterPresetUtils";

const FIELD_DEFS = [
{ id: "lote_codigo_nome", label: "Lote", group: "Detalhes do lote", type: "codeName", metadata: { searchable: true, sortable: true, favorite: true, quickFilter: true, width: 220, pinned: false, exportable: true } },
{ id: "sexo", label: "Sexo", group: "Detalhes do lote", type: "select", options: ["Macho", "Fêmea", "Misto"], metadata: { searchable: true, sortable: true, favorite: false, quickFilter: true, width: 120, pinned: false, exportable: true } },
{ id: "quantidade", label: "Quantidade de cabeças", group: "Detalhes do lote", type: "number", metadata: { searchable: true, sortable: true, favorite: true, quickFilter: true, width: 150, pinned: false, exportable: true } },
{ id: "peso", label: "Peso médio", group: "Detalhes do lote", type: "number", metadata: { searchable: true, sortable: true, favorite: true, quickFilter: true, width: 130, pinned: false, exportable: true } },
{ id: "categoria", label: "Categoria", group: "Detalhes do lote", type: "text", metadata: { searchable: true, sortable: true, favorite: false, quickFilter: true, width: 160, pinned: false, exportable: true } },
{ id: "status", label: "Status", group: "Detalhes do lote", type: "select", options: ["Ativo", "Inativo", "Vendido", "Abatido", "Transferido"], metadata: { searchable: true, sortable: true, favorite: true, quickFilter: true, width: 120, pinned: false, exportable: true } },
{ id: "identificador", label: "Identificador", group: "Identificação", type: "text", metadata: { searchable: true, sortable: true, favorite: false, quickFilter: true, width: 180, pinned: false, exportable: true } },
{ id: "sigla", label: "Sigla", group: "Identificação", type: "text", metadata: { searchable: true, sortable: true, favorite: false, quickFilter: true, width: 90, pinned: false, exportable: true } },
{ id: "raca", label: "Raça predominante", group: "Detalhes do lote", type: "text", metadata: { searchable: true, sortable: true, favorite: false, quickFilter: true, width: 160, pinned: false, exportable: true } },
{ id: "sistema_produtivo", label: "Sistema produtivo", group: "Detalhes do lote", type: "text", metadata: { searchable: true, sortable: true, favorite: false, quickFilter: true, width: 180, pinned: false, exportable: true } },
{ id: "motivo", label: "Motivo", group: "Entrada", type: "select", options: ["Compra", "Ajuste", "Inventário", "Outros"], metadata: { searchable: true, sortable: true, favorite: false, quickFilter: true, width: 140, pinned: false, exportable: true } },
{ id: "origem", label: "Origem", group: "Entrada", type: "text", metadata: { searchable: true, sortable: true, favorite: false, quickFilter: true, width: 140, pinned: false, exportable: true } },
{ id: "fornecedor", label: "Fornecedor", group: "Compra", type: "text", metadata: { searchable: true, sortable: true, favorite: false, quickFilter: true, width: 160, pinned: false, exportable: true } },
{ id: "nota_fiscal", label: "Nota fiscal", group: "Compra", type: "text", metadata: { searchable: true, sortable: true, favorite: false, quickFilter: true, width: 130, pinned: false, exportable: true } },
{ id: "numero_gta", label: "GTA", group: "Compra", type: "text", metadata: { searchable: true, sortable: true, favorite: false, quickFilter: true, width: 120, pinned: false, exportable: true } },
{ id: "cidade_origem", label: "Cidade origem", group: "Compra", type: "text", metadata: { searchable: true, sortable: true, favorite: false, quickFilter: true, width: 150, pinned: false, exportable: true } },
{ id: "estado_origem", label: "UF origem", group: "Compra", type: "text", metadata: { searchable: true, sortable: true, favorite: false, quickFilter: true, width: 90, pinned: false, exportable: true } },
{ id: "valor", label: "Valor total", group: "Compra", type: "number", metadata: { searchable: true, sortable: true, favorite: false, quickFilter: true, width: 140, pinned: false, exportable: true } },
{ id: "valor_por_cabeca", label: "Valor por cabeça", group: "Compra", type: "number", metadata: { searchable: true, sortable: true, favorite: false, quickFilter: true, width: 150, pinned: false, exportable: true } },
{ id: "valor_frete", label: "Valor frete", group: "Compra", type: "number", metadata: { searchable: true, sortable: true, favorite: false, quickFilter: true, width: 130, pinned: false, exportable: true } },
{ id: "observacoes", label: "Observações", group: "Observações", type: "text", metadata: { searchable: true, sortable: false, favorite: false, quickFilter: true, width: 220, pinned: false, exportable: true } },
{ id: "area_codigo_nome", label: "Área", group: "Localização", type: "codeNameDynamic", source: "areas", metadata: { searchable: true, sortable: true, favorite: true, quickFilter: true, width: 180, pinned: false, exportable: true } },
{ id: "setor_codigo_nome", label: "Setor", group: "Localização", type: "codeNameDynamic", source: "setores", metadata: { searchable: true, sortable: true, favorite: false, quickFilter: true, width: 180, pinned: false, exportable: true } },
{ id: "data", label: "Data de entrada", group: "Identificação", type: "date", metadata: { searchable: true, sortable: true, favorite: false, quickFilter: false, width: 130, pinned: false, exportable: true } }];


const DEFAULT_FIELDS = ["lote_codigo_nome", "sexo", "quantidade", "peso", "area_codigo_nome", "setor_codigo_nome"];
const DEFAULT_OPERATORS = { quantidade: "between", peso: "between", data: "between" };
const DEFAULT_FOLDERS = [
{ id: "detalhes_lote", name: "Detalhes do lote" },
{ id: "localizacao", name: "Localização" },
{ id: "identificacao", name: "Identificação" }];

const DEFAULT_FIELD_GROUPS = FIELD_DEFS.reduce((acc, field) => {
  const folder = DEFAULT_FOLDERS.find((item) => item.name === field.group);
  acc[field.id] = folder?.id || DEFAULT_FOLDERS[0].id;
  return acc;
}, {});
const FILTER_CONFIGS_KEY = "cadastro_lotes_filter_configs";
const ACTIVE_FILTER_CONFIG_KEY = "cadastro_lotes_active_filter_config";
const DEFAULT_FILTER_CONFIG = {
  id: "padrao",
  name: "PADRÃO",
  visibleFields: DEFAULT_FIELDS,
  operators: DEFAULT_OPERATORS,
  filterFolders: DEFAULT_FOLDERS,
  fieldGroups: DEFAULT_FIELD_GROUPS
};
const inputClass = "h-6 rounded-none border-slate-300 px-1.5 text-xs shadow-none";
const selectClass = "h-6 rounded-none border-slate-300 px-1.5 text-xs shadow-none";

export default function SankhyaFilterPanel({ open, filters, onChange, onApply, onClear, lotes = [], areas = [] }) {
  const [filterConfigs, setFilterConfigs] = useState(() => {
    const saved = localStorage.getItem(FILTER_CONFIGS_KEY);
    if (!saved) return [DEFAULT_FILTER_CONFIG];
    try {
      const parsed = JSON.parse(saved);
      return parsed.length ? parsed : [DEFAULT_FILTER_CONFIG];
    } catch {
      return [DEFAULT_FILTER_CONFIG];
    }
  });
  const [activeConfigId, setActiveConfigId] = useState(() => localStorage.getItem(ACTIVE_FILTER_CONFIG_KEY) || "padrao");
  const activeConfig = filterConfigs.find((config) => config.id === activeConfigId) || filterConfigs[0] || DEFAULT_FILTER_CONFIG;
  const [visibleFields, setVisibleFields] = useState(activeConfig.visibleFields || DEFAULT_FIELDS);
  const [operators, setOperators] = useState(activeConfig.operators || DEFAULT_OPERATORS);
  const [configOpen, setConfigOpen] = useState(false);
  const [filterFolders, setFilterFolders] = useState(activeConfig.filterFolders || DEFAULT_FOLDERS);
  const [fieldGroups, setFieldGroups] = useState(activeConfig.fieldGroups || DEFAULT_FIELD_GROUPS);
  const [fieldValues, setFieldValues] = useState(activeConfig.fieldValues || {});
  const [fieldConfigs, setFieldConfigs] = useState(activeConfig.fieldConfigs || {});
  const [openGroups, setOpenGroups] = useState(Object.fromEntries((activeConfig.filterFolders || DEFAULT_FOLDERS).map((folder) => [folder.id, true])));

  const { data: camposPersonalizados = [] } = useQuery({
    queryKey: ["lote-campos-personalizados"],
    queryFn: () => loteRepository.listCamposPersonalizados(),
    initialData: []
  });

  const customFields = useMemo(() => {
    return camposPersonalizados.map(campoEngine.normalize).filter((campo) => campo.ativo !== false && campo.visivel_tabela !== false).map((campo) => ({
      id: `custom:${campo.field_name}`,
      label: campo.label,
      group: "Campos personalizados",
      type: ["number", "calculado"].includes(campo.tipo) ? "number" : campo.tipo === "date" ? "date" : campo.tipo === "boolean" || campo.tipo === "checkbox" ? "boolean" : campo.tipo === "select" && (campo.options || []).length > 0 ? "select" : "text",
      options: (campo.options || []).map((option) => option.label || option.value || option).sort((a, b) => String(a).localeCompare(String(b), "pt-BR", { sensitivity: "base" })),
      customField: campo.field_name,
      campo,
      metadata: { searchable: true, sortable: true, favorite: false, hidden: false, quickFilter: false, width: 160, pinned: false, exportable: true, customField: true }
    }));
  }, [camposPersonalizados]);

  const allFields = useMemo(() => [...FIELD_DEFS, ...customFields], [customFields]);

  const options = useMemo(() => {
    const uniqBy = (items, key) => Array.from(new Map(items.filter((item) => item?.[key]).map((item) => [item[key], item])).values()).
    sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));

    return {
      areas: uniqBy([
      ...areas.map((a) => ({
        codigo: a.numero_area || a.codigo || a.cod_area || "",
        nome: a.nome,
        id: a.id,
        details: [a.setor_nome && `Setor: ${a.setor_nome}`, a.tipo_area && `Tipo: ${a.tipo_area}`, a.status && `Status: ${a.status}`]
      })),
      ...lotes.map((l) => ({
        codigo: l.area_atual_codigo || l.area_entrada_codigo || "",
        nome: l.area_atual_nome || l.area_entrada_nome,
        id: l.area_atual_id || l.area_entrada_id,
        details: [l.setor_nome && `Setor: ${l.setor_nome}`, l.nome && `Lote vinculado: ${l.nome}`]
      }))],
      "nome"),
      setores: uniqBy(lotes.map((l) => ({
        codigo: l.setor_codigo || l.numero_setor || "",
        nome: l.setor_nome,
        id: l.setor_id,
        details: [l.area_atual_nome && `Área: ${l.area_atual_nome}`, l.nome && `Lote: ${l.nome}`]
      })), "nome"),
      lotes: uniqBy(lotes.map((l) => ({
        codigo: l.numero_lote,
        nome: l.nome,
        id: l.id,
        details: [l.categoria && `Categoria: ${l.categoria}`, l.area_atual_nome && `Área atual: ${l.area_atual_nome}`, l.status && `Status: ${l.status}`]
      })), "nome")
    };
  }, [areas, lotes]);

  useEffect(() => {
    localStorage.setItem(FILTER_CONFIGS_KEY, JSON.stringify(filterConfigs));
  }, [filterConfigs]);

  useEffect(() => {
    localStorage.setItem(ACTIVE_FILTER_CONFIG_KEY, activeConfigId);
  }, [activeConfigId]);

  useEffect(() => {
    const config = filterConfigs.find((item) => item.id === activeConfigId) || filterConfigs[0] || DEFAULT_FILTER_CONFIG;
    setVisibleFields(config.visibleFields || DEFAULT_FIELDS);
    setOperators(config.operators || DEFAULT_OPERATORS);
    setFilterFolders(config.filterFolders || DEFAULT_FOLDERS);
    setFieldGroups(config.fieldGroups || DEFAULT_FIELD_GROUPS);
    setFieldValues(config.fieldValues || {});
    setFieldConfigs(config.fieldConfigs || {});
    const presetFilters = buildFiltersFromPreset(config, allFields, filters);
    if (Object.keys(presetFilters).length > 1 && Object.keys(config.fieldValues || {}).length) {
      onChange(presetFilters);
      if (Object.values(config.fieldConfigs || {}).some((fieldConfig) => fieldConfig?.autoApply)) {
        onApply(presetFilters);
      }
    }
    setOpenGroups(Object.fromEntries((config.filterFolders || DEFAULT_FOLDERS).map((folder) => [folder.id, true])));
  }, [activeConfigId, allFields.length]);

  const handleSaveConfig = (name, createNew = false) => {
    const id = createNew ? `filtro_${Date.now()}` : activeConfigId || `filtro_${Date.now()}`;
    const mergedFieldConfigs = Object.fromEntries(visibleFields.map((fieldId) => [fieldId, {
      ...(fieldConfigs[fieldId] || {}),
      operator: operators[fieldId],
      value: fieldValues[fieldId] || {},
      defaultValue: fieldValues[fieldId] || {}
    }]));
    const nextConfig = { id, name, visibleFields, operators, filterFolders, fieldGroups, fieldValues, fieldConfigs: mergedFieldConfigs };
    setFilterConfigs((prev) => createNew ? [...prev.filter((config) => config.id !== id), nextConfig] : prev.map((config) => config.id === id ? nextConfig : config));
    setActiveConfigId(id);
  };

  const handleDeleteConfig = (id) => {
    if (filterConfigs.length <= 1) return;
    const next = filterConfigs.filter((config) => config.id !== id);
    setFilterConfigs(next);
    if (activeConfigId === id) setActiveConfigId(next[0]?.id || "padrao");
  };

  if (!open) return null;

  const update = (field, value) => onChange({ ...filters, [field]: value });

  const clearAll = () => {
    onClear();
  };

  const toggleCustomFilter = (checked) => {
    if (!checked) {
      setActiveConfigId("padrao");
      return;
    }
    setConfigOpen(true);
  };

  const applyFilters = () => {
    const nextFilters = { ...filters, _operators: operators };
    onChange(nextFilters);
    onApply(nextFilters);
  };

  const renderNumberInput = (field, suffix) =>
  <Input inputMode="decimal" value={filters[`${field.id}_${suffix}`] || ""} onChange={(e) => update(`${field.id}_${suffix}`, e.target.value)} className={inputClass} />;


  const renderDateInput = (field, suffix) =>
  <Input type="date" value={filters[`${field.id}_${suffix}`] || ""} onChange={(e) => update(`${field.id}_${suffix}`, e.target.value)} className={inputClass} />;


  const renderOperatedField = (field, renderInput) => {
    const operator = operators[field.id] || "between";
    if (operator === "between") {
      return <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1">{renderInput(field, "min")}<span className="text-slate-500">a</span>{renderInput(field, "max")}</div>;
    }
    if (operator === "empty" || operator === "notEmpty") {
      return <div className="h-6 flex items-center px-1.5 border border-slate-200 bg-slate-50 text-[11px] text-slate-500">Não precisa preencher valor</div>;
    }
    const suffix = operator === "gte" || operator === "gt" ? "min" : operator === "lte" || operator === "lt" ? "max" : "exact";
    return renderInput(field, suffix);
  };

  const renderCodeName = (prefix, source, label) =>
  <SankhyaCodeNameLookup
    label={label}
    prefix={prefix}
    source={options[source] || []}
    filters={filters}
    onChange={onChange} />;



  const renderField = (fieldId) => {
    const field = allFields.find((item) => item.id === fieldId);
    if (!field) return null;

    return (
      <div key={field.id} className="rounded-sm border border-slate-200 bg-white p-1.5 shadow-sm hover:border-primary/40">
        <div className="mb-1 flex items-center justify-between gap-2">
          <label className="min-w-0 truncate font-semibold text-slate-700">{field.label}</label>
        </div>
        {field.type === "codeName" && renderCodeName("lote", "lotes", "Lote")}
        {field.type === "codeNameDynamic" && renderCodeName(field.id.replace("_codigo_nome", ""), field.source, field.label)}
        {field.type === "text" && <Input value={filters[field.id] || ""} onChange={(e) => update(field.id, e.target.value)} placeholder={["custom", "in", "notIn"].includes(operators[field.id] || "contains") ? "Ex: X; Y; Z" : ""} className={inputClass} />}
        {field.type === "select" &&
        <Input value={filters[field.id] || ""} onChange={(e) => update(field.id, e.target.value)} placeholder={["custom", "in", "notIn"].includes(operators[field.id] || "contains") ? "Ex: X; Y; Z" : "Digite o valor"} className={inputClass} />}
        {field.type === "number" && renderOperatedField(field, renderNumberInput)}
        {field.type === "date" && renderOperatedField(field, renderDateInput)}
      </div>);

  };

  const groupedFolders = filterFolders.map((folder) => ({
    ...folder,
    fields: visibleFields.filter((fieldId) => (fieldGroups[fieldId] || DEFAULT_FOLDERS[0].id) === folder.id)
  })).filter((folder) => folder.fields.length > 0);

  if (configOpen) {
    return (
      <section className="w-full h-full min-h-0 shrink-0 border-r border-slate-300 bg-white overflow-hidden">
        <SankhyaFilterConfigDialog
          inline
          open={configOpen}
          onOpenChange={setConfigOpen}
          fields={allFields}
          visibleFields={visibleFields}
          setVisibleFields={setVisibleFields}
          operators={operators}
          setOperators={setOperators}
          filterFolders={filterFolders}
          setFilterFolders={setFilterFolders}
          fieldGroups={fieldGroups}
          setFieldGroups={setFieldGroups}
          fieldValues={fieldValues}
          setFieldValues={setFieldValues}
          fieldConfigs={fieldConfigs}
          setFieldConfigs={setFieldConfigs}
          setOpenGroups={setOpenGroups}
          filterConfigs={filterConfigs}
          activeConfigId={activeConfigId}
          onSelectConfig={setActiveConfigId}
          onSaveConfig={handleSaveConfig}
          onDeleteConfig={handleDeleteConfig}
          relationOptions={options} />
        
      </section>);

  }

  return (
    <aside className="w-[310px] shrink-0 border-r border-slate-300 bg-white text-xs h-full min-h-0 overflow-hidden flex flex-col">
      <div className="border-slate-300 p-1 space-y-1 bg-white shrink-0 border">
        <div className="flex items-center gap-2 h-6">
          <Checkbox checked={!!filters.esconderAoAtualizar} onCheckedChange={(checked) => update("esconderAoAtualizar", !!checked)} className="h-3.5 w-3.5 rounded-none" />
          <span className="font-semibold text-slate-700">Esconder ao atualizar</span>
        </div>
        <div className="grid grid-cols-[88px_1fr] gap-1">
          <Button type="button" onClick={() => setConfigOpen(true)} className="h-7 rounded-none bg-primary hover:bg-primary/90 text-white text-xs px-1"><Plus className="w-4 h-4" /> Filtro</Button>
          <Button type="button" onClick={applyFilters} className="h-7 rounded-none bg-slate-700 hover:bg-slate-800 text-white text-xs">Aplicar</Button>
        </div>
        <div className="border-t border-slate-200 pt-1">
          <Select value={activeConfigId || "padrao"} onValueChange={setActiveConfigId}>
            <SelectTrigger className="h-7 rounded-none border-slate-300 px-2 text-xs shadow-none">
              <SelectValue placeholder="FILTROS PERSONALIZADOS" />
            </SelectTrigger>
            <SelectContent>
              {filterConfigs.map((config) =>
              <SelectItem key={config.id} value={config.id} className="text-xs">
                  {config.name}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="h-8 px-1.5 flex items-center justify-between border-b border-slate-300 bg-slate-50 font-semibold text-slate-700 shrink-0">
        <span>Filtros rápidos</span>
        <button type="button" onClick={clearAll} className="relative text-slate-500 hover:text-primary"><Filter className="w-4 h-4" /><span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary text-white text-[9px] leading-3">×</span></button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {groupedFolders.map((folder) =>
        <div key={folder.id} className="border-b border-slate-300">
            <button type="button" onClick={() => setOpenGroups({ ...openGroups, [folder.id]: !openGroups[folder.id] })} className="w-full h-8 px-2 flex items-center justify-between gap-1 bg-slate-50 font-semibold text-slate-700 text-left hover:bg-primary/5">
              <span className="flex min-w-0 items-center gap-1">
                {openGroups[folder.id] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                <span className="truncate">{folder.name}</span>
              </span>
              <span className="rounded-sm bg-white px-1.5 py-0.5 text-[10px] text-slate-500 border border-slate-200">{folder.fields.length}</span>
            </button>
            {openGroups[folder.id] && <div className="p-1.5 space-y-1.5">{folder.fields.map(renderField)}</div>}
          </div>
        )}

      </div>

      <SankhyaFilterConfigDialog
        open={false}
        onOpenChange={setConfigOpen}
        fields={allFields}
        visibleFields={visibleFields}
        setVisibleFields={setVisibleFields}
        operators={operators}
        setOperators={setOperators}
        filterFolders={filterFolders}
        setFilterFolders={setFilterFolders}
        fieldGroups={fieldGroups}
        setFieldGroups={setFieldGroups}
        fieldValues={fieldValues}
        setFieldValues={setFieldValues}
        fieldConfigs={fieldConfigs}
        setFieldConfigs={setFieldConfigs}
        setOpenGroups={setOpenGroups}
        filterConfigs={filterConfigs}
        activeConfigId={activeConfigId}
        onSelectConfig={setActiveConfigId}
        onSaveConfig={handleSaveConfig}
        onDeleteConfig={handleDeleteConfig}
        relationOptions={options} />
      
    </aside>);

}