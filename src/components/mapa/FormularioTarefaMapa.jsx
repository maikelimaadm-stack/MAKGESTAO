import React, { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Crosshair, MapPin, ImagePlus, X, WifiOff } from "lucide-react";
import { toast } from "sonner";
import TaskLocationPickerDialog from "./TaskLocationPickerDialog";
import MultiAreaSelect from "@/components/tarefas/MultiAreaSelect";
import useSetorAreas from "@/hooks/useSetorAreas";
import { getPermissionDisplayName, getUserDisplayName, isExcludedSystemUser } from "@/lib/userDisplayName";
import { canAccessPage, normalizePermissionRecord } from "@/lib/permissions";

const FL = ({ label, required, error, children, dataField }) => (
  <div data-field={dataField}>
    <label className="text-[12px] text-slate-500 pl-1 leading-none">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    <div className={`rounded-md border ${error ? 'border-red-500 bg-red-50' : 'border-slate-300'} focus-within:border-emerald-500 transition-colors`}>
      {children}
    </div>
  </div>
);

export const normalizeTaskPriority = (value) => {
  const normalized = (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  if (["alta", "alto", "urgente", "critico", "critica", "crítico", "crítica"].includes(normalized)) return "Alta";
  if (["media", "medio", "média", "médio", "normal"].includes(normalized)) return "Média";
  return "Baixa";
};

const REQUIRED_FIELDS = ["titulo", "grupo_atividade_id", "tipo_tarefa_id", "data_pedido"];

const inferirTipoBase = (tipoNome = "", grupoNome = "") => {
  const texto = `${tipoNome} ${grupoNome}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (texto.includes("suplement")) return "Suplementação";
  if (texto.includes("manutenc")) return "Manutenção";
  if (texto.includes("verific")) return "Verificação";
  if (texto.includes("sanit")) return "Sanitário";
  if (texto.includes("manejo")) return "Manejo";
  return "Outro";
};

const getAreaCenter = (area) => {
  if (!area?.coordenadas?.coords?.length) return null;
  const lats = area.coordenadas.coords.map((coord) => coord[0] || coord.lat);
  const lngs = area.coordenadas.coords.map((coord) => coord[1] || coord.lng);
  return {
    lat: lats.reduce((sum, item) => sum + item, 0) / lats.length,
    lng: lngs.reduce((sum, item) => sum + item, 0) / lngs.length
  };
};

export default function FormularioTarefaMapa({ tarefa, areaId, areaNome, loteId, loteNome, pontoSuplId, initialCoordinates, initialDraft, onSubmit, onCancel, onRequestSelectLocation, externalSubmitting = false }) {
  const empresaSelecionadaId = localStorage.getItem("empresa_selecionada_id");
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [setorSelecionadoId, setSetorSelecionadoId] = useState("");

  const { setores, areas, getAreasBySetor } = useSetorAreas(empresaSelecionadaId);

  const { data: gruposAtividade = [] } = useQuery({
    queryKey: ["grupos-atividade-mapa-form"],
    queryFn: async () => {
      const all = await base44.entities.GrupoAtividade.list();
      return all.filter((grupo) => grupo.ativo !== false);
    },
    initialData: []
  });

  const { data: tiposTarefa = [] } = useQuery({
    queryKey: ["tipos-tarefa-mapa-form"],
    queryFn: async () => {
      const all = await base44.entities.TipoTarefa.list();
      return all.filter((tipo) => tipo.ativo !== false);
    },
    initialData: []
  });

  const { data: usuariosSistema = [] } = useQuery({
    queryKey: ["usuarios-tarefa-mapa-form"],
    queryFn: () => base44.entities.User.list("nome", 200),
    initialData: []
  });

  const { data: usuarioAtual = null } = useQuery({
    queryKey: ["usuario-atual-tarefa-mapa-form"],
    queryFn: () => base44.auth.me(),
    initialData: null
  });

  const { data: permissoesUsuarios = [] } = useQuery({
    queryKey: ["permissoes-usuarios-tarefa-mapa-form"],
    queryFn: () => base44.entities.Permissao.list(),
    initialData: []
  });

  const nomeUsuarioAtual = useMemo(() => getUserDisplayName(usuarioAtual), [usuarioAtual]);

  // Fill solicitante from current user when empty (lazy, after user loads)
  useEffect(() => {
    if (!nomeUsuarioAtual) return;
    setFormData((prev) => {
      if (prev.solicitante) return prev;
      return { ...prev, solicitante: nomeUsuarioAtual, responsavel_geral: prev.responsavel_geral || nomeUsuarioAtual };
    });
  }, [nomeUsuarioAtual]);

  const [pendingImageFiles, setPendingImageFiles] = useState([]); // File[] aguardando upload
  const [previewUrls, setPreviewUrls] = useState([]); // URLs de preview local
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setPendingImageFiles((prev) => [...prev, ...files]);
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviewUrls((prev) => [...prev, ...urls]);
    e.target.value = '';
  };

  const removeNewImage = (index) => {
    URL.revokeObjectURL(previewUrls[index]);
    setPendingImageFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const removeSavedImage = (url) => {
    setFormData((prev) => ({ ...prev, fotos: (prev.fotos || []).filter((f) => f !== url) }));
  };

  const [formData, setFormData] = useState(() => {
    const source = tarefa?.data ? { ...tarefa.data, id: tarefa.id } : initialDraft?.data ? { ...initialDraft.data, id: initialDraft.id } : tarefa || initialDraft || {};
    return {
      id: source.id || "",
      titulo: source.titulo || "",
      descricao: source.descricao || "",
      tipo: source.tipo || inferirTipoBase(source.tipo_tarefa_nome, source.grupo_atividade_nome),
      tipo_tarefa_id: source.tipo_tarefa_id || "",
      tipo_tarefa_nome: source.tipo_tarefa_nome || "",
      grupo_atividade_id: source.grupo_atividade_id || "",
      grupo_atividade_nome: source.grupo_atividade_nome || "",
      solicitante: source.solicitante || source.responsavel_geral || "",
      data_pedido: source.data_pedido || "",
      data_prevista: source.data_prevista || "",
      data_conclusao: source.data_conclusao || "",
      setor_nome: source.setor_nome || "",
      prioridade: normalizeTaskPriority(source.prioridade || "M\u00e9dia"),
      status: source.status || "Pendente",
      responsavel_id: source.responsavel_id || "",
      responsavel: source.responsavel || "",
      responsavel_geral: source.responsavel_geral || source.solicitante || "",
      observacoes: source.observacoes || "",
      area_id: source.area_id || areaId || "",
      area_nome: source.area_nome || areaNome || "",
      area_ids: source.area_ids || (source.area_id ? [source.area_id] : areaId ? [areaId] : []),
      area_nomes: source.area_nomes || (source.area_nome ? [source.area_nome] : areaNome ? [areaNome] : []),
      lote_id: source.lote_id || loteId || "",
      lote_nome: source.lote_nome || loteNome || "",
      ponto_suplementacao_id: source.ponto_suplementacao_id || pontoSuplId || "",
      coordenadas: source.coordenadas || initialCoordinates || null,
      fotos: source.fotos || []
    };
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    // Se já tem area_ids (múltiplas áreas), resolve o setor pelo primeiro ID
    if (formData.area_ids?.length > 0) {
      const primeiraArea = areas.find((item) => item.id === formData.area_ids[0]);
      if (primeiraArea && setorSelecionadoId !== (primeiraArea.setor_id || "")) {
        setSetorSelecionadoId(primeiraArea.setor_id || "");
      }
      return;
    }

    // Compatibilidade: resolve a partir de area_id único
    const areaSelecionada = formData.area_id ? areas.find((item) => item.id === formData.area_id) : null;
    const areaPorNome = !areaSelecionada && formData.area_nome ? areas.find((item) => item.nome === formData.area_nome) : null;
    const areaResolvida = areaSelecionada || areaPorNome;

    if (areaResolvida) {
      if (setorSelecionadoId !== (areaResolvida.setor_id || "")) {
        setSetorSelecionadoId(areaResolvida.setor_id || "");
      }

      if (
        formData.area_id !== (areaResolvida.id || "") ||
        formData.area_nome !== (areaResolvida.nome || "") ||
        formData.setor_nome !== (areaResolvida.setor_nome || "")
      ) {
        setFormData((prev) => ({
          ...prev,
          area_id: areaResolvida.id || prev.area_id,
          area_nome: areaResolvida.nome || prev.area_nome,
          area_ids: prev.area_ids?.length ? prev.area_ids : [areaResolvida.id],
          area_nomes: prev.area_nomes?.length ? prev.area_nomes : [areaResolvida.nome],
          setor_nome: areaResolvida.setor_nome || prev.setor_nome
        }));
      }
      return;
    }

    if (!formData.area_id && formData.setor_nome && setores.length && !setorSelecionadoId) {
      const setor = setores.find((item) => item.nome === formData.setor_nome);
      if (setor?.id) {
        setSetorSelecionadoId(setor.id);
      }
    }
  }, [formData.area_id, formData.area_ids, formData.area_nome, formData.setor_nome, areas, setores, setorSelecionadoId]);

  const areasDoSetor = setorSelecionadoId ? getAreasBySetor(setorSelecionadoId) : [];
  const tiposTarefaFiltrados = formData.grupo_atividade_id ?
  tiposTarefa.filter((tipo) => tipo.grupo_atividade_id === formData.grupo_atividade_id) :
  [];

  useEffect(() => {
    if (!formData.tipo_tarefa_id && formData.tipo_tarefa_nome && tiposTarefa.length) {
      const tipoEncontrado = tiposTarefa.find((tipo) => tipo.nome_tipo === formData.tipo_tarefa_nome);
      if (tipoEncontrado) {
        setFormData((prev) => ({
          ...prev,
          tipo_tarefa_id: tipoEncontrado.id,
          grupo_atividade_id: prev.grupo_atividade_id || tipoEncontrado.grupo_atividade_id || "",
          grupo_atividade_nome: prev.grupo_atividade_nome || tipoEncontrado.grupo_atividade_nome || ""
        }));
      }
    }
  }, [formData.tipo_tarefa_id, formData.tipo_tarefa_nome, tiposTarefa]);

  const usuariosOrdenados = useMemo(() => {
    const permissoesNormalizadas = permissoesUsuarios.
    map((registro) => normalizePermissionRecord(registro?.data || registro)).
    filter(Boolean);

    const permissoesPorEmail = new Map(
      permissoesNormalizadas.map((permissao) => [permissao.user_email, permissao])
    );

    return usuariosSistema.
    filter((user) => {
      if (isExcludedSystemUser(user)) return false;
      const permissao = permissoesPorEmail.get(user.email);
      return canAccessPage(permissao, "gt-lancamentos", "gestao-tarefas");
    }).
    sort((a, b) => {
      const permissaoA = permissoesPorEmail.get(a.email);
      const permissaoB = permissoesPorEmail.get(b.email);
      return getPermissionDisplayName(permissaoA, a).localeCompare(getPermissionDisplayName(permissaoB, b), "pt-BR", { sensitivity: "base" });
    });
  }, [usuariosSistema, permissoesUsuarios]);

  const getFieldClassName = (field, baseClass) => {
    return `${baseClass} ${errors[field] ? "border-red-500 bg-red-50 focus-visible:ring-red-500" : ""}`.trim();
  };

  const validateForm = () => {
    const nextErrors = {};

    REQUIRED_FIELDS.forEach((field) => {
      if (!String(formData?.[field] || "").trim()) {
        nextErrors[field] = true;
      }
    });

    if (formData.status === "Concluída" && !String(formData.data_conclusao || "").trim()) {
      nextErrors.data_conclusao = true;
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length === 0) return true;

    toast.error("PREENCHA OS CAMPOS OBRIGATÓRIOS.");
    const firstField = Object.keys(nextErrors)[0];
    const element = document.querySelector(`[data-field="${firstField}"]`);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    const focusable = element?.querySelector("input, textarea, button, [role='combobox']");
    focusable?.focus?.();
    return false;
  };

  const handleAreasChange = (selectedIds, selectedNomes) => {
    const firstArea = selectedIds.length > 0 ? areas.find((a) => a.id === selectedIds[0]) : null;
    const center = selectedIds.length === 1 ? getAreaCenter(firstArea) : null;
    setFormData((prev) => ({
      ...prev,
      area_ids: selectedIds,
      area_nomes: selectedNomes,
      area_id: selectedIds[0] || "",
      area_nome: selectedNomes.join(", ") || "",
      setor_nome: firstArea?.setor_nome || prev.setor_nome,
      coordenadas: selectedIds.length === 1 ? (center || prev.coordenadas) : prev.coordenadas
    }));
  };

  const handleGrupoAtividadeChange = (selectedGrupoId) => {
    const grupoSelecionado = gruposAtividade.find((grupo) => grupo.id === selectedGrupoId);
    setErrors((prev) => ({ ...prev, grupo_atividade_id: false, tipo_tarefa_id: false }));
    setFormData((prev) => ({
      ...prev,
      grupo_atividade_id: selectedGrupoId,
      grupo_atividade_nome: grupoSelecionado?.nome_grupo || "",
      tipo_tarefa_id: "",
      tipo_tarefa_nome: "",
      tipo: inferirTipoBase("", grupoSelecionado?.nome_grupo || "")
    }));
  };

  const handleTipoTarefaChange = (selectedTipoId) => {
    const selectedTipo = tiposTarefaFiltrados.find((tipo) => tipo.id === selectedTipoId);
    setErrors((prev) => ({ ...prev, tipo_tarefa_id: false }));
    setFormData((prev) => ({
      ...prev,
      tipo_tarefa_id: selectedTipoId,
      tipo_tarefa_nome: selectedTipo?.nome_tipo || "",
      tipo: inferirTipoBase(selectedTipo?.nome_tipo, prev.grupo_atividade_nome || selectedTipo?.grupo_atividade_nome)
    }));
  };

  const handleSolicitanteChange = (selectedSolicitante) => {
    setErrors((prev) => ({ ...prev, solicitante: false }));
    setFormData((prev) => ({ ...prev, solicitante: selectedSolicitante, responsavel_geral: selectedSolicitante }));
  };

  const handleResponsavelChange = (selectedResponsavelId) => {
    const responsavel = usuariosOrdenados.find((item) => item.id === selectedResponsavelId);
    const permissao = permissoesUsuarios.find((item) => (item.user_email || item.data?.user_email) === responsavel?.email);
    setErrors((prev) => ({ ...prev, responsavel_id: false }));
    setFormData((prev) => ({ ...prev, responsavel_id: selectedResponsavelId, responsavel: getPermissionDisplayName(permissao?.data || permissao, responsavel) }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      onSubmit({
        ...formData,
        titulo: formData.titulo.trim(),
        prioridade: normalizeTaskPriority(formData.prioridade),
        solicitante: formData.solicitante || "",
        responsavel_geral: formData.solicitante || "",
        responsavel_id: formData.responsavel_id || "",
        responsavel: formData.responsavel || ""
      }, pendingImageFiles);
    } finally {
      // Resetar após 2s para evitar que o botão fique bloqueado se o parent não fechar o form
      setTimeout(() => setIsSubmitting(false), 2000);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
    <form onSubmit={handleSubmit} className="overflow-x-hidden" style={{ overscrollBehavior: 'none', touchAction: 'pan-y pinch-zoom' }}>
      <Card className="shadow-sm border-slate-300">
        <CardHeader className="flex flex-col space-y-1.5 p-6 bg-slate-50 border-b py-1 px-1">
          <CardTitle className="text-sm font-semibold text-slate-700">
            {tarefa ? "Editar Tarefa" : "Lançar Nova Tarefa"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-1" style={{ maxHeight: 'calc(100vh - 150px)', overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}>
          <div className="space-y-0.5">
            <FL label="Título da tarefa" required error={errors.titulo} dataField="titulo">
              <Input value={formData.titulo} onChange={(e) => { setErrors((prev) => ({ ...prev, titulo: false })); setFormData((prev) => ({ ...prev, titulo: e.target.value })); }} placeholder="EX: CERCA QUEBRADA NA DIVISA" className="h-7 text-xs uppercase border-0 shadow-none focus-visible:ring-0 bg-transparent" style={{ textTransform: "uppercase" }} />
            </FL>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-1">
        <FL label="Fazenda">
          <Select value={setorSelecionadoId || "__sem_setor__"} onValueChange={(value) => { const setor = setores.find((item) => item.id === value); setSetorSelecionadoId(value === "__sem_setor__" ? "" : value); setFormData((prev) => ({ ...prev, setor_nome: value === "__sem_setor__" ? "" : setor?.nome || "", area_id: areaId || loteId ? prev.area_id : "", area_nome: areaId || loteId ? prev.area_nome : "", area_ids: areaId || loteId ? prev.area_ids : [], area_nomes: areaId || loteId ? prev.area_nomes : [] })); }} disabled={Boolean(areaId || loteId)}>
            <SelectTrigger className="h-7 text-xs border-0 shadow-none focus:ring-0 bg-transparent"><SelectValue placeholder="SELECIONE" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__sem_setor__" className="text-xs">SELECIONE</SelectItem>
              {setores.map((setor) => <SelectItem key={setor.id} value={setor.id} className="text-xs">{(setor.nome || "").toUpperCase()}</SelectItem>)}
            </SelectContent>
          </Select>
        </FL>

        {!areaId && !loteId ?
          <FL label="Local / pasto (múltiplas)">
            <div className="flex items-center h-7">
              <MultiAreaSelect
                areas={areasDoSetor}
                selectedIds={formData.area_ids || []}
                onChange={handleAreasChange}
                disabled={!setorSelecionadoId}
                placeholder={setorSelecionadoId ? "SELECIONE" : "SELECIONE A FAZENDA"} />
            </div>
          </FL> :
          <FL label="Local / pasto">
            <Input value={(formData.area_nome || formData.lote_nome || "").toUpperCase()} readOnly className="h-7 text-xs bg-slate-50 uppercase border-0 shadow-none focus-visible:ring-0" />
          </FL>
        }

        <FL label="Grupo de atividade" required error={errors.grupo_atividade_id} dataField="grupo_atividade_id">
          <Select value={formData.grupo_atividade_id} onValueChange={handleGrupoAtividadeChange}>
            <SelectTrigger className="h-7 text-xs border-0 shadow-none focus:ring-0 bg-transparent"><SelectValue placeholder="SELECIONE" /></SelectTrigger>
            <SelectContent>{gruposAtividade.map((grupo) => <SelectItem key={grupo.id} value={grupo.id} className="text-xs">{(grupo.nome_grupo || "").toUpperCase()}</SelectItem>)}</SelectContent>
          </Select>
        </FL>

        <FL label="Tipo de tarefa" required error={errors.tipo_tarefa_id} dataField="tipo_tarefa_id">
          <Select value={formData.tipo_tarefa_id} onValueChange={handleTipoTarefaChange} disabled={!formData.grupo_atividade_id}>
            <SelectTrigger className="h-7 text-xs border-0 shadow-none focus:ring-0 bg-transparent"><SelectValue placeholder={formData.grupo_atividade_id ? "SELECIONE" : "SELECIONE O GRUPO"} /></SelectTrigger>
            <SelectContent>{tiposTarefaFiltrados.map((tipo) => <SelectItem key={tipo.id} value={tipo.id} className="text-xs">{(tipo.nome_tipo || "").toUpperCase()}</SelectItem>)}</SelectContent>
          </Select>
        </FL>

        <FL label="Responsável" dataField="responsavel_id">
          <Select value={formData.responsavel_id} onValueChange={handleResponsavelChange}>
            <SelectTrigger className="h-7 text-xs border-0 shadow-none focus:ring-0 bg-transparent"><SelectValue placeholder="SELECIONE" /></SelectTrigger>
            <SelectContent>{usuariosOrdenados.map((item) => { const permissao = permissoesUsuarios.find((registro) => (registro.user_email || registro.data?.user_email) === item.email); return <SelectItem key={item.id} value={item.id} className="text-xs">{getPermissionDisplayName(permissao?.data || permissao, item).toUpperCase()}</SelectItem>; })}</SelectContent>
          </Select>
        </FL>

        <FL label="Solicitante" dataField="solicitante">
          <Select value={formData.solicitante} onValueChange={handleSolicitanteChange}>
            <SelectTrigger className="h-7 text-xs border-0 shadow-none focus:ring-0 bg-transparent"><SelectValue placeholder="SELECIONE" /></SelectTrigger>
            <SelectContent>{usuariosOrdenados.map((item) => { const permissao = permissoesUsuarios.find((registro) => (registro.user_email || registro.data?.user_email) === item.email); const nome = getPermissionDisplayName(permissao?.data || permissao, item); return <SelectItem key={item.id} value={nome} className="text-xs">{nome.toUpperCase()}</SelectItem>; })}</SelectContent>
          </Select>
        </FL>

        <FL label="Prioridade">
          <Select value={formData.prioridade} onValueChange={(value) => setFormData((prev) => ({ ...prev, prioridade: value }))}>
            <SelectTrigger className="h-7 text-xs border-0 shadow-none focus:ring-0 bg-transparent"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Baixa" className="text-xs">BAIXA</SelectItem>
              <SelectItem value="Média" className="text-xs">MÉDIA</SelectItem>
              <SelectItem value="Alta" className="text-xs">ALTA</SelectItem>
            </SelectContent>
          </Select>
        </FL>

        <FL label="Status">
          <Select value={formData.status} onValueChange={(value) => { setErrors((prev) => ({ ...prev, data_conclusao: false })); setFormData((prev) => ({ ...prev, status: value })); }}>
            <SelectTrigger className="h-7 text-xs border-0 shadow-none focus:ring-0 bg-transparent"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Pendente" className="text-xs">PENDENTE</SelectItem>
              <SelectItem value="Em Andamento" className="text-xs">EM ANDAMENTO</SelectItem>
              <SelectItem value="Concluída" className="text-xs">CONCLUÍDA</SelectItem>
              <SelectItem value="Cancelada" className="text-xs">CANCELADA</SelectItem>
            </SelectContent>
          </Select>
        </FL>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-1 pt-0.5 border-t">
          <FL label="Data do pedido" required error={errors.data_pedido} dataField="data_pedido">
            <Input type="date" value={formData.data_pedido} onChange={(e) => { setErrors((prev) => ({ ...prev, data_pedido: false })); setFormData((prev) => ({ ...prev, data_pedido: e.target.value })); }} className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent" />
          </FL>
          <FL label="Prazo previsto">
            <Input type="date" value={formData.data_prevista} onChange={(e) => setFormData((prev) => ({ ...prev, data_prevista: e.target.value }))} className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent" />
          </FL>
          <FL label={`Data de conclusão${formData.status === "Concluída" ? "" : ""}`} required={formData.status === "Concluída"} error={errors.data_conclusao} dataField="data_conclusao">
            <Input type="date" value={formData.data_conclusao} onChange={(e) => { setErrors((prev) => ({ ...prev, data_conclusao: false })); setFormData((prev) => ({ ...prev, data_conclusao: e.target.value })); }} className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent" />
          </FL>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-1">
          <FL label="Descrição da tarefa">
            <Textarea value={formData.descricao} onChange={(e) => setFormData((prev) => ({ ...prev, descricao: e.target.value }))} placeholder="DESCREVA O QUE PRECISA SER FEITO" className="text-xs uppercase border-0 shadow-none focus-visible:ring-0 bg-transparent" style={{ textTransform: "uppercase" }} rows={2} />
          </FL>
          <FL label="Observações internas">
            <Textarea value={formData.observacoes} onChange={(e) => setFormData((prev) => ({ ...prev, observacoes: e.target.value }))} placeholder="OBSERVAÇÕES GERAIS..." className="text-xs uppercase border-0 shadow-none focus-visible:ring-0 bg-transparent" style={{ textTransform: "uppercase" }} rows={2} />
          </FL>
        </div>

        <div className="space-y-1 lg:col-span-2">
          <label className="text-[12px] text-slate-500 pl-1 leading-none">Local da tarefa no mapa</label>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
            {(formData.area_nomes?.length > 0 || formData.area_nome || formData.lote_nome) && <div className="text-xs text-slate-600"><span className="font-medium">VINCULADO A:</span> {formData.area_nomes?.length > 0 ? formData.area_nomes.join(", ").toUpperCase() : (formData.area_nome || formData.lote_nome)}</div>}
            {formData.coordenadas ? <div className="text-xs text-slate-600 flex items-center gap-2"><MapPin className="w-3.5 h-3.5" />{formData.coordenadas.lat.toFixed(6)}, {formData.coordenadas.lng.toFixed(6)}</div> : <div className="text-xs text-slate-500">MARQUE O PONTO EXATO NO MAPA PARA FACILITAR A EXECUÇÃO.</div>}
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => { if (onRequestSelectLocation) { onRequestSelectLocation(formData); return; } setShowLocationPicker(true); }}>
              <Crosshair className="w-3.5 h-3.5" />
              {formData.coordenadas ? "Alterar ponto no mapa" : "Marcar ponto no mapa"}
            </Button>
          </div>
        </div>

        {/* Seção de fotos */}
        <div className="space-y-1 pt-0.5 border-t">
          <div className="flex items-center justify-between">
            <label className="text-[12px] text-slate-500 pl-1 leading-none">Fotos da tarefa</label>
            {isOffline && <span className="flex items-center gap-1 text-[10px] text-amber-600"><WifiOff className="w-3 h-3" />Offline — fotos salvas localmente</span>}
          </div>
          <div className="flex flex-wrap gap-2 p-2 rounded-md border border-slate-200 bg-slate-50 min-h-[60px]">
            {/* Fotos já salvas */}
            {(formData.fotos || []).map((url, idx) => (
              <div key={`saved-${idx}`} className="relative w-16 h-16 rounded-md overflow-hidden border border-slate-300 group">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => removeSavedImage(url)} className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
            {/* Novos previews */}
            {previewUrls.map((url, idx) => (
              <div key={`new-${idx}`} className="relative w-16 h-16 rounded-md overflow-hidden border-2 border-emerald-400 group">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => removeNewImage(idx)} className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="w-2.5 h-2.5" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-emerald-500/80 text-white text-[8px] text-center leading-tight py-0.5">NOVA</div>
              </div>
            ))}
            {/* Botão adicionar */}
            <label className="w-16 h-16 rounded-md border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-colors">
              <ImagePlus className="w-5 h-5 text-slate-400" />
              <span className="text-[9px] text-slate-400 mt-0.5">Adicionar</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
            </label>
          </div>
          {pendingImageFiles.length > 0 && (
            <p className="text-[10px] text-emerald-700 pl-1">{pendingImageFiles.length} foto(s) nova(s) {isOffline ? '— serão enviadas ao sincronizar' : '— serão enviadas ao salvar'}</p>
          )}
        </div>

        <div className="flex flex-col-reverse lg:flex-row justify-end gap-1 pt-1 border-t">
          <Button type="button" variant="outline" onClick={onCancel} size="sm" className="h-7 text-xs px-3" disabled={isSubmitting || externalSubmitting}>Cancelar</Button>
          <Button type="submit" size="sm" className="h-7 text-xs px-3 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60" disabled={isSubmitting || externalSubmitting}>
            {(isSubmitting || externalSubmitting) ? "Salvando..." : tarefa ? "Atualizar" : "Salvar"}
          </Button>
        </div>
      </div>
        </CardContent>
      </Card>

      {!onRequestSelectLocation &&
      <TaskLocationPickerDialog
        open={showLocationPicker}
        onOpenChange={setShowLocationPicker}
        areas={areas}
        initialCoordinates={formData.coordenadas}
        onSelect={(coords, area) => {
          if (area?.setor_id) {
            setSetorSelecionadoId(area.setor_id);
          }
          setFormData((prev) => ({
            ...prev,
            coordenadas: coords,
            area_id: area?.id || prev.area_id,
            area_nome: area?.nome || prev.area_nome,
            area_ids: area?.id ? [area.id] : prev.area_ids,
            area_nomes: area?.nome ? [area.nome] : prev.area_nomes,
            setor_nome: area?.setor_nome || prev.setor_nome
          }));
        }} />

      }
    </form>
    </motion.div>);

}