/* global google */
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMapaCachedData, refreshMapaCacheEntry } from "@/components/offline/mapaOfflineCache";
import { canAccessPage, normalizePermissionRecord } from "@/lib/permissions";
import { normalizeMapaGeralPermissions } from "@/lib/mapaGeralPermissions";
import { Button } from "@/components/ui/button";
import { BarChart3 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle } from
"@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle } from
"@/components/ui/sheet";
import DetalhesLote from "../components/mapa/DetalhesLote";
import DetalhesArea from "../components/mapa/DetalhesArea";
import DetalhesPontoSuplementacao from "../components/mapa/DetalhesPontoSuplementacao";
import DetalhesBebedouro from "../components/bebedouros/DetalhesBebedouro";
import TarefasMapaPanel from "../components/mapa/TarefasMapaPanel";
import DetalhesTarefaMapa from "../components/mapa/DetalhesTarefaMapa";
import MapaInsights from "../components/mapa/MapaInsights";
import MapaControlesMobile from "../components/mapa/MapaControlesMobile";
import MapaFiltrosAvancados, {
  CORES_TIPO_CULTURA, CORES_APROVEITAMENTO, CORES_OCUPACAO, CORES_CATEGORIA_GADO,
  CORES_UA_HA, CORES_SITUACAO_PASTO } from
"../components/mapa/MapaFiltrosAvancados";
import MapaLegenda from "../components/mapa/MapaLegenda";
import useMapRenderer from "../components/mapa/useMapRenderer";
import useSetorAreas from "@/hooks/useSetorAreas";
import { useBebedouros } from "@/hooks/useBebedouros";
import { getCochoIndicator, getDepositoIndicator, buildProgressIconUrl } from "../components/mapa/pontoStatusUtils";
import { buildMapaAlertasSuplementacao } from "../components/mapa/mapaAlertasSuplementacaoUtils";
import { normalizeText } from "../components/suplementacao/estoqueSuplementacaoUtils";

