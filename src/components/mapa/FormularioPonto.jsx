/* global google */
import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import CapturaGPSPonto from "./CapturaGPSPonto";
import SelecaoAreasMapa from "./SelecaoAreasMapa";
import SelecaoDepositoMapa from "./SelecaoDepositoMapa";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { normalizeText } from "../suplementacao/estoqueSuplementacaoUtils";
import useSetorAreas from "@/hooks/useSetorAreas";
import bebedouroRepository from "@/repositories/bebedouroRepository";
import { BEBEDOURO_ORIGENS_AGUA, BEBEDOURO_TIPOS } from "@/services/bebedouroService";

const FL = ({ label, required, error, children }) =>
<div>
    <label className="text-[12px] text-slate-500 pl-1 leading-none">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    <div className={`rounded-md border ${error ? 'border-red-500 bg-red-50' : 'border-slate-300'} focus-within:border-emerald-500 transition-colors`}>
      {children}
    </div>
  </div>;


function ProdutoSuplementacaoSelect({ value, onChange }) {
  const empresaSelecionadaId = localStorage.getItem("empresa_selecionada_id");

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-suplementacao", empresaSelecionadaId],
    queryFn: async () => {
      const all = await base44.entities.Produto.list();
      return all.filter((produto) => produto.empresa_id === empresaSelecionadaId && produto.tipo_uso === "Nutrição Animal");
    },
    enabled: !!empresaSelecionadaId
  });

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-7 text-xs border-0 shadow-none focus:ring-0 bg-transparent">
        <SelectValue placeholder="Selecione o produto" />
      </SelectTrigger>
      <SelectContent>
        {produtos.map((produto) =>
        <SelectItem key={produto.id} value={produto.nome_produto} className="text-xs">
            {produto.nome_produto}
          </SelectItem>
        )}
      </SelectContent>
    </Select>);

}

const createEmptyForm = () => ({
  nome: "",
  sigla: "",
  tipo: "",
  configuracao_icone_id: "",
  observacoes: "",
  produto_padrao: "",
  capacidade_cocho_kg: "",
  setor_id: "",
  area_vinculada_id: "",
  area_vinculada_ids: [],
  deposito_origem_id: "",
  metragem_cocho_m: "",
  cobertura_cocho: "",
  consumo_ideal_por_cabeca_kg: "",
  limite_minimo_consumo: "",
  limite_maximo_consumo: "",
  dias_alerta_reposicao: "3",
  estoque_minimo_kg: "",
  alerta_sem_lancamento_dias: "10",
  tipo_bebedouro: "Bebedouro australiano",
  capacidade_agua_litros: "",
  origem_agua: "Poço",
  dias_limpeza_personalizado: "30",
  dias_inspecao_personalizado: "7"
});

