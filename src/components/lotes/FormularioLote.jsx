import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { useQuery } from "@tanstack/react-query";
import useSetorAreas from "@/hooks/useSetorAreas";
import loteRepository from "@/core/repositories/loteRepository";
import campoEngine from "@/services/campoEngine";
import AutocompleteGenerico from "@/components/financeiro/AutocompleteGenerico";
import TopNoticeDialog from "@/components/common/TopNoticeDialog";
import LegacyRecordToolbar from "./LegacyRecordToolbar.jsx";
import LegacyTabs from "./LegacyTabs.jsx";
import DynamicFormRenderer from "@/components/dynamic/DynamicFormRenderer";
import LayoutConfiguratorDialog from "@/components/dynamic/LayoutConfiguratorDialog";
import ToggleSwitch from "@/components/common/ToggleSwitch";
import CustomOptionListControl from "./CustomOptionListControl.jsx";

const FL = ({ label, required, error, children, dataField, wide = false, compact = false, medium = false }) =>
<div data-field={dataField} className={`grid grid-cols-[190px_minmax(0,1fr)] items-center gap-1 ${wide ? "md:col-span-2" : ""}`}>
    <label className="text-[12px] text-slate-600 text-right leading-none">
      {label}:{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    <div className={`${wide ? 'min-h-6' : 'h-6'} ${medium ? 'w-64 max-w-full' : compact ? 'w-44 max-w-full' : 'w-full'} border ${error ? 'border-red-500 bg-red-50' : 'border-slate-300 bg-white'} rounded-[1.5px] focus-within:border-green-500 transition-colors overflow-hidden [&_input]:h-[22px] [&_input]:border-0 [&_input]:rounded-none [&_input]:shadow-none [&_input]:focus-visible:ring-0 [&_button]:h-[22px] [&_button]:border-0 [&_button]:rounded-none [&_button]:shadow-none [&_textarea]:min-h-[48px] [&_textarea]:rounded-none [&_textarea]:border-0 [&_textarea]:shadow-none [&_textarea]:focus-visible:ring-0`}>
      {children}
    </div>
  </div>;


const SISTEMAS = ["Cria", "Recria", "Engorda", "Ciclo Completo"];
const MOTIVOS_ENTRADA = ["Compra", "Ajuste", "Inventário", "Outros"];
const UPPERCASE_FIELDS = [
"nome",
"identificador_nome",
"identificador_sigla",
"raca_predominante",
"cidade_origem",
"estado_origem",
"nota_fiscal",
"chave_nfe",
"numero_gta",
"motivo_ajuste",
"motivo_outros",
"observacoes"];

const REQUIRED_FIELDS = [
  "nome",
  "quantidade_cabecas",
  "data_entrada",
  "categoria_manejo_id",
  "categoria",
  "sexo",
  "raca_predominante",
  "peso_medio_kg",
  "idade_media_meses",
  "setor_id",
  "area_entrada_id",
  "sistema_produtivo",
  "motivo_entrada"];

const MOTIVO_ENTRADA_MAP = {
  "COMPRA": "Compra",
  "AJUSTE": "Ajuste",
  "INVENTÁRIO": "Inventário",
  "OUTROS": "Outros"
};

const CORES_DISPONIVEIS = [
{ nome: "Branco", cor: "#f8f9fa" },
{ nome: "Cinza claro", cor: "#d8dee2" },
{ nome: "Preto", cor: "#2c303e" },
{ nome: "Azul escuro", cor: "#0d67ad" },
{ nome: "Azul celeste", cor: "#61aad9" },
{ nome: "Amarelo", cor: "#efcb19" },
{ nome: "Verde claro", cor: "#92ca25" },
{ nome: "Laranja", cor: "#f5a01b" },
{ nome: "Roxo", cor: "#966fe1" }];


const parseSistemasProdutivos = (valor) => {
  if (Array.isArray(valor)) return valor;
  if (!valor) return [];
  return String(valor).
  split(",").
  map((item) => item.trim()).
  filter(Boolean);
};


export default function FormularioLote({ onSubmit, onCancel, onSettingsClick, onAttachClick, attachDisabled = false, onToggleView, total = 0, currentIndex = 0, onNew, onFirst, onPrevious, onNext, onLast, onDelete, onDuplicate, onRefresh, filterOpen = false, filterActive = false, onToggleFilter, onClearFilter, initialData, isEditing }) {
  const isDuplicating = !!initialData?._isDuplicate;
  const shouldPersistEntrySnapshot = !isEditing || isDuplicating;
  const empresaSelecionadaId = localStorage.getItem("empresa_selecionada_id");
  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState("geral");
  const [layoutConfigOpen, setLayoutConfigOpen] = useState(false);
  const [noticeDialog, setNoticeDialog] = useState({ open: false, title: "", description: "" });
  const [formLayoutConfig, setFormLayoutConfig] = useState(() => {
    const saved = localStorage.getItem("cadastro_lotes_form_layout_config");
    if (!saved) return null;
    try {return JSON.parse(saved);} catch {return null;}
  });
  const [isDirty, setIsDirty] = useState(!isEditing || isDuplicating);
  const [editMode, setEditMode] = useState(!isEditing || isDuplicating);
  // Função rápida para garantir que a data de edição vá para o formato AAAA-MM-DD
  const carregarDataEntrada = (data) => {
    if (!data) return new Date().toLocaleDateString("sv-SE");
    if (data.includes("/")) {
      const [dia, mes, ano] = data.split("/");
      return `${ano}-${mes}-${dia}`;
    }
    return data.split("T")[0]; // Remove horas se vier do banco como DateTime
  };

  const buildFormData = (data) => data ? {
    ...data,
    sistema_produtivo: parseSistemasProdutivos(data.sistema_produtivo),
    data_entrada: carregarDataEntrada(data.data_entrada)
  } : {
    nome: "",
    quantidade_cabecas: "",
    categoria: "",
    categoria_manejo_id: "",
    sexo: "",
    peso_medio_kg: "",
    idade_media_meses: "",
    setor_id: "",
    area_entrada_id: "",
    raca_predominante: "",
    sistema_produtivo: [],
    data_entrada: new Date().toLocaleDateString("sv-SE"),
    motivo_entrada: "",
    fornecedor_id: "",
    fornecedor_nome: "",
    nota_fiscal: "",
    chave_nfe: "",
    numero_gta: "",
    cidade_origem: "",
    estado_origem: "",
    valor_total_compra: "",
    valor_por_cabeca: "",
    valor_frete: "",
    motivo_ajuste: "",
    motivo_outros: "",
    observacoes: "",
    identificador_nome: "",
    identificador_sigla: "",
    identificador_cor: "",
    status: "Ativo"
  };

  const [formData, setFormData] = useState(() => buildFormData(initialData));

  React.useEffect(() => {
    setFormData(buildFormData(initialData));
    setErrors({});
    setIsDirty(!isEditing || !!initialData?._isDuplicate);
    setEditMode(!isEditing || !!initialData?._isDuplicate);
  }, [initialData?.id, initialData?.numero_lote, initialData?._isDuplicate, isEditing]);

  const { setores, areas, getAreasBySetor } = useSetorAreas(empresaSelecionadaId);

  const { data: categoriasManejo = [] } = useQuery({
    queryKey: ["categorias-manejo", empresaSelecionadaId],
    queryFn: () => loteRepository.listCategoriasManejo(empresaSelecionadaId),
    enabled: !!empresaSelecionadaId
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores", empresaSelecionadaId],
    queryFn: () => loteRepository.listFornecedores(empresaSelecionadaId),
    enabled: !!empresaSelecionadaId
  });

  const { data: camposPersonalizados = [] } = useQuery({
    queryKey: ["lote-campos-personalizados"],
    queryFn: () => loteRepository.listCamposPersonalizados(),
    initialData: []
  });

  const camposPersonalizadosForm = useMemo(() => {
    return camposPersonalizados.map(campoEngine.normalize).filter((campo) => campo.ativo !== false && campo.visivel_form !== false && !campo.metadata?.native_select);
  }, [camposPersonalizados]);

  const motivoEntradaConfig = useMemo(() => {
    return camposPersonalizados.find((campo) => campo.metadata?.native_select && campo.field_name === "motivo_entrada") || null;
  }, [camposPersonalizados]);

  const relatedSources = useMemo(() => camposPersonalizadosForm.
  map((campo) => {
    const entity = campoEngine.getOptionsSourceKey(campo);
    return campo.tipo === "relation" && entity ? { entity, labelField: campo.options_label_field || campo.relation_display_field || "nome", valueField: campo.options_value_field || "id" } : null;
  }).
  filter(Boolean), [camposPersonalizadosForm]);

  const { data: relatedOptions = {} } = useQuery({
    queryKey: ["lote-form-related-options", relatedSources.map((source) => `${source.entity}:${source.labelField}:${source.valueField}`).join("|")],
    queryFn: () => loteRepository.listOptionsSources(relatedSources),
    enabled: relatedSources.length > 0,
    initialData: {}
  });

  React.useEffect(() => {
    const areaSelecionada = areas.find((item) => item.id === formData.area_entrada_id);
    if (areaSelecionada && formData.setor_id !== areaSelecionada.setor_id) {
      setFormData((prev) => ({ ...prev, setor_id: areaSelecionada.setor_id || "" }));
    }
  }, [areas, formData.area_entrada_id, formData.setor_id]);

  const areasDoSetor = React.useMemo(() => {
    const lista = formData.setor_id ? getAreasBySetor(formData.setor_id) : [];
    return [...lista].sort((a, b) => String(a?.nome || "").localeCompare(String(b?.nome || ""), "pt-BR", { sensitivity: "base" }));
  }, [formData.setor_id, getAreasBySetor]);

  const opcoesSexo = useMemo(() => [
  { id: "Macho", nome: "MACHO" },
  { id: "Fêmea", nome: "FÊMEA" },
  { id: "Misto", nome: "MISTO" }],
  []);

  const opcoesMotivoEntrada = useMemo(() => {
    const options = motivoEntradaConfig?.options?.length ? motivoEntradaConfig.options : MOTIVOS_ENTRADA.map((item) => ({ value: item, label: item.toUpperCase() }));
    return options.map((item) => ({ id: String(item.value || item.label || item).toUpperCase(), nome: String(item.label || item.value || item).toUpperCase() })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));
  }, [motivoEntradaConfig]);

  const opcoesCores = useMemo(() => CORES_DISPONIVEIS.map((item) => ({ id: item.cor, nome: item.nome.toUpperCase(), cor: item.cor })), []);

  const isReadOnly = isEditing && !isDuplicating && !editMode;
  const readOnlyClass = isReadOnly ? "cursor-default" : "";

  const getFieldClassName = (field, baseClass) => {
    return `${baseClass} ${readOnlyClass} ${errors[field] ? "border-red-500 bg-red-50 focus-visible:ring-red-500" : ""}`.trim();
  };

  const isEmptyValue = (value) => {
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === "string") return value.trim() === "";
    return value === undefined || value === null || value === "";
  };

  const isMotivoEntrada = (motivo) => String(formData.motivo_entrada || "").trim().toUpperCase() === motivo;

  const handleChange = (field, value) => {
    if (isReadOnly) return;
    setIsDirty(true);
    const normalizedValue = UPPERCASE_FIELDS.includes(field) && typeof value === "string" ? value.toUpperCase() : value;
    const newData = { ...formData, [field]: normalizedValue };

    if (field === "categoria_manejo_id") {
      const categoria = categoriasManejo.find((item) => item.id === value);
      if (categoria) {
        newData.categoria = categoria.categoria_oficial || "";
        if (categoria.sexo) newData.sexo = categoria.sexo;
        if (categoria.raca) newData.raca_predominante = String(categoria.raca).toUpperCase();
      }
    }

    if (field === "fornecedor_id") {
      const fornecedor = fornecedores.find((item) => item.id === value);
      if (fornecedor) {
        newData.fornecedor_nome = fornecedor.nome || "";
        if (fornecedor.cidade) newData.cidade_origem = String(fornecedor.cidade).toUpperCase();
        if (fornecedor.estado) newData.estado_origem = String(fornecedor.estado).toUpperCase();
      }
    }

    if (field === "quantidade_cabecas" || field === "valor_total_compra") {
      const quantidade = parseFloat(field === "quantidade_cabecas" ? value : newData.quantidade_cabecas) || 0;
      const valorTotal = parseFloat(field === "valor_total_compra" ? value : newData.valor_total_compra) || 0;
      if (quantidade > 0 && valorTotal > 0) {
        newData.valor_por_cabeca = (valorTotal / quantidade).toFixed(2);
      }
    }

    setErrors((prev) => ({ ...prev, [field]: false }));
    setFormData(newData);
  };

  const validateForm = () => {
    const nextErrors = {};

    REQUIRED_FIELDS.forEach((field) => {
      if (isEmptyValue(formData?.[field])) {
        nextErrors[field] = true;
      }
    });

    const customValidation = campoEngine.buildValidationSchema(camposPersonalizadosForm).safeParse(formData.campos_personalizados || {});
    if (!customValidation.success) {
      customValidation.error.issues.forEach((issue) => {
        const fieldName = issue.path[0];
        if (fieldName) nextErrors[`campos_personalizados.${fieldName}`] = true;
      });
    }

    if (isMotivoEntrada("COMPRA")) {
      [
      "fornecedor_id",
      "cidade_origem",
      "estado_origem",
      "nota_fiscal",
      "chave_nfe",
      "numero_gta",
      "valor_total_compra",
      "valor_por_cabeca",
      "valor_frete"].
      forEach((field) => {
        if (isEmptyValue(formData?.[field])) {
          nextErrors[field] = true;
        }
      });
    }

    if (isMotivoEntrada("AJUSTE") && isEmptyValue(formData?.motivo_ajuste)) {
      nextErrors.motivo_ajuste = true;
    }

    if (isMotivoEntrada("OUTROS") && isEmptyValue(formData?.motivo_outros)) {
      nextErrors.motivo_outros = true;
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length === 0) return true;

    setNoticeDialog({ open: true, title: "Campos obrigatórios", description: "Preencha os campos obrigatórios antes de salvar o lote." });
    const firstField = Object.keys(nextErrors)[0];
    const element = document.querySelector(`[data-field="${firstField}"]`);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    element?.focus?.();
    return false;
  };
  const toggleSistemaProdutivo = (sistema) => {
    if (isReadOnly) return;
    const atuais = parseSistemasProdutivos(formData.sistema_produtivo);
    const proximos = atuais.includes(sistema) ?
    atuais.filter((item) => item !== sistema) :
    [...atuais, sistema];
    handleChange("sistema_produtivo", proximos);
  };

  const handleCustomChange = (fieldName, value) => {
    if (isReadOnly) return;
    setIsDirty(true);
    setErrors((prev) => ({ ...prev, [`campos_personalizados.${fieldName}`]: false }));
    setFormData((prev) => {
      const next = {
        ...prev,
        campos_personalizados: {
          ...(prev.campos_personalizados || {}),
          [fieldName]: value
        }
      };
      return campoEngine.aplicarCamposCalculados(next, camposPersonalizadosForm);
    });
  };

  const splitDateTimeValue = (value) => {
    if (!value) return { date: "", time: "" };
    const [datePart, timePart = ""] = String(value).replace(" ", "T").split("T");
    return { date: datePart || "", time: timePart.slice(0, 5) || "" };
  };

  const handleCustomDateTimeChange = (fieldName, part, nextValue) => {
    const current = splitDateTimeValue(formData.campos_personalizados?.[fieldName]);
    const horaAtual = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const next = {
      ...current,
      [part]: nextValue,
      ...(part === "date" && nextValue && !current.time ? { time: horaAtual } : {})
    };
    handleCustomChange(fieldName, next.date ? `${next.date}T${next.time || "00:00"}` : "");
  };

  const onlyDigits = (value) => String(value || "").replace(/\D/g, "");

  const applyNumberMask = (digits, mask) => {
    let index = 0;
    return String(mask || "").replace(/#/g, () => digits[index++] || "").replace(/[^0-9]+$/g, "");
  };

  const getBestMask = (digits, masks) => {
    return masks.find((mask) => (mask.match(/#/g) || []).length >= digits.length) || masks[masks.length - 1] || "";
  };

  const formatMaskedNumber = (value, campo) => {
    const masks = String(campo.mascaras_text || "").split("\n").map((item) => item.trim()).filter(Boolean).sort((a, b) => (a.match(/#/g) || []).length - (b.match(/#/g) || []).length);
    const maxDigits = Math.max(...masks.map((mask) => (mask.match(/#/g) || []).length), 0);
    const digits = onlyDigits(value).slice(0, maxDigits || undefined);
    return applyNumberMask(digits, getBestMask(digits, masks));
  };

  const renderCampoPersonalizado = (campo) => {
    const fieldKey = `campos_personalizados.${campo.field_name}`;
    const value = formData.campos_personalizados?.[campo.field_name] || "";
    const inputClass = "h-[22px] text-xs border-0 rounded-none shadow-none focus-visible:ring-0 bg-transparent px-1";
    const campoOptions = campoEngine.getOptionsCampo(campo, relatedOptions);

    if (campo.tipo === "textarea") {
      return <Textarea value={value} onChange={(e) => handleCustomChange(campo.field_name, e.target.value)} placeholder={(campo.placeholder || campo.label || "").toUpperCase()} readOnly={campo.read_only || isReadOnly} className={`text-xs uppercase bg-transparent px-1 ${readOnlyClass}`} rows={campo.rows || 2} />;
    }

    if (campo.tipo === "calculado") {
      const calculatedValue = campoEngine.calcularCampo(formData, campo);
      const places = Math.min(6, Math.max(0, Number(campo.decimal_places ?? 2)));
      return <Input value={Number(calculatedValue || 0).toLocaleString("pt-BR", campo.usar_decimal ? { minimumFractionDigits: places, maximumFractionDigits: places } : { maximumFractionDigits: 2 })} readOnly placeholder="CALCULADO" className={`${inputClass} bg-slate-50`} />;
    }

    if (campo.tipo === "option_list") {
      const opcoesCampoPersonalizado = campoOptions.map((option) => ({
        value: String(option.value || option.label || "").toUpperCase(),
        label: String(option.label || option.value || "").toUpperCase()
      }));

      return <CustomOptionListControl options={opcoesCampoPersonalizado} value={value} onChange={(nextValue) => handleCustomChange(campo.field_name, nextValue)} disabled={campo.read_only || isReadOnly} placeholder={(campo.placeholder || "SELECIONE UMA OU MAIS OPÇÕES").toUpperCase()} />;
    }

    if (campo.tipo === "select" || campo.tipo === "relation") {
      const opcoesCampoPersonalizado = campoOptions.map((option) => {
        const optionValue = String(option.value || option.label || "");
        return {
          id: optionValue,
          nome: String(option.label || option.value || "").toUpperCase()
        };
      }).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));

      return (
        <AutocompleteGenerico
          items={opcoesCampoPersonalizado}
          value={value}
          onChange={(nextValue) => handleCustomChange(campo.field_name, nextValue || "")}
          placeholder={(campo.placeholder || "BUSCAR OPÇÃO...").toUpperCase()}
          displayField="nome"
          searchFields={["nome"]}
          disabled={campo.read_only || isReadOnly}
          readOnly={campo.read_only || isReadOnly}
          className="w-full"
          inputClassName="border-0 shadow-none focus-visible:ring-0 bg-transparent h-[22px] text-xs px-1" />);


    }

    if (campo.tipo === "time") {
      return <Input type="time" value={value} onChange={(e) => handleCustomChange(campo.field_name, e.target.value)} readOnly={campo.read_only || isReadOnly} className={`${inputClass} ${readOnlyClass}`} />;
    }

    if (["datetime", "datetime-local", "data_hora", "datahora"].includes(campo.tipo)) {
      const dateTimeValue = splitDateTimeValue(value);
      return (
        <div className="grid grid-cols-2 gap-1">
          <Input type="date" value={dateTimeValue.date} onChange={(e) => handleCustomDateTimeChange(campo.field_name, "date", e.target.value)} readOnly={campo.read_only || isReadOnly} className={`${inputClass} ${readOnlyClass}`} />
          <Input type="time" value={dateTimeValue.time} onChange={(e) => handleCustomDateTimeChange(campo.field_name, "time", e.target.value)} readOnly={campo.read_only || isReadOnly} className={`${inputClass} ${readOnlyClass}`} />
        </div>);
    }

    if (campo.tipo === "number" && campo.usar_mascara) {
      return <Input type="text" inputMode="numeric" value={formatMaskedNumber(value, campo)} onChange={(e) => handleCustomChange(campo.field_name, formatMaskedNumber(e.target.value, campo))} placeholder={(campo.placeholder || campo.label || "").toUpperCase()} readOnly={campo.read_only || isReadOnly} className={`${inputClass} ${readOnlyClass}`} />;
    }

    return <Input type={campo.tipo === "number" ? "number" : campo.tipo === "date" ? "date" : "text"} value={value} onChange={(e) => handleCustomChange(campo.field_name, e.target.value)} placeholder={(campo.placeholder || campo.label || "").toUpperCase()} readOnly={campo.read_only || isReadOnly} className={`${inputClass} ${campo.uppercase ? "uppercase" : ""} ${readOnlyClass}`} />;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!validateForm()) return;

    const area = areas.find((item) => item.id === formData.area_entrada_id);
    const categoriaManejo = categoriasManejo.find((item) => item.id === formData.categoria_manejo_id);
    const quantidade = parseInt(formData.quantidade_cabecas) || 0;
    const peso = parseFloat(formData.peso_medio_kg) || 0;

    const dataToSave = {
      ...formData,
      campos_personalizados: campoEngine.aplicarCamposCalculados(formData, camposPersonalizadosForm).campos_personalizados || {},
      sistema_produtivo: parseSistemasProdutivos(formData.sistema_produtivo).join(", "),
      data_entrada: formData.data_entrada ? `${formData.data_entrada}T12:00:00` : null,
      nome: formData.nome.toUpperCase(),
      setor_nome: area?.setor_nome || "",
      area_entrada_nome: area?.nome || "",
      area_atual_id: formData.area_entrada_id,
      area_atual_nome: area?.nome || "",
      categoria_manejo_nome: categoriaManejo?.nome || "",
      motivo_entrada: MOTIVO_ENTRADA_MAP[formData.motivo_entrada] || formData.motivo_entrada || "",
      origem: formData.motivo_entrada?.toUpperCase() || "",
      observacoes: formData.observacoes?.toUpperCase() || "",
      quantidade_cabecas: quantidade,
      quantidade_entrada: quantidade,
      identificador_nome: formData.identificador_nome?.toUpperCase() || "",
      identificador_sigla: formData.identificador_sigla?.toUpperCase() || "",
      identificador_cor: formData.identificador_cor || "",
      peso_medio_kg: peso,
      peso_entrada_kg: peso,
      idade_media_meses: parseInt(formData.idade_media_meses) || 0,
      valor_total_compra: parseFloat(formData.valor_total_compra) || 0,
      valor_por_cabeca: parseFloat(formData.valor_por_cabeca) || 0,
      valor_frete: parseFloat(formData.valor_frete) || 0,
      categoria_entrada: formData.categoria || "",
      categoria_manejo_entrada_id: formData.categoria_manejo_id || "",
      categoria_manejo_entrada_nome: categoriaManejo?.nome || ""
    };

    if (!shouldPersistEntrySnapshot) {
      dataToSave.quantidade_entrada = initialData?.quantidade_entrada ?? dataToSave.quantidade_entrada;
      dataToSave.peso_entrada_kg = initialData?.peso_entrada_kg ?? dataToSave.peso_entrada_kg;
      dataToSave.categoria_entrada = initialData?.categoria_entrada ?? dataToSave.categoria_entrada;
      dataToSave.categoria_manejo_entrada_id = initialData?.categoria_manejo_entrada_id ?? dataToSave.categoria_manejo_entrada_id;
      dataToSave.categoria_manejo_entrada_nome = initialData?.categoria_manejo_entrada_nome ?? dataToSave.categoria_manejo_entrada_nome;
    }


    onSubmit(dataToSave);
  };

  const basePanels = [
  { id: "principal", label: "Principal" },
  { id: "geral", label: "Geral" },
  { id: "compra", label: "Motivo" },
  { id: "identificacao", label: "Identificação" },
  { id: "observacoes", label: "Observações" },
  ...(camposPersonalizadosForm.length > 0 ? [{ id: "campos_personalizados", label: "Campos Personalizados" }] : [])];


  const dynamicFields = useMemo(() => [
  { id: "nome", name: "nome", label: "Descrição", type: "text", required: true, errorKey: "nome", wide: true, render: () => <Input value={formData.nome || ""} onChange={(e) => handleChange("nome", e.target.value)} placeholder="NOME DO LOTE" className="h-[22px] text-xs uppercase border-0 rounded-none shadow-none focus-visible:ring-0 bg-transparent px-1" style={{ textTransform: "uppercase" }} /> },
  { id: "status", name: "status", label: "Ativo", type: "switch", compact: true, render: () => <div className="h-[22px] flex items-center px-1"><ToggleSwitch checked={formData.status !== "Inativo"} onChange={(checked) => handleChange("status", checked ? "Ativo" : "Inativo")} disabled={isReadOnly} /></div> },
  { id: "numero_lote", name: "numero_lote", label: "Código", type: "text", compact: true, readOnly: true, render: () => <Input value={formData.numero_lote || ""} readOnly className="h-[22px] text-xs text-left border-0 rounded-none shadow-none focus-visible:ring-0 bg-slate-50 px-1" /> },
  { id: "data_entrada", name: "data_entrada", label: "Data de Entrada", type: "date", required: true, compact: true, errorKey: "data_entrada" },
  { id: "setor_id", name: "setor_id", label: "Setor", type: "autocomplete", required: true, errorKey: "setor_id", options: setores, placeholder: "BUSCAR SETOR...", displayField: "nome", searchFields: ["nome", "numero_setor"], render: ({ value }) => <AutocompleteGenerico items={setores} value={value} onChange={(nextValue) => {if (isReadOnly) return;setIsDirty(true);setFormData((prev) => ({ ...prev, setor_id: nextValue || "", area_entrada_id: "" }));setErrors((prev) => ({ ...prev, setor_id: false, area_entrada_id: false }));}} placeholder="BUSCAR SETOR..." displayField="nome" searchFields={["nome", "numero_setor"]} className="w-full" inputClassName="border-0 shadow-none focus-visible:ring-0 bg-transparent h-[22px] text-xs px-1" /> },
  { id: "area_entrada_id", name: "area_entrada_id", label: "Área de Entrada", type: "autocomplete", required: true, errorKey: "area_entrada_id", options: areasDoSetor, placeholder: formData.setor_id ? "BUSCAR ÁREA..." : "SELECIONE O SETOR PRIMEIRO", displayField: "nome", searchFields: ["nome", "numero_area"] },
  { id: "quantidade_cabecas", name: "quantidade_cabecas", label: "Qtd. Cabeças", type: "number", required: true, compact: true, errorKey: "quantidade_cabecas", totalizable: true },
  { id: "categoria_manejo_id", name: "categoria_manejo_id", label: "Categoria de Manejo", type: "autocomplete", required: true, errorKey: "categoria_manejo_id", options: categoriasManejo, placeholder: "BUSCAR CATEGORIA...", displayField: "nome", searchFields: ["nome", "categoria_oficial", "sexo", "raca"], render: ({ value }) => <AutocompleteGenerico items={categoriasManejo} value={value} onChange={(nextValue) => handleChange("categoria_manejo_id", nextValue)} placeholder="BUSCAR CATEGORIA..." displayField="nome" searchFields={["nome", "categoria_oficial", "sexo", "raca"]} className="w-full" inputClassName="border-0 shadow-none focus-visible:ring-0 bg-transparent h-[22px] text-xs px-1" renderItem={(item) => <div className="text-xs font-medium text-slate-900">{(item.nome || "").toUpperCase()} {item.categoria_oficial ? `(${item.categoria_oficial})` : ""}</div>} /> },
  { id: "sexo", name: "sexo", label: "Sexo", type: "autocomplete", required: true, errorKey: "sexo", options: opcoesSexo, placeholder: "BUSCAR SEXO...", displayField: "nome", searchFields: ["nome"] },
  { id: "raca_predominante", name: "raca_predominante", label: "Raça Predominante", type: "text", required: true, errorKey: "raca_predominante", uppercase: true, placeholder: "RAÇA" },
  { id: "peso_medio_kg", name: "peso_medio_kg", label: "Peso Médio (kg)", type: "number", required: true, compact: true, errorKey: "peso_medio_kg", totalizable: true },
  { id: "idade_media_meses", name: "idade_media_meses", label: "Idade Média (meses)", type: "number", required: true, compact: true, errorKey: "idade_media_meses", totalizable: true },
  { id: "sistema_produtivo", name: "sistema_produtivo", label: "Sistema Produtivo", type: "checkbox", required: true, wide: true, errorKey: "sistema_produtivo", render: () => <div className="px-1 py-1 space-y-1 bg-transparent"><div className="text-[11px] leading-none text-slate-500">{parseSistemasProdutivos(formData.sistema_produtivo).length > 0 ? parseSistemasProdutivos(formData.sistema_produtivo).join(", ") : "SELECIONE UM OU MAIS TIPOS"}</div><div className="border border-slate-300 bg-white rounded-[1.5px] p-1 space-y-1">{SISTEMAS.map((item) => {const checked = parseSistemasProdutivos(formData.sistema_produtivo).includes(item);return <label key={item} className="flex h-[22px] w-full items-center gap-1 text-xs text-slate-700 uppercase text-left bg-white hover:bg-slate-50 px-1 cursor-pointer"><input type="checkbox" checked={checked} onChange={() => toggleSistemaProdutivo(item)} disabled={isReadOnly} className="h-3 w-3 rounded-none border-slate-400 accent-green-500 focus:ring-0" /><span>{item}</span></label>;})}</div></div> },
  { id: "motivo_entrada", name: "motivo_entrada", label: "Motivo da Entrada", type: "select", optionsMode: "native", options: opcoesMotivoEntrada, placeholder: "BUSCAR MOTIVO...", displayField: "nome", searchFields: ["nome"] },
  { id: "fornecedor_id", name: "fornecedor_id", label: "Fornecedor", type: "autocomplete", required: isMotivoEntrada("COMPRA"), errorKey: "fornecedor_id", options: fornecedores, placeholder: "BUSCAR FORNECEDOR...", displayField: "nome", searchFields: ["nome", "cpf", "cnpj", "cidade", "estado"], defaultVisibilityRule: { sourceFieldId: "motivo_entrada", sourceFieldName: "motivo_entrada", value: "COMPRA" }, showWhen: (values) => String(values.motivo_entrada || "").trim().toUpperCase() === "COMPRA" },
  { id: "cidade_origem", name: "cidade_origem", label: "Cidade Origem", type: "text", required: isMotivoEntrada("COMPRA"), errorKey: "cidade_origem", uppercase: true, defaultVisibilityRule: { sourceFieldId: "motivo_entrada", sourceFieldName: "motivo_entrada", value: "COMPRA" }, showWhen: (values) => String(values.motivo_entrada || "").trim().toUpperCase() === "COMPRA" },
  { id: "estado_origem", name: "estado_origem", label: "Estado Origem", type: "text", required: isMotivoEntrada("COMPRA"), errorKey: "estado_origem", uppercase: true, defaultVisibilityRule: { sourceFieldId: "motivo_entrada", sourceFieldName: "motivo_entrada", value: "COMPRA" }, showWhen: (values) => String(values.motivo_entrada || "").trim().toUpperCase() === "COMPRA" },
  { id: "nota_fiscal", name: "nota_fiscal", label: "Nota Fiscal", type: "text", required: isMotivoEntrada("COMPRA"), compact: true, errorKey: "nota_fiscal", uppercase: true, defaultVisibilityRule: { sourceFieldId: "motivo_entrada", sourceFieldName: "motivo_entrada", value: "COMPRA" }, showWhen: (values) => String(values.motivo_entrada || "").trim().toUpperCase() === "COMPRA" },
  { id: "chave_nfe", name: "chave_nfe", label: "Chave NF-e", type: "text", required: isMotivoEntrada("COMPRA"), errorKey: "chave_nfe", uppercase: true, defaultVisibilityRule: { sourceFieldId: "motivo_entrada", sourceFieldName: "motivo_entrada", value: "COMPRA" }, showWhen: (values) => String(values.motivo_entrada || "").trim().toUpperCase() === "COMPRA" },
  { id: "numero_gta", name: "numero_gta", label: "Nº GTA", type: "text", required: isMotivoEntrada("COMPRA"), compact: true, errorKey: "numero_gta", uppercase: true, defaultVisibilityRule: { sourceFieldId: "motivo_entrada", sourceFieldName: "motivo_entrada", value: "COMPRA" }, showWhen: (values) => String(values.motivo_entrada || "").trim().toUpperCase() === "COMPRA" },
  { id: "valor_total_compra", name: "valor_total_compra", label: "Valor Total (R$)", type: "number", required: isMotivoEntrada("COMPRA"), compact: true, errorKey: "valor_total_compra", totalizable: true, defaultVisibilityRule: { sourceFieldId: "motivo_entrada", sourceFieldName: "motivo_entrada", value: "COMPRA" }, showWhen: (values) => String(values.motivo_entrada || "").trim().toUpperCase() === "COMPRA" },
  { id: "valor_por_cabeca", name: "valor_por_cabeca", label: "Valor p/ Cabeça (R$)", type: "number", required: isMotivoEntrada("COMPRA"), compact: true, errorKey: "valor_por_cabeca", readOnly: true, totalizable: true, defaultVisibilityRule: { sourceFieldId: "motivo_entrada", sourceFieldName: "motivo_entrada", value: "COMPRA" }, showWhen: (values) => String(values.motivo_entrada || "").trim().toUpperCase() === "COMPRA" },
  { id: "valor_frete", name: "valor_frete", label: "Valor Frete", type: "number", required: isMotivoEntrada("COMPRA"), compact: true, errorKey: "valor_frete", totalizable: true, defaultVisibilityRule: { sourceFieldId: "motivo_entrada", sourceFieldName: "motivo_entrada", value: "COMPRA" }, showWhen: (values) => String(values.motivo_entrada || "").trim().toUpperCase() === "COMPRA" },
  { id: "motivo_ajuste", name: "motivo_ajuste", label: "Motivo do Ajuste", type: "textarea", required: isMotivoEntrada("AJUSTE"), wide: true, errorKey: "motivo_ajuste", defaultVisibilityRule: { sourceFieldId: "motivo_entrada", sourceFieldName: "motivo_entrada", value: "AJUSTE" }, showWhen: (values) => String(values.motivo_entrada || "").trim().toUpperCase() === "AJUSTE" },
  { id: "motivo_outros", name: "motivo_outros", label: "Motivo", type: "textarea", required: isMotivoEntrada("OUTROS"), wide: true, errorKey: "motivo_outros", defaultVisibilityRule: { sourceFieldId: "motivo_entrada", sourceFieldName: "motivo_entrada", value: "OUTROS" }, showWhen: (values) => String(values.motivo_entrada || "").trim().toUpperCase() === "OUTROS" },
  { id: "identificador_nome", name: "identificador_nome", label: "Identificador (Nome)", type: "text", uppercase: true, placeholder: "EX: CONFINAMENTO" },
  { id: "identificador_sigla", name: "identificador_sigla", label: "Identificador (Sigla)", type: "text", uppercase: true, placeholder: "EX: CF" },
  { id: "identificador_cor", name: "identificador_cor", label: "Identificador (Cor)", type: "autocomplete", options: opcoesCores, placeholder: "BUSCAR COR...", displayField: "nome", searchFields: ["nome"], render: ({ value }) => <AutocompleteGenerico items={opcoesCores} value={value} onChange={(nextValue) => handleChange("identificador_cor", nextValue)} placeholder="BUSCAR COR..." displayField="nome" searchFields={["nome"]} className="w-full" inputClassName="border-0 shadow-none focus-visible:ring-0 bg-transparent h-[22px] text-xs px-1" renderItem={(item) => <div className="flex items-center gap-2 text-xs font-medium text-slate-900"><span className="w-3 h-3 rounded-full border border-slate-300" style={{ backgroundColor: item.cor }} />{item.nome}</div>} /> },
  { id: "observacoes", name: "observacoes", label: "Observações", type: "textarea", wide: true, uppercase: true, placeholder: "OBSERVAÇÕES GERAIS..." },
  ...camposPersonalizadosForm.map((campo) => ({ id: `custom:${campo.field_name}`, name: campo.field_name, label: campo.label, type: campo.tipo, optionsMode: ["select", "option_list"].includes(campo.tipo) && !(campo.options_source_entity || campo.relation_entity) ? "manual" : "", required: campo.obrigatorio, errorKey: `campos_personalizados.${campo.field_name}`, wide: ["textarea", "option_list"].includes(campo.tipo), medium: ["datetime", "datetime-local", "data_hora", "datahora"].includes(campo.tipo), compact: ["number", "date", "time", "calculado"].includes(campo.tipo) && !campo.usar_mascara, totalizable: ["number", "calculado"].includes(campo.tipo) && !campo.usar_mascara, options: ["select", "option_list"].includes(campo.tipo) ? campoEngine.getOptionsCampo(campo, relatedOptions).map((option) => ({ id: String(option.value || option.label || ""), nome: String(option.label || option.value || "").toUpperCase() })) : [], displayField: "nome", searchFields: ["nome"], render: () => renderCampoPersonalizado(campo) }))],
  [setores, areasDoSetor, categoriasManejo, opcoesSexo, fornecedores, opcoesMotivoEntrada, opcoesCores, formData, camposPersonalizadosForm, errors, isReadOnly, relatedOptions]);

  const defaultLayout = {
    principal: ["nome", "status", "numero_lote"],
    geral: ["data_entrada", "setor_id", "area_entrada_id", "quantidade_cabecas", "categoria_manejo_id", "sexo", "raca_predominante", "peso_medio_kg", "idade_media_meses", "sistema_produtivo"],
    compra: ["motivo_entrada", "fornecedor_id", "cidade_origem", "estado_origem", "nota_fiscal", "chave_nfe", "numero_gta", "valor_total_compra", "valor_por_cabeca", "valor_frete", "motivo_ajuste", "motivo_outros"],
    identificacao: ["identificador_nome", "identificador_sigla", "identificador_cor"],
    observacoes: ["observacoes"],
    campos_personalizados: camposPersonalizadosForm.map((campo) => `custom:${campo.field_name}`)
  };

  const activeLayoutConfig = (() => {
    const source = formLayoutConfig || { panels: basePanels, layout: defaultLayout, hiddenFieldIds: [], lockedFieldIds: [], requiredFieldIds: [], aggregationConfig: {}, visibilityRules: {} };
    const panels = source.panels?.some((panel) => panel.id === "principal") ? source.panels : [basePanels[0], ...(source.panels || basePanels)];
    const principalFields = source.layout?.principal?.length ? source.layout.principal : defaultLayout.principal;
    return {
      ...source,
      panels,
      layout: { ...source.layout, principal: principalFields },
      hiddenFieldIds: (source.hiddenFieldIds || []).filter((id) => !["status", "numero_lote"].includes(id))
    };
  })();
  const tabs = activeLayoutConfig.panels.filter((panel) => {
    if (panel.id === "principal") return false;
    if (panel.hidden) return false;
    if (panel.id === "campos_personalizados" && camposPersonalizadosForm.length === 0) return false;
    return (activeLayoutConfig.layout?.[panel.id] || []).length > 0;
  });

  const saveLayoutConfig = (nextConfig) => {
    const normalized = {
      ...nextConfig,
      visibilityRules: nextConfig.visibilityRules || {},
      panels: nextConfig.panels.filter((panel) => panel.id !== "campos_personalizados" || camposPersonalizadosForm.length > 0),
      layout: { ...nextConfig.layout, principal: nextConfig.layout?.principal?.length ? nextConfig.layout.principal : defaultLayout.principal },
      hiddenFieldIds: (nextConfig.hiddenFieldIds || []).filter((id) => !["status", "numero_lote"].includes(id))
    };
    setFormLayoutConfig(normalized);
    localStorage.setItem("cadastro_lotes_form_layout_config", JSON.stringify(normalized));
    localStorage.setItem("cadastro_lotes_table_aggregation_config", JSON.stringify(normalized.aggregationConfig || {}));
    window.dispatchEvent(new Event("cadastro-lotes-layout-updated"));
    const visiblePanels = normalized.panels.filter((panel) => !panel.hidden && panel.id !== "principal");
    if (!visiblePanels.some((panel) => panel.id === activeTab)) setActiveTab(visiblePanels[0]?.id || "geral");
  };

  const operationLabel = isDuplicating ? "NOVO REGISTRO DUPLICADO" : isEditing ? editMode ? "EDIÇÃO DE REGISTRO" : "VISUALIZAÇÃO DE REGISTRO" : "NOVO REGISTRO";

  if (layoutConfigOpen) {
    return (
      <section className="w-full h-full max-w-full bg-white overflow-hidden">
        <LayoutConfiguratorDialog
          open={layoutConfigOpen}
          onOpenChange={setLayoutConfigOpen}
          inline
          panels={activeLayoutConfig.panels}
          fields={dynamicFields}
          layout={activeLayoutConfig.layout}
          hiddenFieldIds={activeLayoutConfig.hiddenFieldIds || []}
          lockedFieldIds={activeLayoutConfig.lockedFieldIds || []}
          requiredFieldIds={activeLayoutConfig.requiredFieldIds || []}
          aggregationConfig={activeLayoutConfig.aggregationConfig || {}}
          visibilityRules={activeLayoutConfig.visibilityRules || {}}
          defaultConfig={{ panels: basePanels, layout: defaultLayout, hiddenFieldIds: [], lockedFieldIds: [], requiredFieldIds: [], aggregationConfig: {}, visibilityRules: {} }}
          onSave={saveLayoutConfig} />
        
      </section>);

  }

  return (
    <div className="h-full min-h-0 overflow-hidden bg-white">
      <TopNoticeDialog
        open={noticeDialog.open}
        onOpenChange={(open) => setNoticeDialog((prev) => ({ ...prev, open }))}
        badge="AVISO"
        title={noticeDialog.title}
        description={noticeDialog.description}
        type="warning"
        confirmText="Entendi"
      />
      <form onSubmit={handleSubmit} className="bg-white h-full min-h-0 overflow-hidden flex flex-col">
        <LegacyRecordToolbar
          title={`${formData.numero_lote ? `${formData.numero_lote} - ` : ""}${formData.nome || (isDuplicating ? "Duplicar lote" : isEditing ? "Editar lote" : "Novo lote")}`}
          badgeLabel="LOTE"
          operationLabel={operationLabel}
          showSaveActions={editMode}
          showEditAction={isReadOnly}
          showDeleteDuplicateActions={isEditing && !editMode && !isDuplicating}
          onCancel={onCancel}
          onSave={() => handleSubmit({ preventDefault: () => {} })}
          onEditRecord={() => setEditMode(true)}
          onSettingsClick={onSettingsClick}
          onLayoutConfigClick={() => { if (filterOpen) onToggleFilter?.(); setLayoutConfigOpen(true); }}
          onToggleView={onToggleView}
          total={total}
          currentIndex={currentIndex}
          onNew={onNew}
          onFirst={onFirst}
          onPrevious={onPrevious}
          onNext={onNext}
          onLast={onLast}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          onRefresh={onRefresh}
          filterOpen={filterOpen}
          filterActive={filterActive}
          onToggleFilter={onToggleFilter}
          onClearFilter={onClearFilter}
          onAttachClick={onAttachClick}
          attachDisabled={attachDisabled} />
        

        <div className="flex-1 min-h-0 overflow-y-auto pb-6 pr-2" style={{ scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}>
          <fieldset className={isReadOnly ? "pointer-events-none [&_input]:cursor-default [&_textarea]:cursor-default [&_button]:cursor-default" : ""}>
            <div className="px-4 md:px-8 py-1 max-w-[780px]">
              <DynamicFormRenderer
                panels={activeLayoutConfig.panels}
                fields={dynamicFields}
                layout={activeLayoutConfig.layout}
                hiddenFieldIds={activeLayoutConfig.hiddenFieldIds || []}
                lockedFieldIds={activeLayoutConfig.lockedFieldIds || []}
                requiredFieldIds={activeLayoutConfig.requiredFieldIds || []}
                visibilityRules={activeLayoutConfig.visibilityRules || {}}
                activePanelId="principal"
                values={formData}
                errors={errors}
                onChange={handleChange}
                readOnly={isReadOnly}
                fieldClassName="rounded-[1.5px]" />
            </div>
          </fieldset>

          <LegacyTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
          <fieldset className={isReadOnly ? "pointer-events-none [&_input]:cursor-default [&_textarea]:cursor-default [&_button]:cursor-default" : ""}>
          <div className="min-h-[360px] px-4 md:px-8 py-1">
            <div className="max-w-[780px] space-y-1">
              <DynamicFormRenderer
                panels={tabs}
                fields={dynamicFields}
                layout={activeLayoutConfig.layout}
                hiddenFieldIds={activeLayoutConfig.hiddenFieldIds || []}
                lockedFieldIds={activeLayoutConfig.lockedFieldIds || []}
                requiredFieldIds={activeLayoutConfig.requiredFieldIds || []}
                visibilityRules={activeLayoutConfig.visibilityRules || {}}
                activePanelId={activeTab}
                values={formData}
                errors={errors}
                onChange={handleChange}
                readOnly={isReadOnly}
                fieldClassName="rounded-[1.5px]" />
              
            </div>
          </div>
        </fieldset>



        




        
        </div>
      </form>
    </div>);

}