const GOOGLE_MAPS_API_KEY = "AIzaSyB-PfoOotwVlkAzt72cBgYE2tl4vJuqFe8";
let _gmapsPromise = null;
const loadGoogleMapsScript = () => {
  if (window.google?.maps?.Map) return Promise.resolve();
  if (_gmapsPromise) return _gmapsPromise;
  _gmapsPromise = new Promise((resolve, reject) => {
    // Check if script tag already exists
    const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existing) {existing.addEventListener('load', resolve);existing.addEventListener('error', reject);return;}
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=drawing,geometry`;
    s.async = true;s.defer = true;
    s.onload = resolve;s.onerror = reject;
    document.head.appendChild(s);
  });
  return _gmapsPromise;
};

export default function MapaGeral() {
  const queryClient = useQueryClient();
  // ─── State ───
  const [mapReady, setMapReady] = useState(false);
  const [mapType, setMapType] = useState('satellite');
  const [showAreas, setShowAreas] = useState(true);
  const [showPontos, setShowPontos] = useState(true);
  const [showLinhas, setShowLinhas] = useState(true);
  const [showLotes, setShowLotes] = useState(true);
  const [showCochos, setShowCochos] = useState(true);
  const [showDepositos, setShowDepositos] = useState(true);
  const [showAlertas, setShowAlertas] = useState(true);
  const [showUserLocation, setShowUserLocation] = useState(false);
  const [showNomesAreas, setShowNomesAreas] = useState(true);
  const [showHectaresAreas, setShowHectaresAreas] = useState(true);
  const [userLocation, setUserLocation] = useState(null);

  // Filtros avançados
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [filtroIdentificador, setFiltroIdentificador] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroSistema, setFiltroSistema] = useState('todos');
  const [filtroAlertaTipo, setFiltroAlertaTipo] = useState('todos');
  const [filtroTipoCultura, setFiltroTipoCultura] = useState('todas');
  const [filtroTipoPastagem, setFiltroTipoPastagem] = useState('todas');
  const [filtroSetor, setFiltroSetor] = useState('todos');
  const [filtroPesoMin, setFiltroPesoMin] = useState(null);
  const [filtroPesoMax, setFiltroPesoMax] = useState(null);
  const [modoColoracao, setModoColoracao] = useState('padrao');

  // Painéis
  const [showDetalhesLote, setShowDetalhesLote] = useState(false);
  const [selectedLote, setSelectedLote] = useState(null);
  const [showDetalhesArea, setShowDetalhesArea] = useState(false);
  const [selectedArea, setSelectedArea] = useState(null);
  const [showDetalhesPontoSupl, setShowDetalhesPontoSupl] = useState(false);
  const [selectedPontoSupl, setSelectedPontoSupl] = useState(null);
  const [showDetalhesBebedouro, setShowDetalhesBebedouro] = useState(false);
  const [selectedBebedouro, setSelectedBebedouro] = useState(null);
  const [showTarefas, setShowTarefas] = useState(false);
  const [tarefasContext, setTarefasContext] = useState({});
  const [selectedTarefa, setSelectedTarefa] = useState(null);
  const [showDetalhesTarefa, setShowDetalhesTarefa] = useState(false);
  const [selecionandoLocalTarefa, setSelecionandoLocalTarefa] = useState(false);
  const [rascunhoTarefa, setRascunhoTarefa] = useState(null);
  const [showInsights, setShowInsights] = useState(false);
  const [showFiltros, setShowFiltros] = useState(false);
  const [showTaskIcons, setShowTaskIcons] = useState(true);
  const [dragLotesEnabled, setDragLotesEnabled] = useState(false);

  const empresaSelecionadaId = localStorage.getItem('empresa_selecionada_id');

  useEffect(() => {
    const saved = localStorage.getItem(`mapa_geral_filtros_${empresaSelecionadaId || 'default'}`) || localStorage.getItem('mapa_geral_filtros');
    if (!saved) return;
    const state = JSON.parse(saved);
    setMapType('satellite');
    if (typeof state.showAreas === 'boolean') setShowAreas(state.showAreas);
    if (typeof state.showPontos === 'boolean') setShowPontos(state.showPontos);
    if (typeof state.showLinhas === 'boolean') setShowLinhas(state.showLinhas);
    if (typeof state.showLotes === 'boolean') setShowLotes(state.showLotes);
    if (typeof state.showTaskIcons === 'boolean') setShowTaskIcons(state.showTaskIcons);
    if (typeof state.dragLotesEnabled === 'boolean') setDragLotesEnabled(state.dragLotesEnabled);
    if (typeof state.showCochos === 'boolean') setShowCochos(state.showCochos);
    if (typeof state.showDepositos === 'boolean') setShowDepositos(state.showDepositos);
    if (typeof state.showPontosSuplementacao === 'boolean') {
      setShowCochos(state.showPontosSuplementacao);
      setShowDepositos(state.showPontosSuplementacao);
    }
    if (typeof state.showAlertas === 'boolean') setShowAlertas(state.showAlertas);
    if (typeof state.showUserLocation === 'boolean') setShowUserLocation(state.showUserLocation);
    if (typeof state.showNomesAreas === 'boolean') setShowNomesAreas(state.showNomesAreas);
    if (typeof state.showHectaresAreas === 'boolean') setShowHectaresAreas(state.showHectaresAreas);
    if (typeof state.filtroCategoria === 'string') setFiltroCategoria(state.filtroCategoria);
    if (typeof state.filtroIdentificador === 'string') setFiltroIdentificador(state.filtroIdentificador);
    if (typeof state.filtroStatus === 'string') setFiltroStatus(state.filtroStatus);
    if (typeof state.filtroSistema === 'string') setFiltroSistema(state.filtroSistema);
    if (typeof state.filtroAlertaTipo === 'string') setFiltroAlertaTipo(state.filtroAlertaTipo);
    if (typeof state.filtroTipoCultura === 'string') setFiltroTipoCultura(state.filtroTipoCultura);
    if (typeof state.filtroTipoPastagem === 'string') setFiltroTipoPastagem(state.filtroTipoPastagem);
    if (typeof state.filtroSetor === 'string') setFiltroSetor(state.filtroSetor);
    setFiltroPesoMin(state.filtroPesoMin ?? null);
    setFiltroPesoMax(state.filtroPesoMax ?? null);
    if (typeof state.modoColoracao === 'string') setModoColoracao(state.modoColoracao);
  }, [empresaSelecionadaId]);

  useEffect(() => {
    localStorage.setItem(`mapa_geral_filtros_${empresaSelecionadaId || 'default'}`, JSON.stringify({
      mapType,
      showAreas,
      showPontos,
      showLinhas,
      showLotes,
      showTaskIcons,
      dragLotesEnabled,
      showCochos,
      showDepositos,
      showAlertas,
      showUserLocation,
      showNomesAreas,
      showHectaresAreas,
      filtroCategoria,
      filtroIdentificador,
      filtroStatus,
      filtroSistema,
      filtroAlertaTipo,
      filtroTipoCultura,
      filtroTipoPastagem,
      filtroSetor,
      filtroPesoMin,
      filtroPesoMax,
      modoColoracao
    }));
  }, [empresaSelecionadaId, mapType, showAreas, showPontos, showLinhas, showLotes, showTaskIcons, dragLotesEnabled, showCochos, showDepositos, showAlertas, showUserLocation, showNomesAreas, showHectaresAreas, filtroCategoria, filtroIdentificador, filtroStatus, filtroSistema, filtroAlertaTipo, filtroTipoCultura, filtroTipoPastagem, filtroSetor, filtroPesoMin, filtroPesoMax, modoColoracao]);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const projectionOverlayRef = useRef(null);
  const firstFitDoneRef = useRef(false);
  const mapViewRestoredRef = useRef(false);
  const longPressTimerRef = useRef(null);
  const longPressStartRef = useRef(null);
  const longPressTriggeredRef = useRef(false);
  const ignoreNextMapClickRef = useRef(false);
  const renderer = useMapRenderer(mapInstanceRef);

  const { setores } = useSetorAreas(empresaSelecionadaId);
  useEffect(() => {firstFitDoneRef.current = false;mapViewRestoredRef.current = false;}, [empresaSelecionadaId]);

  const { data: currentUser = null } = useQuery({
    queryKey: ['mapa-geral-user'],
    queryFn: async () => {
      if (navigator.onLine) {
        const me = await base44.auth.me();
        localStorage.setItem('offline_current_user', JSON.stringify(me));
        return me;
      }
      const cachedUser = localStorage.getItem('offline_current_user');
      return cachedUser ? JSON.parse(cachedUser) : null;
    },
    staleTime: 5 * 60 * 1000
  });

  const { data: permissoes = [] } = useQuery({
    queryKey: ['mapa-geral-permissoes'],
    queryFn: async () => {
      const cached = await getMapaCachedData('permissoes', '__GLOBAL__');
      if (!navigator.onLine && cached?.length) return cached;
      const fresh = await refreshMapaCacheEntry('permissoes', '__GLOBAL__');
      return fresh?.length ? fresh : cached || [];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const permissaoAtual = useMemo(() => {
    const registro = permissoes.find((item) => item.user_email === currentUser?.email) || null;
    return normalizePermissionRecord(registro);
  }, [permissoes, currentUser?.email]);

  const mapaGeralPermissions = useMemo(() => {
    if (currentUser?.role === 'admin' || permissaoAtual?.is_admin) {
      return normalizeMapaGeralPermissions({}, true);
    }

    return normalizeMapaGeralPermissions(
      permissaoAtual?.mapa_geral_permissoes,
      canAccessPage(permissaoAtual, 'pec-mapa-geral', 'pecuaria')
    );
  }, [currentUser?.role, permissaoAtual]);

  const podeUsarTarefasMapa = useMemo(() => {
    if (currentUser?.role === 'admin' || permissaoAtual?.is_admin) return mapaGeralPermissions.visualizar_tarefas;
    return mapaGeralPermissions.visualizar_tarefas && canAccessPage(permissaoAtual, 'gt-lancamentos', 'gestao-tarefas');
  }, [currentUser?.role, permissaoAtual, mapaGeralPermissions.visualizar_tarefas]);

  // ─── Queries ───
  const ST = 5 * 60 * 1000;
  const createMapaQuery = (cacheKey, options = {}) => ({
    queryKey: ['mapa-cache', cacheKey, empresaSelecionadaId, options.enabledKey || 'default'],
    queryFn: async () => {
      const cacheEmpresa = cacheKey === 'icones' || cacheKey === 'permissoes' ? '__GLOBAL__' : empresaSelecionadaId;
      const cached = await getMapaCachedData(cacheKey, cacheEmpresa);

      if (navigator.onLine) {
        if (cached?.length) {
          refreshMapaCacheEntry(cacheKey, cacheEmpresa).then((fresh) => {
            queryClient.setQueryData(['mapa-cache', cacheKey, empresaSelecionadaId, options.enabledKey || 'default'], fresh || []);
          }).catch(() => {});
          return cached;
        }
        return await refreshMapaCacheEntry(cacheKey, cacheEmpresa);
      }

      return cached || [];
    },
    enabled: Boolean(options.enabled ?? !!empresaSelecionadaId),
    staleTime: options.staleTime ?? ST,
    refetchOnWindowFocus: false,
    placeholderData: []
  });

  const { data: areasBase = [], refetch: refetchAreas } = useQuery(createMapaQuery('areas'));
  const { data: pontos = [], refetch: refetchPontosRef } = useQuery(createMapaQuery('pontos'));
  const { data: bebedouros = [] } = useBebedouros(empresaSelecionadaId);
  const { data: pontosSuplementacao = [], refetch: refetchPontosSupl } = useQuery(createMapaQuery('pontosSuplementacao'));
  const { data: linhas = [] } = useQuery(createMapaQuery('linhas'));
  const { data: lotesBase = [], refetch: refetchLotes } = useQuery(createMapaQuery('lotes', { staleTime: 60 * 1000 }));
  const { data: iconesConfig = [] } = useQuery(createMapaQuery('icones', { enabled: true, staleTime: 10 * 60 * 1000 }));

  useEffect(() => {
    iconesConfig.forEach((icone) => {
      [icone.icone_url, icone.sub_icone_url].filter(Boolean).forEach((url) => {
        const image = new Image();
        image.src = url;
      });
    });
  }, [iconesConfig]);

  const { data: eventosSupl = [], refetch: refetchEventosSupl } = useQuery(createMapaQuery('eventosSuplementacao'));
  const { data: estoqueLotes = [], refetch: refetchEstoqueLotes } = useQuery(createMapaQuery('estoqueLotes'));
  const { data: produtos = [] } = useQuery(createMapaQuery('produtos'));
  const { data: tarefasMapa = [], refetch: refetchTarefas } = useQuery(createMapaQuery('tarefas', { enabled: !!empresaSelecionadaId && podeUsarTarefasMapa, enabledKey: podeUsarTarefasMapa ? 'on' : 'off' }));

  const areas = useMemo(() => {
    return areasBase.filter((area) => area?.empresa_id === empresaSelecionadaId && area?.ativo !== false);
  }, [areasBase, empresaSelecionadaId]);

  const areaIdsValidos = useMemo(() => new Set(areas.map((area) => area.id)), [areas]);

  const lotes = useMemo(() => {
    return lotesBase.filter((lote) =>
    lote?.empresa_id === empresaSelecionadaId &&
    lote?.status === 'Ativo' &&
    lote?.area_atual_id &&
    areaIdsValidos.has(lote.area_atual_id)
    );
  }, [lotesBase, empresaSelecionadaId, areaIdsValidos]);

  // Movimentações para calcular situação do pasto
  const { data: movimentacoes = [], refetch: refetchMovimentacoes } = useQuery(createMapaQuery('movimentacoes', { enabled: !!empresaSelecionadaId && modoColoracao === 'situacao_pasto', enabledKey: modoColoracao }));

  // ─── Dados derivados ───
  const alertasMapa = useMemo(() => buildMapaAlertasSuplementacao({
    lotes,
    pontosSuplementacao,
    eventosSupl,
    estoqueLotes,
    produtos
  }), [lotes, pontosSuplementacao, eventosSupl, estoqueLotes, produtos]);

  const lotesComAlerta = useMemo(() => lotes.map((lote) => {
    const alertas = [...(alertasMapa.alertasLote.get(lote.id) || [])];
    if (lote.peso_medio_kg && lote.peso_medio_kg < 50 && (lote.categoria?.includes('Bezerr') || lote.categoria?.includes('0 a 12')))
    alertas.push({ tipo: 'peso_baixo', peso: lote.peso_medio_kg });
    return { ...lote, alertas };
  }), [lotes, alertasMapa]);

  const categorias = useMemo(() => [...new Set(lotes.map((l) => l.categoria).filter(Boolean))].sort(), [lotes]);
  const identificadores = useMemo(() => [...new Set(lotes.map((l) => l.identificador_nome || l.identificador_sigla).filter(Boolean))].sort(), [lotes]);
  const tiposPastagem = useMemo(() => [...new Set(areas.map((a) => a.tipo_pastagem).filter(Boolean))].sort(), [areas]);
  const sistemasProdutivos = useMemo(() => [...new Set(lotes.map((l) => l.sistema_produtivo).filter(Boolean))].sort(), [lotes]);

  const pontosSuplementacaoDecorados = useMemo(() => {
    return pontosSuplementacao.map((ponto) => {
      const indicadorBase = normalizeText(ponto.categoria_ponto || 'COCHO') === 'DEPOSITO' ?
      getDepositoIndicator(ponto, pontosSuplementacao, lotes, estoqueLotes, []) :
      getCochoIndicator(ponto, eventosSupl);
      const alertaInfo = alertasMapa.alertasPonto.get(ponto.id);
      const alertaPrincipal = alertaInfo?.alertas?.[0] || null;

      return {
        ...ponto,
        indicador_percentual: indicadorBase.percent,
        indicador_helper: showAlertas ? alertaPrincipal?.descricao || indicadorBase.helperLabel : indicadorBase.helperLabel,
        ultimo_registro: indicadorBase.latestRecord,
        alertas_inteligentes: showAlertas ? alertaInfo?.alertas || [] : []
      };
    });
  }, [pontosSuplementacao, lotes, estoqueLotes, eventosSupl, alertasMapa, showAlertas]);

  // Filtrar áreas
  const areasFiltradas = useMemo(() => areas.filter((a) => {
    if (filtroSetor !== 'todos' && a.setor_id !== filtroSetor) return false;
    if (filtroTipoCultura !== 'todas' && a.tipo_cultura !== filtroTipoCultura) return false;
    if (filtroTipoPastagem !== 'todas' && a.tipo_pastagem !== filtroTipoPastagem) return false;
    return true;
  }), [areas, filtroSetor, filtroTipoCultura, filtroTipoPastagem]);

  const areaIdsFiltrados = useMemo(() => new Set(areasFiltradas.map((area) => area.id)), [areasFiltradas]);

  // Filtrar lotes
  const lotesFiltrados = useMemo(() => lotesComAlerta.filter((lote) => {
    if (filtroSetor !== 'todos' && !areaIdsFiltrados.has(lote.area_atual_id)) return false;
    if (filtroCategoria !== 'todas' && lote.categoria !== filtroCategoria) return false;
    const identificadorLote = lote.identificador_nome || lote.identificador_sigla || '';
    if (filtroIdentificador !== 'todos' && identificadorLote !== filtroIdentificador) return false;
    if (showAlertas && filtroStatus === 'com_alerta' && lote.alertas.length === 0) return false;
    if (showAlertas && filtroStatus === 'sem_alerta' && lote.alertas.length > 0) return false;
    if (showAlertas && filtroAlertaTipo !== 'todos' && !lote.alertas.some((alerta) => alerta.tipo === filtroAlertaTipo)) return false;
    if (filtroSistema !== 'todos' && lote.sistema_produtivo !== filtroSistema) return false;
    if (filtroPesoMin && (!lote.peso_medio_kg || lote.peso_medio_kg < filtroPesoMin)) return false;
    if (filtroPesoMax && lote.peso_medio_kg && lote.peso_medio_kg > filtroPesoMax) return false;
    return true;
  }), [lotesComAlerta, filtroSetor, areaIdsFiltrados, filtroCategoria, filtroIdentificador, filtroStatus, filtroAlertaTipo, filtroSistema, filtroPesoMin, filtroPesoMax, showAlertas]);

  const pontosSuplementacaoFiltrados = useMemo(() => {
    if (filtroSetor === 'todos') return pontosSuplementacaoDecorados;
    return pontosSuplementacaoDecorados.filter((ponto) => {
      const areaIds = Array.isArray(ponto.area_vinculada_ids) && ponto.area_vinculada_ids.length ?
      ponto.area_vinculada_ids :
      ponto.area_vinculada_id ?
      [ponto.area_vinculada_id] :
      [];
      return areaIds.some((id) => areaIdsFiltrados.has(id));
    });
  }, [filtroSetor, pontosSuplementacaoDecorados, areaIdsFiltrados]);

  const cochosFiltrados = useMemo(() => {
    return pontosSuplementacaoFiltrados.filter((ponto) => normalizeText(ponto.categoria_ponto || 'COCHO') !== 'DEPOSITO');
  }, [pontosSuplementacaoFiltrados]);

  const depositosFiltrados = useMemo(() => {
    return pontosSuplementacaoFiltrados.filter((ponto) => normalizeText(ponto.categoria_ponto || '') === 'DEPOSITO');
  }, [pontosSuplementacaoFiltrados]);

  const tarefasMapaFiltradas = useMemo(() => {
    if (filtroSetor === 'todos') return tarefasMapa;
    const setorAtual = setores.find((setor) => setor.id === filtroSetor);
    return tarefasMapa.filter((tarefa) => areaIdsFiltrados.has(tarefa.area_id) || tarefa.setor_nome === setorAtual?.nome);
  }, [filtroSetor, tarefasMapa, setores, areaIdsFiltrados]);

  // Mapa de cores para categorias de manejo e pastagem
  const categoriasGadoCores = useMemo(() => {
    const m = {};
    categorias.forEach((c, i) => {m[c] = CORES_CATEGORIA_GADO[i % CORES_CATEGORIA_GADO.length];});
    return m;
  }, [categorias]);

  const tiposPastagemCores = useMemo(() => {
    const m = {};
    tiposPastagem.forEach((t, i) => {m[t] = CORES_CATEGORIA_GADO[i % CORES_CATEGORIA_GADO.length];});
    return m;
  }, [tiposPastagem]);

  // Calcular UA por área (1 UA = 450 kg PV - padrão Embrapa)
  // Usa ÁREA EFETIVA (area_pastejada) para cálculo de UA/ha, não área total
  const uaPorAreaMap = useMemo(() => {
    const m = {};
    lotes.forEach((l) => {
      if (!l.area_atual_id) return;
      if (!m[l.area_atual_id]) m[l.area_atual_id] = { ua: 0, cabecas: 0 };
      const peso = l.peso_medio_kg || 0;
      const cab = l.quantidade_cabecas || 0;
      m[l.area_atual_id].ua += peso * cab / 450;
      m[l.area_atual_id].cabecas += cab;
    });
    return m;
  }, [lotes]);

  // Helper: retorna área efetiva (pastejada) se disponível, senão área total
  const getAreaEfetiva = useCallback((area) => {
    const pastejada = area.area_pastejada;
    if (pastejada && pastejada > 0) return pastejada;
    return area.tamanho_hectares || 0;
  }, []);

  // Calcular situação do pasto (ocupado com dias, ou vazio em descanso)
  const situacaoPastoMap = useMemo(() => {
    const m = {};
    const agora = new Date();
    areas.forEach((a) => {
      const lotesNaArea = lotes.filter((l) => l.area_atual_id === a.id);
      if (lotesNaArea.length > 0) {
        // Área COM animais: calcular dias desde a data_entrada mais antiga
        const datasEntrada = lotesNaArea.map((l) => l.data_entrada ? new Date(l.data_entrada) : agora).filter((d) => !isNaN(d));
        const maisAntiga = datasEntrada.length > 0 ? new Date(Math.min(...datasEntrada)) : agora;
        const dias = Math.max(0, Math.floor((agora - maisAntiga) / 86400000));
        m[a.id] = { tipo: 'ocupado', dias };
      } else {
        // Área SEM animais: verificar última movimentação de saída desta área
        const movsSaida = movimentacoes.filter((mv) => mv.area_origem_id === a.id && mv.tipo === 'Transferência de Área');
        if (movsSaida.length > 0) {
          const ultimaSaida = new Date(movsSaida[0].data_movimentacao);
          const diasSem = Math.max(0, Math.floor((agora - ultimaSaida) / 86400000));
          m[a.id] = { tipo: 'descanso', dias: diasSem };
        } else {
          m[a.id] = { tipo: 'vazia', dias: null };
        }
      }
    });
    return m;
  }, [areas, lotes, movimentacoes]);

  // Função de cor para áreas baseada no modo de coloração
  const getAreaColor = useCallback((area) => {
    if (modoColoracao === 'tipo_cultura') return CORES_TIPO_CULTURA[area.tipo_cultura] || '#94a3b8';
    if (modoColoracao === 'aproveitamento') return CORES_APROVEITAMENTO[area.aproveitamento_classificacao] || '#94a3b8';
    if (modoColoracao === 'ocupacao') return CORES_OCUPACAO[area.status_ocupacao] || '#94a3b8';
    if (modoColoracao === 'tipo_pastagem') return tiposPastagemCores[area.tipo_pastagem] || '#94a3b8';
    if (modoColoracao === 'categoria_gado') {
      const lotesNaArea = lotes.filter((l) => l.area_atual_id === area.id);
      if (lotesNaArea.length === 0) return '#d1d5db';
      const cat = lotesNaArea[0].categoria;
      return categoriasGadoCores[cat] || '#94a3b8';
    }
    if (modoColoracao === 'ua_ha') {
      const info = uaPorAreaMap[area.id];
      const ha = getAreaEfetiva(area); // Usa área efetiva!
      if (!info || info.ua === 0) return '#d1d5db'; // sem gado
      if (ha <= 0) return '#94a3b8';
      const uaHa = info.ua / ha;
      // Faixas baseadas em Embrapa/Scot (pastagem tropical, ~20% margem)
      if (uaHa < 0.8) return '#86efac'; // sublotação
      if (uaHa < 1.2) return '#22c55e'; // moderada
      if (uaHa < 1.8) return '#3b82f6'; // ideal
      if (uaHa < 2.4) return '#f59e0b'; // alta (até 20% acima)
      return '#ef4444'; // superlotação
    }
    if (modoColoracao === 'situacao_pasto') {
      const info = situacaoPastoMap[area.id];
      if (!info) return '#d1d5db';
      if (info.tipo === 'vazia') return '#d1d5db'; // sem histórico
      if (info.tipo === 'descanso') return '#86efac'; // em descanso
      // Ocupado
      if (info.dias <= 45) return '#3b82f6'; // normal
      if (info.dias <= 90) return '#f59e0b'; // atenção
      return '#ef4444'; // crítico
    }
    return null; // padrao: usar cor da área
  }, [modoColoracao, lotes, categoriasGadoCores, tiposPastagemCores, uaPorAreaMap, situacaoPastoMap, getAreaEfetiva]);

  // ─── Inicializar Mapa ───
  useEffect(() => {
    loadGoogleMapsScript().then(() => {
      if (!mapRef.current || mapInstanceRef.current) return;
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const initialMapType = 'satellite';

      const map = new google.maps.Map(mapRef.current, {
        center: { lat: -15.0067, lng: -59.9533 }, zoom: 15, mapTypeId: initialMapType,
        mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
        gestureHandling: 'greedy',
        zoomControl: !mobile, disableDefaultUI: mobile, clickableIcons: false,
        minZoom: 3, maxZoom: 22
      });
      const overlay = new google.maps.OverlayView();
      overlay.onAdd = function () {};
      overlay.draw = function () {};
      overlay.onRemove = function () {};
      overlay.setMap(map);
      projectionOverlayRef.current = overlay;
      mapInstanceRef.current = map;
      setMapType(initialMapType);
      google.maps.event.addListenerOnce(map, 'idle', () => setMapReady(true));
    }).catch(() => toast.error('Erro ao carregar mapa.'));
    return () => renderer.clearAll();
  }, []);

  useEffect(() => {if (mapInstanceRef.current) mapInstanceRef.current.setMapTypeId(mapType);}, [mapType]);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const persistView = () => {
      const center = map.getCenter();
      if (!center) return;
      localStorage.setItem(`mapa_geral_view_${empresaSelecionadaId || 'default'}`, JSON.stringify({
        center: { lat: center.lat(), lng: center.lng() },
        zoom: map.getZoom()
      }));
    };
    const idleListener = map.addListener('idle', persistView);
    return () => idleListener?.remove();
  }, [mapReady, empresaSelecionadaId]);

  // Fit bounds 1x
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady || !areas.length || firstFitDoneRef.current) return;

    const savedView = localStorage.getItem(`mapa_geral_view_${empresaSelecionadaId || 'default'}`);
    if (savedView && !mapViewRestoredRef.current) {
      try {
        const parsed = JSON.parse(savedView);
        if (parsed?.center && typeof parsed?.zoom === 'number') {
          mapInstanceRef.current.setCenter(parsed.center);
          mapInstanceRef.current.setZoom(parsed.zoom);
          firstFitDoneRef.current = true;
          mapViewRestoredRef.current = true;
          return;
        }
      } catch {}
    }

    const b = new google.maps.LatLngBounds();
    let ok = false;
    areas.forEach((a) => (a.coordenadas?.coords || []).forEach((c) => {
      const lat = c[0] || c.lat,lng = c[1] || c.lng;
      if (typeof lat === 'number' && typeof lng === 'number' && isFinite(lat) && isFinite(lng)) {b.extend({ lat, lng });ok = true;}
    }));
    if (ok) {mapInstanceRef.current.fitBounds(b, { padding: 50 });firstFitDoneRef.current = true;}
  }, [areas, mapReady, empresaSelecionadaId]);

  // ─── Handlers ───
  const detectarAreaPorCoordenada = useCallback((coords) => {
    for (const area of areas) {
      const pontosArea = area.coordenadas?.coords || [];
      if (pontosArea.length < 3) continue;
      const polygon = pontosArea.map((coord) => ({ lat: coord[0] || coord.lat, lng: coord[1] || coord.lng }));
      if (ptInPoly(coords, polygon)) return area;
    }
    return null;
  }, [areas]);

  const abrirLancamentoTarefa = useCallback((coords = null, draft = {}) => {
    if (!podeUsarTarefasMapa) return;
    const areaDetectada = coords ? detectarAreaPorCoordenada(coords) : null;
    const draftCompleto = {
      ...draft,
      area_id: areaDetectada?.id || draft.area_id || "",
      area_nome: areaDetectada?.nome || draft.area_nome || "",
      coordenadas: coords || draft.coordenadas || null
    };
    setTarefasContext({
      areaId: draftCompleto.area_id || undefined,
      areaNome: draftCompleto.area_nome || undefined,
      loteId: draftCompleto.lote_id || undefined,
      loteNome: draftCompleto.lote_nome || undefined,
      initialCoordinates: draftCompleto.coordenadas || null,
      initialDraft: draftCompleto,
      openCreateOnMount: true
    });
    setShowTarefas(true);
  }, [detectarAreaPorCoordenada, podeUsarTarefasMapa]);

  const handleSelectTaskLocation = useCallback((coords, area) => {
    setSelecionandoLocalTarefa(false);
    const draft = rascunhoTarefa || {};
    setRascunhoTarefa(null);
    abrirLancamentoTarefa(coords || draft.coordenadas || null, {
      ...draft,
      area_id: area?.id || "",
      area_nome: area?.nome || ""
    });
  }, [rascunhoTarefa, abrirLancamentoTarefa]);

  const handleClickArea = useCallback((area, coords) => {
    if (selecionandoLocalTarefa) {
      handleSelectTaskLocation(coords, area);
      return;
    }

    const isCurral = area?.tipo_cultura === 'Infraestrutura' && String(area?.tipo_infraestrutura || area?.tipo_pastagem || '').trim().toLowerCase() === 'curral';
    if (!isCurral) return;

    setSelectedArea(area);
    setShowDetalhesArea(true);
  }, [selecionandoLocalTarefa, handleSelectTaskLocation]);

  const handleRightClickArea = useCallback((area, coords) => {
    if (selecionandoLocalTarefa) {
      handleSelectTaskLocation(coords, area);
    }
  }, [selecionandoLocalTarefa, handleSelectTaskLocation]);

  const handleClickPontoSupl = useCallback((p) => {
    if (!mapaGeralPermissions.visualizar_detalhes_cochos) return;
    setSelectedPontoSupl(p);
    setShowDetalhesPontoSupl(true);
  }, [mapaGeralPermissions.visualizar_detalhes_cochos]);

  const handleClickPontoReferencia = useCallback(async (ponto) => {
    if (!normalizeText(ponto?.tipo).includes("BEBEDOURO")) return;

    const listaBebedouros = navigator.onLine ? await base44.entities.Bebedouro.list("-updated_date") : bebedouros;
    const bebedourosEmpresa = listaBebedouros.filter((item) => item.empresa_id === empresaSelecionadaId && item.ativo !== false);
    const pontoNumero = normalizeText(ponto.numero_ponto);
    const pontoNome = normalizeText(ponto.nome);
    const pontoSigla = normalizeText(ponto.sigla);
    const pontoCoords = ponto.coordenadas || {};

    const sameCoords = (coords = {}) => {
      if (!pontoCoords.lat || !pontoCoords.lng || !coords.lat || !coords.lng) return false;
      return Math.abs(Number(coords.lat) - Number(pontoCoords.lat)) < 0.00002 && Math.abs(Number(coords.lng) - Number(pontoCoords.lng)) < 0.00002;
    };

    const bebedouro = bebedourosEmpresa.find((item) => {
      const itemNome = normalizeText(item.nome);
      const itemCodigo = normalizeText(item.codigo_interno);
      return item.id === ponto.bebedouro_id ||
        item.ponto_referencia_id === ponto.id ||
        sameCoords(item.coordenadas) ||
        (pontoNome && itemNome === pontoNome) ||
        (itemCodigo && pontoSigla && itemCodigo === pontoSigla) ||
        (itemCodigo && pontoNumero && itemCodigo === pontoNumero) ||
        (itemCodigo && pontoNome.includes(itemCodigo)) ||
        (pontoSigla && itemNome.includes(pontoSigla)) ||
        (pontoNumero && itemNome.includes(pontoNumero));
    });

    setSelectedBebedouro(bebedouro || {
      empresa_id: ponto.empresa_id,
      ponto_referencia_id: ponto.id,
      numero_ponto: ponto.numero_ponto,
      nome: ponto.nome,
      codigo_interno: ponto.sigla || ponto.numero_ponto,
      tipo: ponto.tipo,
      coordenadas: ponto.coordenadas,
      origem_agua: ponto.origem_agua || "-",
      status: ponto.status || "Ativo",
      observacoes: ponto.observacoes || "",
      pasto_nome: ponto.area_vinculada_nome || "",
      area_vinculada_nomes: ponto.area_vinculada_nomes || []
    });
    setShowDetalhesBebedouro(true);
  }, [bebedouros, empresaSelecionadaId]);

  const handleClickLotes = useCallback((l) => {
    if (!mapaGeralPermissions.visualizar_detalhes_lotes) return;
    setSelectedLote(l);
    setShowDetalhesLote(true);
  }, [mapaGeralPermissions.visualizar_detalhes_lotes]);

  const handleClickTarefa = useCallback((t) => {setSelectedTarefa(t);setShowDetalhesTarefa(true);}, []);

  const handleDragLotes = useCallback((newPos, lotesNaArea, areaId, allAreas) => {
    if (!mapaGeralPermissions.mover_lotes) return;
    const orig = allAreas.find((a) => a.id === areaId);
    if (orig) {const ps = orig.coordenadas.coords.map((c) => ({ lat: c[0] || c.lat, lng: c[1] || c.lng }));if (ptInPoly(newPos, ps)) {toast.error('Arraste para outra área');return;}}
    let dest = null;
    for (const a of allAreas) {if (a.id === areaId || !a.coordenadas?.coords || a.coordenadas.coords.length < 3) continue;if (ptInPoly(newPos, a.coordenadas.coords.map((c) => ({ lat: c[0] || c.lat, lng: c[1] || c.lng })))) {dest = a;break;}}
    if (dest) {setSelectedLote(lotesNaArea);setShowDetalhesLote(true);queueMicrotask(() => window.dispatchEvent(new CustomEvent('open-movimentacao', { detail: { areaDestinoId: dest.id } })));} else
    toast.error('Solte sobre outra área');
  }, [mapaGeralPermissions.mover_lotes, dragLotesEnabled]);

  const executarRefreshMapa = useCallback(async (showToast = true, force = false, cacheKeys = null) => {
    await queryClient.invalidateQueries({ queryKey: ['mapa-cache'] });

    const refreshOptions = force ? { force: true } : {};
    const keysToRefresh = cacheKeys?.length ? cacheKeys : ['lotes', 'areas', 'eventosSuplementacao', 'pontosSuplementacao', 'pontos', 'estoqueLotes'];
    const refreshTasks = keysToRefresh.map((key) => refreshMapaCacheEntry(key, empresaSelecionadaId, refreshOptions));

    if (modoColoracao === 'situacao_pasto' && !keysToRefresh.includes('movimentacoes')) refreshTasks.push(refreshMapaCacheEntry('movimentacoes', empresaSelecionadaId, refreshOptions));
    if (podeUsarTarefasMapa && !keysToRefresh.includes('tarefas') && !cacheKeys?.length) refreshTasks.push(refreshMapaCacheEntry('tarefas', empresaSelecionadaId, refreshOptions));
    await Promise.all(refreshTasks);

    const refetchTasks = [];
    if (keysToRefresh.includes('lotes')) refetchTasks.push(refetchLotes());
    if (keysToRefresh.includes('areas')) refetchTasks.push(refetchAreas());
    if (keysToRefresh.includes('eventosSuplementacao')) refetchTasks.push(refetchEventosSupl());
    if (keysToRefresh.includes('pontosSuplementacao')) refetchTasks.push(refetchPontosSupl());
    if (keysToRefresh.includes('pontos')) refetchTasks.push(refetchPontosRef());
    if (keysToRefresh.includes('estoqueLotes')) refetchTasks.push(refetchEstoqueLotes());
    await Promise.all(refetchTasks);
    if (modoColoracao === 'situacao_pasto') await refetchMovimentacoes();
    if (podeUsarTarefasMapa && (!cacheKeys?.length || keysToRefresh.includes('tarefas'))) await refetchTarefas();
    if (showToast) toast.success('Mapa atualizado');
  }, [empresaSelecionadaId, modoColoracao, podeUsarTarefasMapa, queryClient, refetchAreas, refetchEstoqueLotes, refetchEventosSupl, refetchLotes, refetchMovimentacoes, refetchPontosRef, refetchPontosSupl, refetchTarefas]);

  const handleRefresh = useCallback(async () => {
    await executarRefreshMapa(true, true);
  }, [executarRefreshMapa]);

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };setUserLocation(loc);setShowUserLocation(true);if (mapInstanceRef.current) {mapInstanceRef.current.setCenter(loc);mapInstanceRef.current.setZoom(18);}},
      () => toast.error('Erro ao obter localização')
    );
  }, []);

  const handleRequestSelectTaskLocation = useCallback((draft) => {
    if (!podeUsarTarefasMapa) return;
    setShowTarefas(false);
    setShowDetalhesTarefa(false);
    setSelecionandoLocalTarefa(true);
    setRascunhoTarefa(draft);
    toast.info('Toque no mapa para marcar o local da tarefa.');
  }, [podeUsarTarefasMapa]);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !mapRef.current || !projectionOverlayRef.current) return;
    const map = mapInstanceRef.current;
    const mapElement = mapRef.current;

    const clearLongPress = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };

    const getPointFromEvent = (event) => {
      if (event?.touches?.[0]) {
        return { x: event.touches[0].clientX, y: event.touches[0].clientY };
      }
      if (event?.changedTouches?.[0]) {
        return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
      }
      if (typeof event?.clientX === 'number' && typeof event?.clientY === 'number') {
        return { x: event.clientX, y: event.clientY };
      }
      return null;
    };

    const getCoordsFromPoint = (point) => {
      const projection = projectionOverlayRef.current?.getProjection?.();
      if (!projection || !point) return null;
      const rect = mapElement.getBoundingClientRect();
      const pixel = new google.maps.Point(point.x - rect.left, point.y - rect.top);
      const latLng = projection.fromContainerPixelToLatLng(pixel);
      if (!latLng) return null;
      return { lat: latLng.lat(), lng: latLng.lng() };
    };

    const handlePressStart = (event) => {
      if (!podeUsarTarefasMapa || selecionandoLocalTarefa) return;
      const point = getPointFromEvent(event);
      if (!point) return;
      longPressStartRef.current = point;
      longPressTriggeredRef.current = false;
      clearLongPress();
      longPressTimerRef.current = setTimeout(() => {
        const coords = getCoordsFromPoint(point);
        if (!coords) return;
        longPressTriggeredRef.current = true;
        ignoreNextMapClickRef.current = true;
        abrirLancamentoTarefa(coords);
      }, 550);
    };

    const handlePressMove = (event) => {
      if (!longPressStartRef.current) return;
      const point = getPointFromEvent(event);
      if (!point) return;
      const moved = Math.abs(point.x - longPressStartRef.current.x) > 10 || Math.abs(point.y - longPressStartRef.current.y) > 10;
      if (moved) clearLongPress();
    };

    const handlePressEnd = () => {
      clearLongPress();
      longPressStartRef.current = null;
      if (longPressTriggeredRef.current) {
        window.setTimeout(() => {
          ignoreNextMapClickRef.current = false;
        }, 350);
      }
    };

    mapElement.addEventListener('mousedown', handlePressStart);
    mapElement.addEventListener('mousemove', handlePressMove);
    mapElement.addEventListener('mouseup', handlePressEnd);
    mapElement.addEventListener('mouseleave', handlePressEnd);
    mapElement.addEventListener('touchstart', handlePressStart, { passive: true });
    mapElement.addEventListener('touchmove', handlePressMove, { passive: true });
    mapElement.addEventListener('touchend', handlePressEnd);
    mapElement.addEventListener('touchcancel', handlePressEnd);

    const listeners = [
    map.addListener('rightclick', (event) => {
      if (!podeUsarTarefasMapa || selecionandoLocalTarefa || !event?.latLng) return;
      abrirLancamentoTarefa({ lat: event.latLng.lat(), lng: event.latLng.lng() });
    }),
    map.addListener('click', (event) => {
      clearLongPress();
      if (ignoreNextMapClickRef.current) {
        ignoreNextMapClickRef.current = false;
        return;
      }
      if (!selecionandoLocalTarefa || !event?.latLng) return;
      const coords = { lat: event.latLng.lat(), lng: event.latLng.lng() };
      handleSelectTaskLocation(coords, detectarAreaPorCoordenada(coords));
    })];


    return () => {
      handlePressEnd();
      mapElement.removeEventListener('mousedown', handlePressStart);
      mapElement.removeEventListener('mousemove', handlePressMove);
      mapElement.removeEventListener('mouseup', handlePressEnd);
      mapElement.removeEventListener('mouseleave', handlePressEnd);
      mapElement.removeEventListener('touchstart', handlePressStart);
      mapElement.removeEventListener('touchmove', handlePressMove);
      mapElement.removeEventListener('touchend', handlePressEnd);
      mapElement.removeEventListener('touchcancel', handlePressEnd);
      listeners.forEach((listener) => listener?.remove());
    };
  }, [mapReady, selecionandoLocalTarefa, abrirLancamentoTarefa, handleSelectTaskLocation, detectarAreaPorCoordenada, podeUsarTarefasMapa]);

  // ─── Renderização incremental ───
  useEffect(() => {if (mapReady) renderer.syncAreas(areasFiltradas, mapaGeralPermissions.visualizar_areas && showAreas, handleClickArea, handleRightClickArea, getAreaColor);}, [areasFiltradas, showAreas, mapReady, getAreaColor, handleClickArea, handleRightClickArea, mapaGeralPermissions.visualizar_areas]);
  // Função de texto extra para labels (UA/ha ou situação do pasto)
  const getLabelExtraText = useCallback((area) => {
    if (modoColoracao === 'ua_ha') {
      const info = uaPorAreaMap[area.id];
      if (!info || info.ua === 0) return null;
      const ha = getAreaEfetiva(area); // Usa área efetiva!
      const uaStr = info.ua.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      if (ha > 0) {
        const uaHa = (info.ua / ha).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return `${uaStr} UA (${uaHa}/ha)`;
      }
      return `${uaStr} UA`;
    }
    if (modoColoracao === 'situacao_pasto') {
      const info = situacaoPastoMap[area.id];
      if (!info) return null;
      if (info.tipo === 'vazia') return 'Sem gado';
      if (info.tipo === 'descanso') return `Descanso ${info.dias}d`;
      return `Ocupado ${info.dias}d`;
    }
    return null;
  }, [modoColoracao, uaPorAreaMap, situacaoPastoMap, getAreaEfetiva]);

  useEffect(() => {
    if (!mapReady) return;
    renderer.syncLabels(
      areasFiltradas,
      mapaGeralPermissions.visualizar_areas && mapaGeralPermissions.visualizar_nomes_areas && showNomesAreas && showAreas,
      modoColoracao === 'ua_ha' || modoColoracao === 'situacao_pasto' ? getLabelExtraText : null,
      showHectaresAreas
    );
  }, [areasFiltradas, showNomesAreas, showAreas, showHectaresAreas, mapReady, modoColoracao, getLabelExtraText, mapaGeralPermissions.visualizar_areas, mapaGeralPermissions.visualizar_nomes_areas]);
  // Filtrar pontos de referência: ocultar tipo "Cocho" quando cochos/suplementação estão ocultos
  const pontosFiltrados = useMemo(() => {
    return pontos.filter((p) => {
      const tipo = (p.tipo || '').toUpperCase().trim();
      return tipo !== 'COCHO' && tipo !== 'COCHOS' && tipo !== 'DEPOSITO' && tipo !== 'DEPÓSITO';
    });
  }, [pontos]);

  useEffect(() => {if (mapReady) renderer.syncPontos(pontosFiltrados, mapaGeralPermissions.visualizar_pontos_referencia && showPontos, iconesConfig, handleClickPontoReferencia);}, [pontosFiltrados, showPontos, iconesConfig, mapReady, mapaGeralPermissions.visualizar_pontos_referencia, handleClickPontoReferencia]);
  useEffect(() => {if (mapReady) renderer.syncLinhas(linhas, mapaGeralPermissions.visualizar_linhas && showLinhas);}, [linhas, showLinhas, mapReady, mapaGeralPermissions.visualizar_linhas]);
  useEffect(() => {
    if (!mapReady) return;
    const pontosVisiveis = [
    ...(showCochos ? cochosFiltrados : []),
    ...(showDepositos ? depositosFiltrados : [])];

    renderer.syncPontosSuplementacao(pontosVisiveis, mapaGeralPermissions.visualizar_cochos_suplementacao && (showCochos || showDepositos), iconesConfig, handleClickPontoSupl);
  }, [cochosFiltrados, depositosFiltrados, showCochos, showDepositos, iconesConfig, mapReady, mapaGeralPermissions.visualizar_cochos_suplementacao, handleClickPontoSupl]);
  useEffect(() => {if (mapReady) renderer.syncLotes(lotesFiltrados, areas, mapaGeralPermissions.visualizar_lotes && showLotes, iconesConfig, handleClickLotes, handleDragLotes, mapaGeralPermissions.mover_lotes && dragLotesEnabled, showAlertas && filtroStatus === 'com_alerta');}, [lotesFiltrados, areas, showLotes, iconesConfig, mapReady, mapaGeralPermissions.visualizar_lotes, mapaGeralPermissions.mover_lotes, dragLotesEnabled, showAlertas, filtroStatus, handleClickLotes, handleDragLotes]);
  useEffect(() => {if (mapReady) renderer.syncTarefas(podeUsarTarefasMapa && showTaskIcons ? tarefasMapaFiltradas : [], areas, iconesConfig, handleClickTarefa);}, [tarefasMapaFiltradas, areas, iconesConfig, mapReady, podeUsarTarefasMapa, showTaskIcons, handleClickTarefa]);
  useEffect(() => {if (mapReady) renderer.syncUserLocation(userLocation, mapaGeralPermissions.visualizar_localizacao && showUserLocation);}, [userLocation, showUserLocation, mapReady, mapaGeralPermissions.visualizar_localizacao]);

  useEffect(() => {
    const h = async (event) => {
      await executarRefreshMapa(false, true, event?.detail?.cacheKeys || null);
    };
    window.addEventListener('atualizar-mapa', h);
    return () => window.removeEventListener('atualizar-mapa', h);
  }, [executarRefreshMapa]);

  useEffect(() => {
    if (!empresaSelecionadaId) return;
    const hasAreasCache = !!queryClient.getQueryData(['mapa-cache', 'areas', empresaSelecionadaId, 'default']);
    const hasLotesCache = !!queryClient.getQueryData(['mapa-cache', 'lotes', empresaSelecionadaId, 'default']);
    if (!hasAreasCache && !hasLotesCache) {
      executarRefreshMapa(false);
    }
  }, [empresaSelecionadaId, executarRefreshMapa, queryClient]);

  useEffect(() => {
    if (!mapaGeralPermissions.visualizar_areas) setShowAreas(false);
    if (!mapaGeralPermissions.visualizar_nomes_areas) setShowNomesAreas(false);
    if (!mapaGeralPermissions.visualizar_pontos_referencia) setShowPontos(false);
    if (!mapaGeralPermissions.visualizar_linhas) setShowLinhas(false);
    if (!mapaGeralPermissions.visualizar_lotes) setShowLotes(false);
    if (!mapaGeralPermissions.visualizar_cochos_suplementacao) {
      setShowCochos(false);
      setShowDepositos(false);
    }
    if (!mapaGeralPermissions.visualizar_alertas) setShowAlertas(false);
    if (!mapaGeralPermissions.visualizar_localizacao) setShowUserLocation(false);
    if (!mapaGeralPermissions.visualizar_filtros_camadas) setShowFiltros(false);
    if (!mapaGeralPermissions.visualizar_insights) setShowInsights(false);
    if (!mapaGeralPermissions.mover_lotes) setDragLotesEnabled(false);
  }, [mapaGeralPermissions]);

  useEffect(() => {
    if (podeUsarTarefasMapa) return;
    setShowTarefas(false);
    setShowDetalhesTarefa(false);
    setSelecionandoLocalTarefa(false);
    setRascunhoTarefa(null);
    setTarefasContext({});
  }, [podeUsarTarefasMapa]);

  // ─── Render ───
  const totalCabecas = lotesFiltrados.reduce((s, l) => s + (l.quantidade_cabecas || 0), 0);
  const pesoTotalFiltrado = lotesFiltrados.reduce((s, l) => s + (Number(l.peso_medio_kg) || 0) * (Number(l.quantidade_cabecas) || 0), 0);
  const pesoMedioGeral = totalCabecas > 0 && pesoTotalFiltrado > 0 ? Math.round(pesoTotalFiltrado / totalCabecas) : 0;
  const areasOcupadas = new Set(lotesFiltrados.map((l) => l.area_atual_id).filter(Boolean)).size;
  const totalAlertas = lotesFiltrados.filter((l) => l.alertas.length > 0).length;

  return (
    <div className="absolute inset-0 z-30 bg-white" translate="no">
      <div className="w-full h-full relative">
        <div ref={mapRef} style={{ height: '100%', width: '100%', backgroundColor: '#e5e7eb', touchAction: 'pan-x pan-y', WebkitOverflowScrolling: 'touch' }} />

        {/* Controles Mobile */}
        <MapaControlesMobile
          mapType={mapType} setMapType={setMapType}
          onRefresh={handleRefresh} onLocate={handleLocate}
          dragEnabled={dragLotesEnabled}
          onToggleDrag={() => setDragLotesEnabled((prev) => !prev)}
          showTarefasButton={podeUsarTarefasMapa}
          showInsightsButton={mapaGeralPermissions.visualizar_insights}
          showFiltrosButton={mapaGeralPermissions.visualizar_filtros_camadas}
          onOpenTarefas={() => {if (!podeUsarTarefasMapa) return;setTarefasContext({});setShowTarefas(true);}}
          onOpenInsights={() => {if (!mapaGeralPermissions.visualizar_insights) return;setShowInsights(true);}}
          onOpenFiltros={() => {if (!mapaGeralPermissions.visualizar_filtros_camadas) return;setShowFiltros(true);}} />


        {/* Legenda */}
        <MapaLegenda
          modoColoracao={modoColoracao}
          categoriasGadoCores={categoriasGadoCores}
          tiposPastagemCores={tiposPastagemCores} />


        {/* Barra resumo inferior */}
        <div className="absolute bottom-2 left-2 right-2 z-10">
          <div className="bg-white/95 text-[10px] px-2 rounded-lg inline-flex max-w-full items-center gap-3 shadow-md border border-slate-200 pointer-events-auto">
            <div className="text-center">
              <div className="font-bold text-emerald-700 text-sm leading-tight flex items-center gap-1.5 justify-center">
                <span>{totalCabecas}</span>
                {pesoMedioGeral > 0 && <span className="text-blue-700">| {pesoMedioGeral} kg</span>}
              </div>
              <div className="text-slate-500">Animais{pesoMedioGeral > 0 ? ' | Peso méd.' : ''}</div>
            </div>
            <div className="w-px h-5 bg-slate-200" />
            <div className="text-center">
              <div className="font-bold text-blue-700 text-sm leading-tight">{areasFiltradas.length}</div>
              <div className="text-slate-500">Áreas</div>
            </div>
          </div>
        </div>

        {!mapReady &&
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 bg-white px-6 py-4 rounded-lg shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="animate-spin w-6 h-6 border-4 border-emerald-600 border-t-transparent rounded-full" />
              <span className="font-semibold text-slate-700 text-sm">Carregando mapa salvo...</span>
            </div>
          </div>
        }
      </div>

      {/* ─── Sheet Filtros Avançados ─── */}
      <Sheet open={showFiltros} onOpenChange={setShowFiltros}>
        <SheetContent side="left" className="bg-background pt-1 pr-1 pb-1 pl-1 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left fixed z-50 gap-1 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 inset-y-0 left-0 h-full border-r sm:max-w-sm w-[300px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-semibold text-foreground text-sm space-y-0 px-1">Filtros e Camadas</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <MapaFiltrosAvancados
              showAreas={showAreas} setShowAreas={setShowAreas}
              showPontos={showPontos} setShowPontos={setShowPontos}
              showLinhas={showLinhas} setShowLinhas={setShowLinhas}
              showLotes={showLotes} setShowLotes={setShowLotes}
              showTarefas={showTaskIcons} setShowTarefas={setShowTaskIcons}
              showCochos={showCochos} setShowCochos={setShowCochos}
              showDepositos={showDepositos} setShowDepositos={setShowDepositos}
              showHectaresAreas={showHectaresAreas} setShowHectaresAreas={setShowHectaresAreas}
              showAlertas={showAlertas} setShowAlertas={setShowAlertas}
              showUserLocation={showUserLocation} setShowUserLocation={setShowUserLocation}
              showNomesAreas={showNomesAreas} setShowNomesAreas={setShowNomesAreas}
              filtroCategoria={filtroCategoria} setFiltroCategoria={setFiltroCategoria}
              filtroIdentificador={filtroIdentificador} setFiltroIdentificador={setFiltroIdentificador}
              filtroStatus={filtroStatus} setFiltroStatus={setFiltroStatus}
              filtroSistema={filtroSistema} setFiltroSistema={setFiltroSistema}
              filtroAlertaTipo={filtroAlertaTipo} setFiltroAlertaTipo={setFiltroAlertaTipo}
              filtroSetor={filtroSetor} setFiltroSetor={setFiltroSetor}
              filtroTipoCultura={filtroTipoCultura} setFiltroTipoCultura={setFiltroTipoCultura}
              filtroTipoPastagem={filtroTipoPastagem} setFiltroTipoPastagem={setFiltroTipoPastagem}
              filtroPesoMin={filtroPesoMin} setFiltroPesoMin={setFiltroPesoMin}
              filtroPesoMax={filtroPesoMax} setFiltroPesoMax={setFiltroPesoMax}
              modoColoracao={modoColoracao} setModoColoracao={setModoColoracao}
              categorias={categorias}
              identificadores={identificadores}
              tiposPastagem={tiposPastagem}
              setores={setores}
              sistemasProdutivos={sistemasProdutivos}
              permissions={mapaGeralPermissions} />

          </div>
        </SheetContent>
      </Sheet>

      {/* ─── Dialogs ─── */}
      <Dialog open={showDetalhesLote} onOpenChange={(open) => {setShowDetalhesLote(open);if (!open) refetchLotes();}}>
        <DialogContent className="bg-background px-2 py-2 overflow-x-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:w-full sm:p-1 fixed left-[50%] top-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%] gap-2 border shadow-lg duration-200 sm:rounded-lg max-w-[95vw] md:max-w-[75vw] xl:max-w-[65vw] max-h-[95vh] overflow-y-auto">
          <DialogHeader><DialogTitle translate="no">Detalhes do Lote</DialogTitle></DialogHeader>
          {selectedLote && <DetalhesLote lotes={Array.isArray(selectedLote) ? selectedLote : [selectedLote]} permissions={mapaGeralPermissions} onClose={() => {setShowDetalhesLote(false);refetchLotes();}} />}
        </DialogContent>
      </Dialog>

      <Dialog open={showDetalhesArea} onOpenChange={setShowDetalhesArea}>
        <DialogContent className="bg-background px-2 py-2 overflow-x-hidden sm:w-full sm:p-1 fixed left-[50%] top-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%] gap-2 border shadow-lg duration-200 sm:rounded-lg max-w-[95vw] md:max-w-[75vw] xl:max-w-[65vw] max-h-[95vh] overflow-y-auto">
          <DialogHeader></DialogHeader>
          {selectedArea && <DetalhesArea area={selectedArea} onClose={() => setShowDetalhesArea(false)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={showDetalhesBebedouro} onOpenChange={setShowDetalhesBebedouro}>
        <DialogContent className="overflow-x-hidden p-1 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:w-full sm:p-1 bg-background px-2 py-2 fixed left-[50%] top-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%] gap-4 border shadow-lg duration-200 sm:rounded-lg max-w-[95vw] md:max-w-[75vw] xl:max-w-[65vw] max-h-[95vh] overflow-y-auto">
          <DialogHeader className="flex flex-col space-y-1.5 text-center sm:text-left"><DialogTitle className="text-font-semibold leading-none tracking-tight">Bebedouro</DialogTitle></DialogHeader>
          {selectedBebedouro && <DetalhesBebedouro bebedouro={selectedBebedouro} />}
        </DialogContent>
      </Dialog>

      <Dialog open={showDetalhesPontoSupl} onOpenChange={(open) => {setShowDetalhesPontoSupl(open);if (!open) {refetchEventosSupl();refetchLotes();refetchPontosSupl();}}}>
        <DialogContent className="overflow-x-hidden p-1 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:w-full sm:p-1 bg-background px-2 py-2 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] fixed left-[50%] top-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%] gap-4 border shadow-lg duration-200 sm:rounded-lg max-w-[95vw] md:max-w-[75vw] xl:max-w-[65vw] max-h-[95vh] overflow-y-auto">
          <DialogHeader className="flex flex-col space-y-1.5 text-center sm:text-left"><DialogTitle className="text-font-semibold leading-none tracking-tight">{selectedPontoSupl?.categoria_ponto === 'DEPOSITO' ? 'Depósito de Suplementação' : 'Ponto de Suplementação'}</DialogTitle></DialogHeader>
          {selectedPontoSupl && <DetalhesPontoSuplementacao ponto={selectedPontoSupl} permissions={mapaGeralPermissions} onClose={() => {setShowDetalhesPontoSupl(false);refetchEventosSupl();refetchLotes();refetchPontosSupl();}} />}
        </DialogContent>
      </Dialog>

      <Dialog open={showTarefas} onOpenChange={(open) => {setShowTarefas(open);if (!open && podeUsarTarefasMapa) refetchTarefas();}}>
        <DialogContent className="p-3 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] bg-background px-2 py-2 overflow-x-auto sm:w-full sm:p-1 fixed left-[50%] top-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%] gap-2 border shadow-lg duration-200 sm:rounded-lg max-w-[99vw] md:max-w-[92vw] xl:max-w-[96vw] max-h-[95vh] overflow-y-auto">
          <TarefasMapaPanel areaId={tarefasContext.areaId} areaNome={tarefasContext.areaNome} loteId={tarefasContext.loteId} loteNome={tarefasContext.loteNome} pontoSuplId={tarefasContext.pontoSuplId} initialCoordinates={tarefasContext.initialCoordinates} initialDraft={tarefasContext.initialDraft} openCreateOnMount={tarefasContext.openCreateOnMount} onRequestSelectLocation={handleRequestSelectTaskLocation} onClose={() => {setShowTarefas(false);setTarefasContext({});if (podeUsarTarefasMapa) refetchTarefas();}} />
        </DialogContent>
      </Dialog>

      <Dialog open={showDetalhesTarefa} onOpenChange={(open) => {setShowDetalhesTarefa(open);if (!open && podeUsarTarefasMapa) refetchTarefas();}}>
        <DialogContent className="p-3 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] bg-background px-2 py-2 overflow-x-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:w-full sm:p-1 fixed left-[50%] top-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%] gap-2 border shadow-lg duration-200 sm:rounded-lg max-w-[95vw] md:max-w-[75vw] xl:max-w-[65vw] max-h-[95vh] overflow-y-auto">
          <DialogHeader className="sr-only"><DialogTitle>Detalhes da tarefa</DialogTitle></DialogHeader>
          {selectedTarefa && <DetalhesTarefaMapa tarefa={selectedTarefa} onRequestSelectLocation={handleRequestSelectTaskLocation} onSaved={(updated) => {if (updated) setSelectedTarefa(updated);if (podeUsarTarefasMapa) refetchTarefas();}} />}
        </DialogContent>
      </Dialog>

      <Dialog open={showInsights} onOpenChange={setShowInsights}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-sm"><BarChart3 className="w-4 h-4 text-emerald-600" /> Insights do Mapa</DialogTitle></DialogHeader>
          <MapaInsights lotes={lotesFiltrados} areas={areasFiltradas} eventosSupl={eventosSupl} pontosSuplementacao={pontosSuplementacaoDecorados} pontosReferencia={pontos} />
        </DialogContent>
      </Dialog>
    </div>);

}

function ptInPoly(latLng, paths) {
  let inside = false;
  const lat = typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat;
  const lng = typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng;
  for (let i = 0, j = paths.length - 1; i < paths.length; j = i++) {
    const xi = paths[i].lat,yi = paths[i].lng,xj = paths[j].lat,yj = paths[j].lng;
    if (yi > lng !== yj > lng && lat < (xj - xi) * (lng - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}