export default function FormularioPonto({ coordenadas, onSave, onCancel, usarGPS = false, item = null, onBatchUpdate = null, suggestedDepositoId = null }) {
  const empresaSelecionadaId = localStorage.getItem("empresa_selecionada_id");
  const queryClient = useQueryClient();
  const [areaDetectada, setAreaDetectada] = useState(null);
  const [mostrarCapturaGPS, setMostrarCapturaGPS] = useState(usarGPS);
  const [mostrarSelecaoAreasMapa, setMostrarSelecaoAreasMapa] = useState(false);
  const [mostrarSelecaoDepositoMapa, setMostrarSelecaoDepositoMapa] = useState(false);
  const [coordenadasGPS, setCoordenadasGPS] = useState(coordenadas || item?.coordenadas || null);
  const tipoAtual = item?.tipo || "";
  const [progresso, setProgresso] = useState({ show: false, atual: 0, total: 0, mensagem: "" });
  const [formData, setFormData] = useState(createEmptyForm());
  const [selecionouSetorManualmente, setSelecionouSetorManualmente] = useState(false);
  const [selecionouAreasManualmente, setSelecionouAreasManualmente] = useState(false);

  const { data: iconesConfig = [] } = useQuery({
    queryKey: ["configuracao-icones", empresaSelecionadaId],
    queryFn: async () => {
      const all = await base44.entities.ConfiguracaoIcone.list();
      return all.filter((itemIcone) => itemIcone.tipo_entidade === "Ponto" && itemIcone.ativo !== false);
    },
    enabled: true
  });

  const { setores, areas, getAreasBySetor } = useSetorAreas(empresaSelecionadaId);

  const { data: pontosSuplementacao = [], isSuccess: pontosSuplementacaoLoaded } = useQuery({
    queryKey: ["pontos-suplementacao-form", empresaSelecionadaId],
    queryFn: async () => {
      const all = await base44.entities.PontoSuplementacao.list();
      return all.filter((ponto) => ponto.empresa_id === empresaSelecionadaId && ponto.status === "Ativo");
    },
    enabled: !!empresaSelecionadaId
  });

  const { data: bebedourosForm = [] } = useQuery({
    queryKey: ["bebedouros-form", empresaSelecionadaId],
    queryFn: async () => {
      const all = await base44.entities.Bebedouro.list();
      return all.filter((bebedouro) => bebedouro.empresa_id === empresaSelecionadaId && bebedouro.ativo !== false);
    },
    enabled: !!empresaSelecionadaId
  });

  const pontoSuplementacaoExistente = useMemo(() => {
    if (!item) return null;
    // Prioridade 1: detalhe já enriquecido pela TabelaPontosGeo
    if (item.detalhe_suplementacao?.id) return item.detalhe_suplementacao;
    // Prioridade 2: por ID explícito
    if (item.ponto_suplementacao_id) {
      const porId = pontosSuplementacao.find((ponto) => ponto.id === item.ponto_suplementacao_id);
      if (porId) return porId;
    }
    // Prioridade 3: busca pelo nome (fallback)
    const nomeAtual = normalizeText(item.nome);
    const siglaAtual = normalizeText(item.sigla);
    return pontosSuplementacao.find((ponto) => normalizeText(ponto.nome_ponto) === nomeAtual || (siglaAtual && normalizeText(ponto.sigla) === siglaAtual)) || null;
  }, [item, pontosSuplementacao]);

  const bebedouroExistente = useMemo(() => {
    if (!item) return null;
    const nomeAtual = normalizeText(item.nome);
    const siglaAtual = normalizeText(item.sigla);
    return bebedourosForm.find((bebedouro) => bebedouro.ponto_referencia_id === item.id || normalizeText(bebedouro.nome) === nomeAtual || siglaAtual && normalizeText(bebedouro.codigo_interno) === siglaAtual) || null;
  }, [item, bebedourosForm]);

  const depositosDisponiveis = useMemo(() => {
    return pontosSuplementacao.filter((ponto) => normalizeText(ponto.categoria_ponto || "") === "DEPOSITO");
  }, [pontosSuplementacao]);



  useEffect(() => {
    if (!item) {
      setFormData(createEmptyForm());
      return;
    }

    // Para itens existentes que são cochosD depósitos, aguardar a query carregar antes de popular
    const tipoNorm = normalizeText(item.tipo || "");
    const precisaSupl = tipoNorm.includes("COCHO") || tipoNorm.includes("DEPOSITO");
    if (precisaSupl && !pontosSuplementacaoLoaded) return;

    const isBatchItem = Boolean(onBatchUpdate);
    setFormData({
      nome: item.nome || "",
      sigla: item.sigla || "",
      tipo: item.tipo || "",
      configuracao_icone_id: item.configuracao_icone_id || "",
      observacoes: item.observacoes || (!isBatchItem ? pontoSuplementacaoExistente?.observacoes : "") || "",
      produto_padrao: item.produto_padrao || (!isBatchItem ? pontoSuplementacaoExistente?.produto_padrao : "") || "",
      capacidade_cocho_kg: item.capacidade_cocho_kg || (!isBatchItem ? pontoSuplementacaoExistente?.capacidade_cocho_kg : "") || "",
      setor_id: item.setor_id || (!isBatchItem ? bebedouroExistente?.setor_id || pontoSuplementacaoExistente?.setor_id : "") || areas.find((area) => area.id === item.area_vinculada_id)?.setor_id || "",
      area_vinculada_id: item.area_vinculada_id || (!isBatchItem ? bebedouroExistente?.pasto_id || pontoSuplementacaoExistente?.area_vinculada_id : "") || "",
      area_vinculada_ids: item.area_vinculada_ids?.length ? item.area_vinculada_ids : (!isBatchItem && bebedouroExistente?.area_vinculada_ids?.length ? bebedouroExistente.area_vinculada_ids : (!isBatchItem && pontoSuplementacaoExistente?.area_vinculada_ids?.length ? pontoSuplementacaoExistente.area_vinculada_ids : [])),
      deposito_origem_id: item.deposito_origem_id || (!isBatchItem ? pontoSuplementacaoExistente?.deposito_origem_id : "") || "",
      metragem_cocho_m: item.metragem_cocho_m || (!isBatchItem ? pontoSuplementacaoExistente?.metragem_cocho_m : "") || "",
      cobertura_cocho: item.cobertura_cocho || (!isBatchItem ? pontoSuplementacaoExistente?.cobertura_cocho : "") || "",
      consumo_ideal_por_cabeca_kg: item.consumo_ideal_por_cabeca_kg || (!isBatchItem ? pontoSuplementacaoExistente?.consumo_ideal_por_cabeca_kg : "") || "",
      limite_minimo_consumo: item.limite_minimo_consumo || (!isBatchItem ? pontoSuplementacaoExistente?.limite_minimo_consumo : "") || "",
      limite_maximo_consumo: item.limite_maximo_consumo || (!isBatchItem ? pontoSuplementacaoExistente?.limite_maximo_consumo : "") || "",
      dias_alerta_reposicao: item.dias_alerta_reposicao || (!isBatchItem ? pontoSuplementacaoExistente?.dias_alerta_reposicao : "") || "3",
      estoque_minimo_kg: item.estoque_minimo_kg || (!isBatchItem ? pontoSuplementacaoExistente?.estoque_minimo_kg : "") || "",
      alerta_sem_lancamento_dias: item.alerta_sem_lancamento_dias || (!isBatchItem ? pontoSuplementacaoExistente?.alerta_sem_lancamento_dias : "") || "10",
      tipo_bebedouro: (!isBatchItem ? bebedouroExistente?.tipo : "") || "Bebedouro australiano",
      capacidade_agua_litros: (!isBatchItem ? bebedouroExistente?.capacidade_litros : "") || "",
      origem_agua: (!isBatchItem ? bebedouroExistente?.origem_agua : "") || "Poço",
      dias_limpeza_personalizado: (!isBatchItem ? bebedouroExistente?.dias_limpeza_personalizado : "") || "30",
      dias_inspecao_personalizado: (!isBatchItem ? bebedouroExistente?.dias_inspecao_personalizado : "") || "7"
    });
  }, [item, pontoSuplementacaoExistente, bebedouroExistente, areas, pontosSuplementacaoLoaded]);

  const handleCapturaGPS = (localizacao) => {
    setCoordenadasGPS(localizacao);
    setMostrarCapturaGPS(false);
    toast.success("Localização GPS capturada!");
  };

  const toggleAreaVinculada = (areaId, checked) => {
    setSelecionouAreasManualmente(true);
    setFormData((prev) => {
      const atuais = Array.isArray(prev.area_vinculada_ids) ? prev.area_vinculada_ids : [];
      const proximas = checked ? Array.from(new Set([...atuais, areaId])) : atuais.filter((id) => id !== areaId);
      return {
        ...prev,
        area_vinculada_ids: proximas,
        area_vinculada_id: proximas[0] || ""
      };
    });
  };

  useEffect(() => {
    // Só sincroniza setor com área quando não está editando um item existente
    if (item) return;
    const areaPrincipal = areas.find((area) => area.id === formData.area_vinculada_id);
    if (areaPrincipal && formData.setor_id !== areaPrincipal.setor_id) {
      setFormData((prev) => ({ ...prev, setor_id: areaPrincipal.setor_id || "" }));
    }
  }, [areas, formData.area_vinculada_id, formData.setor_id, item]);

  useEffect(() => {
    if (!item && !onBatchUpdate) {
      setSelecionouSetorManualmente(false);
      setSelecionouAreasManualmente(false);
    }
  }, [item, onBatchUpdate, coordenadasGPS, coordenadas]);

  useEffect(() => {
    // Detecção automática de área só para pontos NOVOS (sem item existente)
    if (item) return;
    const pontoCoords = coordenadasGPS || coordenadas;
    if (!pontoCoords || !areas.length) return;

    let detectada = null;

    for (const area of areas) {
      const areaCoords = area.coordenadas?.coords || [];
      if (areaCoords.length < 3) continue;

      const polygon = areaCoords.map((coord) => ({ lat: coord[0] || coord.lat, lng: coord[1] || coord.lng }));
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].lat;
        const yi = polygon[i].lng;
        const xj = polygon[j].lat;
        const yj = polygon[j].lng;
        const intersect = yi > pontoCoords.lng !== yj > pontoCoords.lng && pontoCoords.lat < (xj - xi) * (pontoCoords.lng - yi) / (yj - yi) + xi;
        if (intersect) inside = !inside;
      }

      if (inside) {
        detectada = area;
        break;
      }
    }

    if (detectada) {
      setAreaDetectada(detectada);
      setFormData((prev) => {
        const proximasMudancas = {};
        const areaIds = Array.isArray(prev.area_vinculada_ids) ? prev.area_vinculada_ids : [];
        const isCochoOuBebedouro = normalizeText(prev.tipo || tipoAtual).includes("COCHO") || normalizeText(prev.tipo || tipoAtual).includes("BEBEDOURO");

        if (detectada.setor_id && (!prev.setor_id || !selecionouSetorManualmente) && prev.setor_id !== detectada.setor_id) {
          proximasMudancas.setor_id = detectada.setor_id;
        }

        if (isCochoOuBebedouro && !selecionouAreasManualmente) {
          const mesmaAreaUnica = areaIds.length === 1 && areaIds[0] === detectada.id;
          if (!mesmaAreaUnica || prev.area_vinculada_id !== detectada.id) {
            proximasMudancas.area_vinculada_id = detectada.id;
            proximasMudancas.area_vinculada_ids = [detectada.id];
          }
        }

        return Object.keys(proximasMudancas).length ? { ...prev, ...proximasMudancas } : prev;
      });
    } else {
      setAreaDetectada(null);
    }
  }, [coordenadasGPS, coordenadas, areas, selecionouSetorManualmente, selecionouAreasManualmente, tipoAtual, item]);



  const ehCocho = normalizeText(formData.tipo).includes("COCHO");
  const ehDeposito = normalizeText(formData.tipo).includes("DEPOSITO");
  const ehBebedouro = normalizeText(formData.tipo).includes("BEBEDOURO");
  const areasDoSetor = formData.setor_id ? getAreasBySetor(formData.setor_id) : [];

  const createPontoMutation = useMutation({
    mutationFn: async (data) => {
      const pontosReferencia = await base44.entities.PontoReferencia.list();
      const maxNumeroPonto = pontosReferencia.reduce((maximo, ponto) => Math.max(maximo, parseInt(ponto.numero_ponto) || 0), 0);
      const configIcone = iconesConfig.find((icone) => icone.id === data.configuracao_icone_id) ||
      iconesConfig.find((icone) => normalizeText(icone.categoria) === normalizeText(data.tipo));

      setProgresso({ show: true, atual: 1, total: 3, mensagem: item ? "Atualizando ponto de referência..." : "Criando ponto de referência..." });

      const payloadPonto = {
        nome: data.nome,
        sigla: data.sigla,
        tipo: data.tipo,
        configuracao_icone_id: data.configuracao_icone_id || null,
        icone_url: configIcone?.icone_url || null,
        sub_icone_url: configIcone?.sub_icone_url || null,
        observacoes: data.observacoes,
        empresa_id: empresaSelecionadaId,
        numero_ponto: item?.numero_ponto || String(maxNumeroPonto + 1),
        ativo: true,
        cor: configIcone?.cor_padrao || "#0066ff",
        coordenadas: coordenadasGPS || coordenadas
      };

      const pontoReferencia = item ?
      await base44.entities.PontoReferencia.update(item.id, payloadPonto) :
      await base44.entities.PontoReferencia.create(payloadPonto);

      if (normalizeText(data.tipo).includes("BEBEDOURO")) {
        const areasSelecionadas = areas.filter((area) => (data.area_vinculada_ids || []).includes(area.id));
        const areaSelecionada = areasSelecionadas[0] || null;
        const bebedouros = await base44.entities.Bebedouro.list();
        const bebedouroExistente = bebedouros.find((bebedouro) => bebedouro.ponto_referencia_id === pontoReferencia.id);
        const payloadBebedouro = {
          empresa_id: empresaSelecionadaId,
          ponto_referencia_id: pontoReferencia.id,
          nome: data.nome,
          codigo_interno: data.sigla,
          pasto_id: areaSelecionada?.id || null,
          pasto_nome: areaSelecionada?.nome || null,
          area_vinculada_ids: areasSelecionadas.map((area) => area.id),
          area_vinculada_nomes: areasSelecionadas.map((area) => area.nome),
          setor_id: data.setor_id || areaSelecionada?.setor_id || null,
          setor_nome: areaSelecionada?.setor_nome || setores.find((setor) => setor.id === data.setor_id)?.nome || null,
          tipo: data.tipo_bebedouro || "Bebedouro australiano",
          capacidade_litros: data.capacidade_agua_litros ? parseFloat(data.capacidade_agua_litros) : null,
          origem_agua: data.origem_agua || "Poço",
          periodicidade_limpeza: "Personalizado",
          periodicidade_inspecao: "Personalizado",
          dias_limpeza_personalizado: data.dias_limpeza_personalizado ? parseInt(data.dias_limpeza_personalizado) : 30,
          dias_inspecao_personalizado: data.dias_inspecao_personalizado ? parseInt(data.dias_inspecao_personalizado) : 7,
          coordenadas: coordenadasGPS || coordenadas,
          status: "Ativo",
          ativo: true,
          observacoes: data.observacoes || null
        };
        if (bebedouroExistente) await bebedouroRepository.updateBebedouro(bebedouroExistente.id, payloadBebedouro);
        else await bebedouroRepository.createBebedouro(payloadBebedouro);
      }

      if (!data.tipo_categoria && pontoSuplementacaoExistente) {
        setProgresso({ show: true, atual: 2, total: 3, mensagem: "Inativando vínculo de suplementação..." });
        await base44.entities.PontoSuplementacao.update(pontoSuplementacaoExistente.id, { status: "Inativo" });
        return pontoReferencia;
      }

      if (!data.tipo_categoria) return pontoReferencia;

      setProgresso({ show: true, atual: 2, total: 3, mensagem: data.tipo_categoria === "DEPOSITO" ? "Configurando depósito..." : "Configurando cocho..." });

      const pontosSuplementacaoEmpresa = await base44.entities.PontoSuplementacao.list();
      const pontosAtivosEmpresa = pontosSuplementacaoEmpresa.filter((ponto) => ponto.empresa_id === empresaSelecionadaId && ponto.status === "Ativo");
      const maiorNumero = pontosAtivosEmpresa.reduce((maximo, ponto) => Math.max(maximo, parseInt(String(ponto.numero_ponto || "").replace(/\D/g, "")) || 0), 0);
      const prefixo = data.tipo_categoria === "DEPOSITO" ? "DEP" : "COCHO";
      const areasVinculadas = data.tipo_categoria === "COCHO" ?
      areas.filter((area) => (data.area_vinculada_ids || []).includes(area.id)) :
      [];
      const areaVinculadaPrincipal = areasVinculadas[0] || null;
      let localEstoqueId = pontoSuplementacaoExistente?.local_estoque_id || item?.detalhe_suplementacao?.local_estoque_id || null;
      let localEstoqueNome = pontoSuplementacaoExistente?.local_estoque_nome || item?.detalhe_suplementacao?.local_estoque_nome || null;

      if (data.tipo_categoria === "DEPOSITO") {
        const descricaoLocal = `DEPÓSITO DE SUPLEMENTAÇÃO - ${data.nome}`;

        if (!localEstoqueId) {
          const locais = await base44.entities.LocalEstoque.list();
          const nomeNormalizado = normalizeText(data.nome);
          const nomesAntigos = pontoSuplementacaoExistente ? [
            pontoSuplementacaoExistente.local_estoque_nome,
            pontoSuplementacaoExistente.nome_ponto,
            item?.nome
          ].filter(Boolean).map(normalizeText) : [];
          const localExistente = locais.find((local) =>
            nomeNormalizado === normalizeText(local.nome) ||
            nomesAntigos.includes(normalizeText(local.nome)) ||
            nomesAntigos.includes(normalizeText(String(local.descricao || "").replace("DEPÓSITO DE SUPLEMENTAÇÃO -", "").trim()))
          );
          if (localExistente) {
            localEstoqueId = localExistente.id;
            localEstoqueNome = localExistente.nome;
          }
        }

        if (localEstoqueId) {
          await base44.entities.LocalEstoque.update(localEstoqueId, { nome: data.nome, descricao: descricaoLocal });
          localEstoqueNome = data.nome;

          const [lotesEstoque, movimentacoesEstoque] = await Promise.all([
            base44.entities.EstoqueLoteNota.filter({ local_estoque_id: localEstoqueId }),
            base44.entities.MovimentacaoEstoque.list("-data_movimentacao", 500)
          ]);

          await Promise.all([
            ...lotesEstoque.map((lote) => base44.entities.EstoqueLoteNota.update(lote.id, { local_estoque_nome: data.nome })),
            ...movimentacoesEstoque
              .filter((mov) => mov.local_estoque_origem === localEstoqueId || mov.local_estoque_destino === localEstoqueId)
              .map((mov) => base44.entities.MovimentacaoEstoque.update(mov.id, {
                ...(mov.local_estoque_origem === localEstoqueId ? { local_origem: data.nome } : {}),
                ...(mov.local_estoque_destino === localEstoqueId ? { local_destino: data.nome } : {})
              }))
          ]);
        } else {
          const localCriado = await base44.entities.LocalEstoque.create({ nome: data.nome, descricao: descricaoLocal });
          localEstoqueId = localCriado.id;
          localEstoqueNome = localCriado.nome;
        }
      }

      const depositoSelecionado = depositosDisponiveis.find((ponto) => ponto.id === data.deposito_origem_id);
      const setorSelecionado = setores.find((setor) => setor.id === data.setor_id);
      const payloadSuplementacao = {
        empresa_id: empresaSelecionadaId,
        numero_ponto: pontoSuplementacaoExistente?.numero_ponto || `${prefixo}-${String(maiorNumero + 1).padStart(4, "0")}`,
        setor_id: data.setor_id || null,
        setor_nome: setorSelecionado?.nome || null,
        nome_ponto: data.nome,
        sigla: data.sigla,
        categoria_ponto: data.tipo_categoria,
        tipo: data.tipo,
        produto_padrao: data.tipo_categoria === "COCHO" ? data.produto_padrao || null : null,
        capacidade_cocho_kg: data.capacidade_cocho_kg ? parseFloat(data.capacidade_cocho_kg) : null,
        metragem_cocho_m: data.tipo_categoria === "COCHO" && data.metragem_cocho_m ? parseFloat(data.metragem_cocho_m) : null,
        cobertura_cocho: data.tipo_categoria === "COCHO" ? data.cobertura_cocho || null : null,
        area_vinculada_id: data.tipo_categoria === "COCHO" ? areaVinculadaPrincipal?.id || null : null,
        area_vinculada_nome: data.tipo_categoria === "COCHO" ? areaVinculadaPrincipal?.nome || "" : null,
        area_vinculada_ids: data.tipo_categoria === "COCHO" ? data.area_vinculada_ids || [] : [],
        area_vinculada_nomes: data.tipo_categoria === "COCHO" ? areasVinculadas.map((area) => area.nome) : [],
        deposito_origem_id: data.tipo_categoria === "COCHO" ? data.deposito_origem_id || null : null,
        deposito_origem_nome: data.tipo_categoria === "COCHO" ? depositoSelecionado?.nome_ponto || null : null,
        local_estoque_id: data.tipo_categoria === "DEPOSITO" ? localEstoqueId : null,
        local_estoque_nome: data.tipo_categoria === "DEPOSITO" ? localEstoqueNome : null,
        coordenadas: coordenadasGPS || coordenadas,
        status: "Ativo",
        observacoes: data.observacoes || null,
        consumo_ideal_por_cabeca_kg: data.tipo_categoria === "COCHO" && data.consumo_ideal_por_cabeca_kg ? parseFloat(data.consumo_ideal_por_cabeca_kg) : null,
        limite_minimo_consumo: data.tipo_categoria === "COCHO" && data.limite_minimo_consumo ? parseFloat(data.limite_minimo_consumo) : null,
        limite_maximo_consumo: data.tipo_categoria === "COCHO" && data.limite_maximo_consumo ? parseFloat(data.limite_maximo_consumo) : null,
        dias_alerta_reposicao: data.tipo_categoria === "COCHO" && data.dias_alerta_reposicao ? parseInt(data.dias_alerta_reposicao) : 3,
        estoque_minimo_kg: data.tipo_categoria === "DEPOSITO" && data.estoque_minimo_kg ? parseFloat(data.estoque_minimo_kg) : null,
        alerta_sem_lancamento_dias: data.tipo_categoria === "COCHO" ? parseInt(data.alerta_sem_lancamento_dias || 10) : null
      };

      const registroSuplementacao = pontoSuplementacaoExistente ?
      await base44.entities.PontoSuplementacao.update(pontoSuplementacaoExistente.id, payloadSuplementacao) :
      await base44.entities.PontoSuplementacao.create(payloadSuplementacao);

      if (data.tipo_categoria === "DEPOSITO") {
        setProgresso({ show: true, atual: 3, total: 3, mensagem: "Atualizando cochos vinculados..." });
        const cochosRelacionados = pontosAtivosEmpresa.filter((ponto) => ponto.deposito_origem_id === registroSuplementacao.id);
        for (const cocho of cochosRelacionados) {
          await base44.entities.PontoSuplementacao.update(cocho.id, { deposito_origem_nome: data.nome });
        }
      }

      return pontoReferencia;
    },
    onSuccess: () => {
      setProgresso({ show: false, atual: 0, total: 0, mensagem: "" });
      queryClient.invalidateQueries({ predicate: (query) => Array.isArray(query.queryKey) && ["pontos", "pontos-suplementacao-form", "mapa-pontos", "mapa-pontos-supl", "pontos-suplementacao", "bebedouros", "locais-estoque", "saldo-deposito", "historico-deposito", "movimentacoes-deposito-detalhe", "mapa-estoque-lotes", "movimentacoes"].includes(query.queryKey[0]) });
      window.dispatchEvent(new CustomEvent("atualizar-mapa"));
      toast.success(item ? "Ponto atualizado com sucesso." : "Ponto cadastrado com sucesso.");
      onSave();
    },
    onError: (error) => {
      setProgresso({ show: false, atual: 0, total: 0, mensagem: "" });
      toast.error(error.message || "Erro ao salvar o ponto.");
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.nome || !formData.tipo) {
      toast.error("Preencha o nome e o tipo do ponto.");
      return;
    }

    if (!coordenadasGPS && !coordenadas) {
      toast.error("Coordenadas não informadas.");
      return;
    }

    if ((ehCocho || ehDeposito || ehBebedouro) && !formData.setor_id) {
      toast.error("Selecione o setor do ponto.");
      return;
    }

    if (ehCocho && !(formData.area_vinculada_ids || []).length) {
      toast.error("Selecione pelo menos uma área do cocho.");
      return;
    }

    if (ehBebedouro && !(formData.area_vinculada_ids || []).length) {
      toast.error("Selecione pelo menos um pasto do bebedouro.");
      return;
    }

    if (ehBebedouro && !formData.capacidade_agua_litros) {
      toast.error("Informe a capacidade de água do bebedouro.");
      return;
    }

    if (ehCocho && !formData.deposito_origem_id) {
      toast.error("Selecione o depósito vinculado ao cocho.");
      return;
    }

    if (ehCocho && !formData.capacidade_cocho_kg) {
      toast.error("Informe a capacidade do cocho em kg.");
      return;
    }

    if (ehCocho && !formData.metragem_cocho_m) {
      toast.error("Informe a metragem do cocho.");
      return;
    }



    if (ehCocho && !formData.cobertura_cocho) {
      toast.error("Selecione se o cocho é coberto ou não coberto.");
      return;
    }

    if (ehDeposito && !formData.capacidade_cocho_kg) {
      toast.error("Informe a capacidade do depósito em kg.");
      return;
    }

    if (ehDeposito && !formData.estoque_minimo_kg) {
      toast.error("Informe o estoque mínimo do depósito em kg.");
      return;
    }

    if (onBatchUpdate) {
      onBatchUpdate({
        ...formData,
        nome: formData.nome.toUpperCase(),
        sigla: formData.sigla.toUpperCase(),
        tipo_categoria: ehDeposito ? "DEPOSITO" : ehCocho ? "COCHO" : null
      });
      return;
    }

    createPontoMutation.mutate({
      nome: formData.nome.toUpperCase(),
      sigla: formData.sigla.toUpperCase(),
      tipo: formData.tipo,
      configuracao_icone_id: formData.configuracao_icone_id,
      observacoes: formData.observacoes?.toUpperCase(),
      setor_id: formData.setor_id,
      produto_padrao: ehCocho ? formData.produto_padrao : null,
      capacidade_cocho_kg: formData.capacidade_cocho_kg,
      area_vinculada_id: ehCocho || ehBebedouro ? formData.area_vinculada_ids?.[0] || "" : null,
      area_vinculada_ids: ehCocho || ehBebedouro ? formData.area_vinculada_ids : [],
      deposito_origem_id: ehCocho ? formData.deposito_origem_id : null,
      metragem_cocho_m: ehCocho ? formData.metragem_cocho_m : null,
      cobertura_cocho: ehCocho ? formData.cobertura_cocho : null,
      consumo_ideal_por_cabeca_kg: ehCocho ? formData.consumo_ideal_por_cabeca_kg : null,
      limite_minimo_consumo: ehCocho ? formData.limite_minimo_consumo : null,
      limite_maximo_consumo: ehCocho ? formData.limite_maximo_consumo : null,
      dias_alerta_reposicao: ehCocho ? formData.dias_alerta_reposicao : null,
      estoque_minimo_kg: ehDeposito ? formData.estoque_minimo_kg : null,
      alerta_sem_lancamento_dias: ehCocho ? formData.alerta_sem_lancamento_dias : null,
      tipo_bebedouro: ehBebedouro ? formData.tipo_bebedouro : null,
      capacidade_agua_litros: ehBebedouro ? formData.capacidade_agua_litros : null,
      origem_agua: ehBebedouro ? formData.origem_agua : null,
      dias_limpeza_personalizado: ehBebedouro ? formData.dias_limpeza_personalizado : null,
      dias_inspecao_personalizado: ehBebedouro ? formData.dias_inspecao_personalizado : null,
      tipo_categoria: ehDeposito ? "DEPOSITO" : ehCocho ? "COCHO" : null
    });
  };

  if (mostrarCapturaGPS) {
    return (
      <CapturaGPSPonto
        onCapturar={handleCapturaGPS}
        onCancelar={() => {
          setMostrarCapturaGPS(false);
          if (usarGPS) onCancel();
        }} />);


  }

  if (mostrarSelecaoAreasMapa) {
    return (
      <SelecaoAreasMapa
        selectionMode
        selectedIds={formData.area_vinculada_ids}
        onClose={() => setMostrarSelecaoAreasMapa(false)}
        onConfirmSelection={(ids) => {
          setSelecionouAreasManualmente(true);
          const primeiraArea = areas.find((area) => area.id === ids[0]);
          setFormData((prev) => ({
            ...prev,
            area_vinculada_ids: ids,
            area_vinculada_id: ids[0] || "",
            setor_id: primeiraArea?.setor_id || prev.setor_id
          }));
          setMostrarSelecaoAreasMapa(false);
        }} />);
  }

  if (mostrarSelecaoDepositoMapa) {
    return (
      <SelecaoDepositoMapa
        cochoCoords={coordenadasGPS || coordenadas || item?.coordenadas || null}
        depositoSelecionadoId={formData.deposito_origem_id}
        onSelect={(depositoId) => setFormData((prev) => ({ ...prev, deposito_origem_id: depositoId }))}
        onClose={() => setMostrarSelecaoDepositoMapa(false)}
      />);
  }

  return (
    <>
      <div className="bg-card text-card-foreground rounded-xl border shadow-sm border-slate-300">
        <div className="flex flex-col space-y-1.5 p-6 bg-slate-50 border-b py-1 px-1">
          <div className="text-sm font-semibold text-slate-900">{item ? 'Editar Ponto' : 'Novo Ponto'}</div>
        </div>
        <div className="p-1">
          <form onSubmit={handleSubmit} className="space-y-0.5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-1">
          <FL label="Nome do ponto" required><Input value={formData.nome} onChange={(e) => setFormData((prev) => ({ ...prev, nome: e.target.value }))} className="h-7 text-xs uppercase border-0 shadow-none focus-visible:ring-0 bg-transparent" required /></FL>
          <FL label="Sigla"><Input value={formData.sigla} onChange={(e) => setFormData((prev) => ({ ...prev, sigla: e.target.value }))} className="h-7 text-xs uppercase border-0 shadow-none focus-visible:ring-0 bg-transparent" maxLength={10} /></FL>
        </div>
        <FL label="Ponto de referência" required>
          <Select value={formData.configuracao_icone_id} onValueChange={(value) => {const configuracao = iconesConfig.find((itemConfig) => itemConfig.id === value);setFormData((prev) => ({ ...prev, configuracao_icone_id: value, tipo: configuracao?.categoria || prev.tipo }));}}>
            <SelectTrigger className="h-7 text-xs border-0 shadow-none focus:ring-0 bg-transparent"><SelectValue placeholder="Selecione o tipo do ponto" /></SelectTrigger>
            <SelectContent>{iconesConfig.map((itemConfig) => <SelectItem key={itemConfig.id} value={itemConfig.id} className="text-xs">{itemConfig.categoria}</SelectItem>)}</SelectContent>
          </Select>
        </FL>
        <FL label="Observações"><Textarea value={formData.observacoes} onChange={(e) => setFormData((prev) => ({ ...prev, observacoes: e.target.value }))} rows={3} className="text-xs uppercase border-0 shadow-none focus-visible:ring-0 bg-transparent" /></FL>

        {ehCocho &&
            <div className="space-y-1 border-t pt-1">
            <div className="text-xs font-semibold text-slate-700">Dados do Cocho</div>
            {areaDetectada && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Área detectada: {areaDetectada.nome}</div>}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-1">
              <FL label="Setor" required>
                <Select value={formData.setor_id || '__none__'} onValueChange={(value) => {
                  setSelecionouSetorManualmente(true);
                  setSelecionouAreasManualmente(true);
                  setFormData((prev) => ({ ...prev, setor_id: value === '__none__' ? '' : value, area_vinculada_id: '', area_vinculada_ids: [] }));
                }}>
                  <SelectTrigger className="h-7 text-xs border-0 shadow-none focus:ring-0 bg-transparent"><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" className="text-xs">Selecione</SelectItem>
                    {setores.map((setor) => <SelectItem key={setor.id} value={setor.id} className="text-xs">{setor.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FL>
              <div className="space-y-1 lg:col-span-2">
                <Label className="text-xs">Áreas vinculadas *</Label>
                <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-[11px] text-slate-500">Selecione uma ou mais áreas que consomem neste mesmo cocho.</p>
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setMostrarSelecaoAreasMapa(true)}>Selecionar no mapa</Button>
                  </div>
                  <div className="flex flex-col gap-1.5 max-h-20 overflow-y-auto pr-1">
                    {areasDoSetor.map((area) => {
                        const checked = formData.area_vinculada_ids?.includes(area.id);
                        const nomeArea = area.nome || area.area_vinculada_nome || `ÁREA ${area.numero_area || ''}`.trim();
                        const descricaoMapa = [area.numero_area ? `MAPA ${area.numero_area}` : null, area.setor_nome || null].filter(Boolean).join(" • ");
                        return (
                          <label key={area.id} className="flex items-start gap-2 py-1 text-xs cursor-pointer group">
                          <Checkbox checked={checked} onCheckedChange={(value) => toggleAreaVinculada(area.id, Boolean(value))} className="mt-0.5" />
                          <span className="flex flex-col leading-tight">
                            <span className="font-medium text-slate-700 group-hover:text-emerald-700 transition-colors">{nomeArea}</span>
                            
                          </span>
                        </label>);

                      })}
                  </div>
                </div>
              </div>

              <div className="space-y-1 lg:col-span-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label className="text-xs">Depósito vinculado *</Label>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setMostrarSelecaoDepositoMapa(true)}>Selecionar no mapa</Button>
                </div>
                <div className="rounded-md border border-slate-300">
                  <Select value={formData.deposito_origem_id || "__none__"} onValueChange={(value) => setFormData((prev) => ({ ...prev, deposito_origem_id: value === "__none__" ? "" : value }))}>
                    <SelectTrigger className="h-7 text-xs border-0 shadow-none focus:ring-0 bg-transparent"><SelectValue placeholder="Selecione o depósito" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__" className="text-xs">Selecione o depósito</SelectItem>
                      {depositosDisponiveis.map((deposito) => <SelectItem key={deposito.id} value={deposito.id} className="text-xs">{deposito.nome_ponto}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

              </div>
              <FL label="Produto padrão">
                <ProdutoSuplementacaoSelect value={formData.produto_padrao} onChange={(value) => setFormData((prev) => ({ ...prev, produto_padrao: value }))} />
              </FL>
              <FL label="Capacidade do cocho (kg)" required>
                <Input type="number" step="0.01" value={formData.capacidade_cocho_kg} onChange={(e) => setFormData((prev) => ({ ...prev, capacidade_cocho_kg: e.target.value }))} className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent" />
              </FL>
              <FL label="Metragem do cocho (m)" required>
                <Input type="number" step="0.01" value={formData.metragem_cocho_m} onChange={(e) => setFormData((prev) => ({ ...prev, metragem_cocho_m: e.target.value }))} className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent" />
              </FL>
              <FL label="Cobertura" required>
                <Select value={formData.cobertura_cocho} onValueChange={(value) => setFormData((prev) => ({ ...prev, cobertura_cocho: value }))}>
                  <SelectTrigger className="h-7 text-xs border-0 shadow-none focus:ring-0 bg-transparent"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Coberto" className="text-xs">Coberto</SelectItem>
                    <SelectItem value="Não Coberto" className="text-xs">Não Coberto</SelectItem>
                  </SelectContent>
                </Select>
              </FL>
              <FL label="Dias de alerta para reposição">
                <Input type="number" value={formData.dias_alerta_reposicao} onChange={(e) => setFormData((prev) => ({ ...prev, dias_alerta_reposicao: e.target.value }))} placeholder="3" className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent" />
              </FL>
              <FL label="Alerta sem lançamento (dias)">
                <Input type="number" value={formData.alerta_sem_lancamento_dias} onChange={(e) => setFormData((prev) => ({ ...prev, alerta_sem_lancamento_dias: e.target.value }))} placeholder="10" className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent" />
              </FL>
            </div>

            {depositosDisponiveis.length === 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Cadastre primeiro um ponto do tipo depósito para vincular este cocho.</div>}
          </div>
            }

        {ehBebedouro &&
            <div className="space-y-1 border-t pt-1">
            <div className="text-xs font-semibold text-slate-700">Dados do Bebedouro</div>
            {areaDetectada && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Área detectada: {areaDetectada.nome}</div>}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-1">
              <FL label="Setor" required>
                <Select value={formData.setor_id || '__none__'} onValueChange={(value) => {
                  setSelecionouSetorManualmente(true);
                  setSelecionouAreasManualmente(true);
                  setFormData((prev) => ({ ...prev, setor_id: value === '__none__' ? '' : value, area_vinculada_id: '', area_vinculada_ids: [] }));
                }}>
                  <SelectTrigger className="h-7 text-xs border-0 shadow-none focus:ring-0 bg-transparent"><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" className="text-xs">Selecione</SelectItem>
                    {setores.map((setor) => <SelectItem key={setor.id} value={setor.id} className="text-xs">{setor.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FL>
              <div className="space-y-1 lg:col-span-2">
                <Label className="text-xs">Pastos vinculados *</Label>
                <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-[11px] text-slate-500">Selecione um ou mais pastos atendidos por este mesmo bebedouro.</p>
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setMostrarSelecaoAreasMapa(true)}>Selecionar no mapa</Button>
                  </div>
                  <div className="flex flex-col gap-1.5 max-h-20 overflow-y-auto pr-1">
                    {areasDoSetor.map((area) => {
                      const checked = formData.area_vinculada_ids?.includes(area.id);
                      const nomeArea = area.nome || area.area_vinculada_nome || `ÁREA ${area.numero_area || ''}`.trim();
                      return (
                        <label key={area.id} className="flex items-start gap-2 py-1 text-xs cursor-pointer group">
                          <Checkbox checked={checked} onCheckedChange={(value) => toggleAreaVinculada(area.id, Boolean(value))} className="mt-0.5" />
                          <span className="font-medium text-slate-700 group-hover:text-emerald-700 transition-colors">{nomeArea}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
              <FL label="Tipo do bebedouro" required>
                <Select value={formData.tipo_bebedouro} onValueChange={(value) => setFormData((prev) => ({ ...prev, tipo_bebedouro: value }))}>
                  <SelectTrigger className="h-7 text-xs border-0 shadow-none focus:ring-0 bg-transparent"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {["Caixa d’água", "Bebedouro australiano", "Concreto", "Tambor", "Natural", "Outro"].map((tipo) => <SelectItem key={tipo} value={tipo} className="text-xs">{tipo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FL>
              <FL label="Capacidade de água (litros)" required>
                <Input type="number" step="0.01" value={formData.capacidade_agua_litros} onChange={(e) => setFormData((prev) => ({ ...prev, capacidade_agua_litros: e.target.value }))} className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent" />
              </FL>
              <FL label="Origem / tipo de água">
                <Select value={formData.origem_agua} onValueChange={(value) => setFormData((prev) => ({ ...prev, origem_agua: value }))}>
                  <SelectTrigger className="h-7 text-xs border-0 shadow-none focus:ring-0 bg-transparent"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {["Poço", "Água encanada", "Mina", "Rio", "Represa", "Rede", "Outro"].map((origem) => <SelectItem key={origem} value={origem} className="text-xs">{origem}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FL>
              <FL label="Rotina de limpeza (dias)">
                <Input type="number" value={formData.dias_limpeza_personalizado} onChange={(e) => setFormData((prev) => ({ ...prev, dias_limpeza_personalizado: e.target.value }))} className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent" />
              </FL>
              <FL label="Rotina de inspeção (dias)">
                <Input type="number" value={formData.dias_inspecao_personalizado} onChange={(e) => setFormData((prev) => ({ ...prev, dias_inspecao_personalizado: e.target.value }))} className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent" />
              </FL>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">Ao salvar, este ponto será criado também no módulo de Gestão de Bebedouros.</div>
          </div>
            }

        {ehDeposito &&
            <div className="space-y-1 border-t pt-1">
            <div className="text-xs font-semibold text-slate-700">Depósito de Suplementação</div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">Ao salvar este ponto, um local de estoque será criado automaticamente para uso exclusivo dos produtos de suplementação.</div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-1">
              <FL label="Setor" required>
                <Select value={formData.setor_id || '__none__'} onValueChange={(value) => setFormData((prev) => ({ ...prev, setor_id: value === '__none__' ? '' : value }))}>
                  <SelectTrigger className="h-7 text-xs border-0 shadow-none focus:ring-0 bg-transparent"><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" className="text-xs">Selecione</SelectItem>
                    {setores.map((setor) => <SelectItem key={setor.id} value={setor.id} className="text-xs">{setor.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FL>
              <FL label="Capacidade do depósito (kg)" required>
                <Input type="number" step="0.01" value={formData.capacidade_cocho_kg} onChange={(e) => setFormData((prev) => ({ ...prev, capacidade_cocho_kg: e.target.value }))} className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent" />
              </FL>
              <FL label="Estoque mínimo (kg)" required>
                <Input type="number" step="0.01" value={formData.estoque_minimo_kg} onChange={(e) => setFormData((prev) => ({ ...prev, estoque_minimo_kg: e.target.value }))} className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent" />
              </FL>
            </div>
            {pontoSuplementacaoExistente?.local_estoque_nome && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Local de estoque atual: {pontoSuplementacaoExistente.local_estoque_nome}</div>}
          </div>
            }

        <div className="flex justify-end gap-1 pt-1 border-t">
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onCancel} disabled={progresso.show}>Cancelar</Button>
          <Button type="submit" size="sm" className="h-7 text-xs px-3 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={progresso.show}>{progresso.show ? "Salvando..." : onBatchUpdate ? "Confirmar ponto no lote" : item ? "Salvar alterações" : "Salvar ponto"}</Button>
        </div>
          </form>
        </div>
      </div>

      <Dialog open={progresso.show} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-sm">Salvando...</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-slate-600">{progresso.mensagem}</p>
            <Progress value={progresso.total ? progresso.atual / progresso.total * 100 : 0} className="w-full h-1.5" />
          </div>
        </DialogContent>
      </Dialog>
    </>);

}