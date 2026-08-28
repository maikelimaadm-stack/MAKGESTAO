import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronDown, ChevronRight } from "lucide-react";
import { updateMapaCachedData, refreshMapaCacheEntry } from "@/components/offline/mapaOfflineCache";
import { Progress } from "@/components/ui/progress";
import { normalizeText, obterSaldoProdutoLocal, parseNumber, registrarSaidaSuplementacao } from "./estoqueSuplementacaoUtils";
import { formatDecimal } from "./formatters";
import { calcularDiasPeriodo } from "../utils/consumoUtils";
import { buildTimeWeightedLoteAllocations } from "./timeWeightedAllocation";
import { safeDivide } from "../utils/pecuariaUtils";
import { quantidadeParaKg, produtoSuportaSacos, kgParaSacos } from "./unidadeConversaoUtils";
import { consumoEsperadoPorCabecaDia, pesoMedioPonderadoLotes } from "./consumoPVUtils";
import SobraHerdadaDialog from "./SobraHerdadaDialog";

export default function FormularioLancamentoSuplementacao({ ponto, onSubmit, onCancel }) {
  const empresaSelecionadaId = localStorage.getItem("empresa_selecionada_id");
  const getTodayLocalYMD = () => {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    const dia = String(hoje.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  };
  const parseDateLocal = (value) => {
    if (!value) return null;
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [ano, mes, dia] = value.split("-").map(Number);
      return new Date(ano, mes - 1, dia);
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };
  const formatDateBR = (value) => {
    const data = parseDateLocal(value);
    return data ? data.toLocaleDateString("pt-BR") : "-";
  };
  const queryClient = useQueryClient();
  const [progresso, setProgresso] = useState({ show: false, atual: 0, total: 0, mensagem: "" });
  const [mostrarConsumoLote, setMostrarConsumoLote] = useState(false);
  const [mostrarDetalhes, setMostrarDetalhes] = useState(false);
  const [sobraHerdadaDecidida, setSobraHerdadaDecidida] = useState(false);
  const [sobraHerdadaKg, setSobraHerdadaKg] = useState(0);
  const [formData, setFormData] = useState({
    data_lancamento: getTodayLocalYMD(),
    data_fim_consumo_anterior: "",
    produto: ponto?.produto_padrao || "",
    quantidade_total_kg: "",
    sobra_kg: "0",
    unidade_lancamento: "KG",
    quantidade_sacos: "",
    observacoes: "",
  });

  const { data: user } = useQuery({ queryKey: ["user-suplementacao-form"], queryFn: () => base44.auth.me() });

  // Busca o ponto SEMPRE do banco para garantir deposito_origem_id e area_vinculada_ids corretos (ignora cache)
  const { data: pontoFresh = null, isLoading: loadingPontoFresh } = useQuery({
    queryKey: ["ponto-fresh-lancamento", ponto?.id],
    queryFn: async () => {
      if (!ponto?.id) return null;
      const all = await base44.entities.PontoSuplementacao.list();
      return all.find((item) => item.id === ponto.id) || ponto;
    },
    enabled: !!ponto?.id,
    staleTime: 0,
    gcTime: 30 * 1000, // limpa cache após 30s para não reter dados antigos entre aberturas
  });
  // pontoAtivo: prioriza sempre os dados frescos do banco
  const pontoAtivo = pontoFresh ?? ponto;

  const areaIdsVinculados = useMemo(() => {
    const ids = Array.isArray(pontoAtivo?.area_vinculada_ids) ? pontoAtivo.area_vinculada_ids.filter(Boolean) : [];
    return ids.length ? ids : (pontoAtivo?.area_vinculada_id ? [pontoAtivo.area_vinculada_id] : []);
  }, [pontoAtivo]);

  const areaNomesVinculados = useMemo(() => {
    const nomes = Array.isArray(pontoAtivo?.area_vinculada_nomes) ? pontoAtivo.area_vinculada_nomes.filter(Boolean) : [];
    return nomes.length ? nomes : (pontoAtivo?.area_vinculada_nome ? [pontoAtivo.area_vinculada_nome] : []);
  }, [pontoAtivo]);

  const { data: areas = [] } = useQuery({
    queryKey: ["areas-vinculadas-suplementacao", empresaSelecionadaId],
    queryFn: async () => {
      const all = await base44.entities.AreaPastagem.list();
      return all.filter((area) => area.empresa_id === empresaSelecionadaId && area.ativo !== false);
    },
    enabled: !!empresaSelecionadaId,
  });

  const areaNomesResolvidos = useMemo(() => {
    const nomesPorId = new Map(areas.map((area) => [area.id, area.nome]));
    const nomes = areaIdsVinculados.map((id) => nomesPorId.get(id)).filter(Boolean);
    if (nomes.length > 0) return nomes;
    if (areaNomesVinculados.length > 0) return areaNomesVinculados;
    return ponto?.area_vinculada_nome ? [ponto.area_vinculada_nome] : [];
  }, [areas, areaIdsVinculados, areaNomesVinculados, ponto?.area_vinculada_nome]);

  const { data: lotes = [], isLoading: loadingLotes } = useQuery({
    queryKey: ["lotes-area", areaIdsVinculados.join("|")],
    queryFn: async () => {
      const all = await base44.entities.Lote.list();
      return all.filter((lote) => lote.empresa_id === empresaSelecionadaId && areaIdsVinculados.includes(lote.area_atual_id) && lote.status === "Ativo");
    },
    enabled: !!empresaSelecionadaId && areaIdsVinculados.length > 0,
  });


  const { data: ultimoEvento } = useQuery({
    queryKey: ["ultimo-evento-ponto", empresaSelecionadaId, ponto?.id],
    queryFn: async () => {
      const eventos = await base44.entities.SuplementacaoEvento.filter({
        empresa_id: empresaSelecionadaId,
        ponto_suplementacao_id: ponto?.id,
      }, "-data_lancamento", 1);
      return eventos[0] || null;
    },
    enabled: !!empresaSelecionadaId && !!ponto?.id,
  });

  const { data: produtosSuplementacao = [] } = useQuery({
    queryKey: ["produtos-suplementacao-lancamento", empresaSelecionadaId, ponto?.produto_padrao],
    queryFn: async () => {
      const all = await base44.entities.Produto.list();
      return all.filter((produto) => {
        const tipoUso = normalizeText(produto.tipo_uso || "");
        const ehNutricaoAnimal = tipoUso === normalizeText("Nutrição Animal");
        const produtoMarcadoNoPonto = ponto?.produto_padrao && normalizeText(produto.nome_produto) === normalizeText(ponto.produto_padrao);
        return produto.empresa_id === empresaSelecionadaId && (ehNutricaoAnimal || produtoMarcadoNoPonto);
      });
    },
    enabled: !!empresaSelecionadaId,
  });

  // Usa sempre o pontoFresh (banco) para resolver o depósito, não o cache
  const depositoOrigemId = pontoFresh?.deposito_origem_id || ponto?.deposito_origem_id;
  const depositoOrigemNome = pontoFresh?.deposito_origem_nome || ponto?.deposito_origem_nome;

  const { data: depositoVinculado = null } = useQuery({
    queryKey: ["deposito-vinculado-cocho", ponto?.id, depositoOrigemId, depositoOrigemNome],
    queryFn: async () => {
      const all = await base44.entities.PontoSuplementacao.list();
      return all.find((item) => item.id === depositoOrigemId)
        || all.find((item) => normalizeText(item.nome_ponto) === normalizeText(depositoOrigemNome) && normalizeText(item.categoria_ponto) === "DEPOSITO")
        || null;
    },
    // Só habilita quando pontoFresh já chegou (garante que os dados são do banco)
    enabled: !!(pontoFresh && (depositoOrigemId || depositoOrigemNome)),
  });

  const { data: lotesNota = [] } = useQuery({
    queryKey: ["lotes-nota-suplementacao", empresaSelecionadaId],
    queryFn: async () => {
      const all = await base44.entities.EstoqueLoteNota.list();
      return all.filter((lote) => lote.empresa_id === empresaSelecionadaId && lote.status === "Disponivel");
    },
    enabled: !!empresaSelecionadaId,
  });

  const { data: eventosRecentes = [] } = useQuery({
    queryKey: ["eventos-recentes-ponto", empresaSelecionadaId, ponto?.id],
    queryFn: async () => {
      return await base44.entities.SuplementacaoEvento.filter({
        empresa_id: empresaSelecionadaId,
        ponto_suplementacao_id: ponto?.id,
      }, "-data_lancamento", 12);
    },
    enabled: !!empresaSelecionadaId && !!ponto?.id,
  });

  const { data: movimentacoesPecuaria = [] } = useQuery({
    queryKey: ["movimentacoes-pecuaria-suplementacao", empresaSelecionadaId],
    queryFn: async () => {
      const all = await base44.entities.MovimentacaoPecuaria.list();
      return all.filter((mov) => mov.empresa_id === empresaSelecionadaId);
    },
    enabled: !!empresaSelecionadaId,
    staleTime: 2 * 60 * 1000,
  });

  // === SOBRA HERDADA: detecta se o último evento tinha sobra E o cocho ficou sem lote no pasto ===
  // Condição: último evento com sobra_kg > 0 + nenhum lote ativo na área no momento atual seria "fechamento sem reabertura"
  // Mas o usuário pode estar abrindo o form justamente porque retornou lote — então usamos: se último evento foi um fechamento (dias_periodo preenchido) com sobra > 0 e ainda não tem evento de abertura depois.
  const sobraPendenteDoCochoKg = useMemo(() => {
    if (!ultimoEvento) return 0;
    const sobra = Number(ultimoEvento.sobra_kg || 0);
    // Considera sobra pendente apenas se o último evento foi um fechamento (dias_periodo preenchido) com sobra > 0
    if (sobra > 0 && ultimoEvento.dias_periodo != null) return sobra;
    return 0;
  }, [ultimoEvento]);

  const precisaDecidirSobra = sobraPendenteDoCochoKg > 0 && !sobraHerdadaDecidida;

  // Usa a sobra do último fechamento como saldo inicial de um NOVO lançamento aberto.
  // Não reabre nem altera o evento fechado anterior.
  const handleAproveitarSobra = () => {
    setSobraHerdadaKg(sobraPendenteDoCochoKg);
    setFormData((prev) => ({
      ...prev,
      quantidade_total_kg: prev.quantidade_total_kg || "0",
      sobra_kg: sobraPendenteDoCochoKg.toFixed(2),
      observacoes: prev.observacoes || `Novo ciclo iniciado aproveitando sobra anterior de ${sobraPendenteDoCochoKg.toFixed(2)} kg.`,
    }));
    setSobraHerdadaDecidida(true);
    toast.success(`Novo lançamento aberto com ${sobraPendenteDoCochoKg.toFixed(2)} kg de saldo inicial.`);
  };

  const handleDescartarSobra = () => {
    setSobraHerdadaKg(0);
    setFormData((prev) => ({ ...prev, sobra_kg: "0" }));
    setSobraHerdadaDecidida(true);
  };

  // === CÁLCULOS ===
  const totalCabecas = lotes.reduce((total, lote) => total + (lote.quantidade_cabecas || 0), 0);
  const pesoMedioGeral = pesoMedioPonderadoLotes(lotes);
  const closingDateForPreviousPeriod = formData.data_fim_consumo_anterior || formData.data_lancamento;
  const diasPeriodo = ultimoEvento ? calcularDiasPeriodo(ultimoEvento.data_lancamento, closingDateForPreviousPeriod) : null;

  const produtoSelecionado = useMemo(() => {
    return produtosSuplementacao.find((produto) => normalizeText(produto.nome_produto) === normalizeText(formData.produto)) || null;
  }, [produtosSuplementacao, formData.produto]);

  const suportaSacos = produtoSuportaSacos(produtoSelecionado);
  const pesoPorSaco = Number(produtoSelecionado?.peso_por_saco_kg || 0);
  const tipoConsumo = produtoSelecionado?.tipo_consumo || null;

  // Quantidade em kg (sempre convertida)
  const quantidadeKg = useMemo(() => {
    if (formData.unidade_lancamento === "SACO" && suportaSacos) {
      return quantidadeParaKg(parseNumber(formData.quantidade_sacos || 0), "SACO", pesoPorSaco);
    }
    return parseNumber(formData.quantidade_total_kg || 0);
  }, [formData.unidade_lancamento, formData.quantidade_sacos, formData.quantidade_total_kg, suportaSacos, pesoPorSaco]);

  const sobraInformada = parseNumber(formData.sobra_kg || 0);


  // %PV consumo esperado
  const pctPV = Number(produtoSelecionado?.percentual_consumo_pv || 0);
  const consumoEsperadoCabDiaPV = pctPV > 0 && pesoMedioGeral > 0
    ? consumoEsperadoPorCabecaDia(pesoMedioGeral, pctPV)
    : 0;
  const consumoEsperadoGrupoDiaPV = consumoEsperadoCabDiaPV * totalCabecas;

  // Consumo estimado do novo lançamento
  const frequenciaMinima = Math.max(0, Number(ponto?.frequencia_esperada_dias_minimo || 0));
  const frequenciaMaxima = Math.max(frequenciaMinima || 0, Number(ponto?.frequencia_esperada_dias_maximo || ponto?.frequencia_esperada_dias || 0));
  const frequenciaMedia = frequenciaMinima > 0 && frequenciaMaxima > 0
    ? (frequenciaMinima + frequenciaMaxima) / 2
    : Math.max(1, Number(ponto?.frequencia_esperada_dias || 1));
  const consumoReferenciaGrupoDia = consumoEsperadoGrupoDiaPV > 0
    ? consumoEsperadoGrupoDiaPV
    : (Number(ponto?.consumo_ideal_por_cabeca_kg || 0) * totalCabecas);
  const totalDisponivelNovo = Math.max(0, quantidadeKg + sobraInformada);
  const consumoEstimadoCabDia = totalCabecas > 0 && frequenciaMedia > 0 ? safeDivide(totalDisponivelNovo, totalCabecas * frequenciaMedia) : 0;
  const consumoEstimadoGramas = consumoEstimadoCabDia * 1000;
  const duracaoDiasNovoPeriodo = consumoReferenciaGrupoDia > 0 ? safeDivide(totalDisponivelNovo, consumoReferenciaGrupoDia) : 0;
  const duracaoDiasInteira = Math.max(0, Math.round(duracaoDiasNovoPeriodo || 0));
  const dataEstimadaProxima = (() => {
    const dataBase = parseDateLocal(formData.data_lancamento);
    if (!dataBase || duracaoDiasInteira <= 0) return null;
    return new Date(dataBase.getTime() + duracaoDiasInteira * 86400000);
  })();

  const statusDuracao = (() => {
    if (duracaoDiasInteira <= 0) return { status: "sem_dados", label: "Sem referência", message: "Não foi possível calcular a duração estimada." };
    if (frequenciaMinima > 0 && duracaoDiasInteira < frequenciaMinima) {
      return { status: "baixo", label: "Abaixo do mínimo", message: `A duração estimada ficou abaixo da frequência mínima (${formatDecimal(frequenciaMinima, 0, true)} dia(s)).` };
    }
    if (frequenciaMaxima > 0 && duracaoDiasInteira > frequenciaMaxima) {
      return { status: "alto", label: "Acima do máximo", message: `A duração estimada ficou acima da frequência máxima (${formatDecimal(frequenciaMaxima, 0, true)} dia(s)).` };
    }
    return { status: "normal", label: "Dentro do limite", message: "A duração estimada ficou dentro da faixa esperada do cocho." };
  })();


  // Médias recentes
  const mediaRecente7Dias = (() => {
    const limite = new Date(formData.data_lancamento || new Date().toISOString().split("T")[0]);
    limite.setDate(limite.getDate() - 7);
    const fechados = eventosRecentes.filter((evento) => evento?.dias_periodo > 0 && new Date(evento.data_lancamento) >= limite && (evento.total_cabecas_afetadas || 0) > 0 && (evento.consumo_diario_grupo_kg || 0) > 0);
    if (!fechados.length) return 0;
    const totalAnimalDias = fechados.reduce((sum, evento) => sum + ((evento.total_cabecas_afetadas || 0) * (evento.dias_periodo || 0)), 0);
    const totalConsumido = fechados.reduce((sum, evento) => sum + ((evento.consumo_diario_grupo_kg || 0) * (evento.dias_periodo || 0)), 0);
    return safeDivide(totalConsumido, totalAnimalDias);
  })();

  const ultimoConsumoCabDia = ultimoEvento?.consumo_diario_grupo_kg
    ? safeDivide(ultimoEvento.consumo_diario_grupo_kg, ultimoEvento.total_cabecas_afetadas || 0)
    : 0;

  const alocacaoTemporalPreview = useMemo(() => {
    if (!ultimoEvento || !diasPeriodo) return [];
    const consumoTotalPreview = Math.max(0, (ultimoEvento.quantidade_total_kg || 0) - sobraInformada + (ultimoEvento.sobra_kg || 0));
    return buildTimeWeightedLoteAllocations({
      lotes,
      movimentacoes: movimentacoesPecuaria,
      areaIds: areaIdsVinculados,
      dataInicio: ultimoEvento.data_lancamento,
      dataFim: closingDateForPreviousPeriod,
      consumoTotalPeriodo: consumoTotalPreview,
    });
  }, [ultimoEvento, diasPeriodo, lotes, movimentacoesPecuaria, areaIdsVinculados, closingDateForPreviousPeriod, sobraInformada]);

  // Produtos disponíveis - filtrar apenas os que têm saldo no depósito vinculado
  const produtosDisponiveis = useMemo(() => {
    if (!depositoVinculado?.local_estoque_id) return produtosSuplementacao;
    // Only show products that have saldo in the linked deposit
    return produtosSuplementacao
      .filter((p) => {
        const saldo = obterSaldoProdutoLocal(lotesNota, p.id, depositoVinculado.local_estoque_id);
        const ehProdutoPadrao = normalizeText(p.nome_produto) === normalizeText(ponto?.produto_padrao || "");
        return saldo > 0 || ehProdutoPadrao;
      })
      .sort((a, b) => {
        const saldoA = obterSaldoProdutoLocal(lotesNota, a.id, depositoVinculado.local_estoque_id);
        const saldoB = obterSaldoProdutoLocal(lotesNota, b.id, depositoVinculado.local_estoque_id);
        if (saldoA > 0 && saldoB <= 0) return -1;
        if (saldoB > 0 && saldoA <= 0) return 1;
        return a.nome_produto.localeCompare(b.nome_produto);
      });
  }, [depositoVinculado, produtosSuplementacao, lotesNota, ponto]);

  const saldoNoDeposito = useMemo(() => {
    if (!depositoVinculado?.local_estoque_id || !produtoSelecionado) return 0;
    return obterSaldoProdutoLocal(lotesNota, produtoSelecionado.id, depositoVinculado.local_estoque_id);
  }, [depositoVinculado, produtoSelecionado, lotesNota]);

  // Auto-selecionar produto único
  useEffect(() => {
    if (!formData.produto && produtosDisponiveis.length === 1) {
      setFormData((prev) => ({ ...prev, produto: produtosDisponiveis[0].nome_produto }));
    }
  }, [formData.produto, produtosDisponiveis]);

  // Ajustar unidade ao trocar produto
  useEffect(() => {
    if (produtoSelecionado) {
      if (!suportaSacos) {
        setFormData((prev) => ({ ...prev, unidade_lancamento: "KG", quantidade_sacos: "" }));
      }
    }
  }, [produtoSelecionado?.id]);

  // Sincronizar kg ↔ sacos
  const handleQuantidadeKgChange = (value) => {
    const kg = parseNumber(value);
    setFormData((prev) => ({
      ...prev,
      quantidade_total_kg: value,
      quantidade_sacos: suportaSacos && pesoPorSaco > 0 ? kgParaSacos(kg, pesoPorSaco).toFixed(1) : "",
    }));
  };

  const handleQuantidadeSacosChange = (value) => {
    const sacos = parseNumber(value);
    const kgConvertido = quantidadeParaKg(sacos, "SACO", pesoPorSaco);
    setFormData((prev) => ({
      ...prev,
      quantidade_sacos: value,
      quantidade_total_kg: kgConvertido.toFixed(2),
    }));
  };

  // === SALVAR ===
  const handleSalvar = async () => {
    if (progresso.show) return;

    if (!formData.produto) return toast.error("Selecione um produto.");
    if (quantidadeKg <= 0 && sobraInformada <= 0) return toast.error("Informe a quantidade fornecida ou aproveite uma sobra anterior.");
    if (sobraInformada < 0) return toast.error("A sobra informada não pode ser negativa.");
    if (totalCabecas <= 0) return toast.error("Não há cabeças ativas nas áreas vinculadas.");
    if (depositoVinculado?.local_estoque_id && !produtoSelecionado) return toast.error("O produto selecionado não foi encontrado no cadastro.");
    if (depositoVinculado?.local_estoque_id && quantidadeKg > 0 && quantidadeKg > saldoNoDeposito) return toast.error("Saldo insuficiente no depósito vinculado.");

    if (ultimoEvento) {
      const saldoFisicoMaximo = (ultimoEvento.quantidade_total_kg || 0) + (ultimoEvento.sobra_kg || 0);
      if (sobraInformada > saldoFisicoMaximo) {
        return toast.error("A sobra informada é maior que o total fisicamente disponível no período anterior.");
      }
    }

    if (statusDuracao.status === "baixo" || statusDuracao.status === "alto") {
      const confirmarDuracao = window.confirm(`${statusDuracao.message}\n\nDeseja salvar mesmo assim?`);
      if (!confirmarDuracao) return;
    }

    try {
      const deveBaixarDeposito = depositoVinculado?.local_estoque_id && produtoSelecionado && quantidadeKg > 0;
      const totalPassos = (deveBaixarDeposito ? 1 : 0) + 1;
      let passoAtual = 0;
      setProgresso({ show: true, atual: 0, total: totalPassos, mensagem: "Iniciando lançamento..." });

      let movimentoEstoque = null;
      if (deveBaixarDeposito) {
        setProgresso({ show: true, atual: ++passoAtual, total: totalPassos, mensagem: "Baixando saldo do depósito..." });
        const saidaRegistrada = await registrarSaidaSuplementacao({
          empresaId: empresaSelecionadaId,
          userEmail: user?.email,
          produto: produtoSelecionado,
          quantidade: quantidadeKg,
          localOrigemId: depositoVinculado.local_estoque_id,
          localOrigemNome: depositoVinculado.local_estoque_nome,
          areaId: areaIdsVinculados[0] || ponto.area_vinculada_id,
          areaNome: areaNomesResolvidos.join(", ") || ponto.area_vinculada_nome,
          observacoes: `Saída automática para o cocho ${ponto.nome_ponto}${formData.observacoes ? ` - ${formData.observacoes}` : ""}`,
          lotesNota,
          depositoId: depositoVinculado.id,
          pontoSuplementacaoId: ponto.id,
          dataMovimentacao: formData.data_lancamento,
        });
        movimentoEstoque = saidaRegistrada.movimentacao;
      }

      setProgresso({ show: true, atual: ++passoAtual, total: totalPassos, mensagem: "Criando evento de suplementação..." });
      const sacosLancamento = formData.unidade_lancamento === "SACO" ? parseNumber(formData.quantidade_sacos || 0) : null;
      
      const novoEvento = await base44.entities.SuplementacaoEvento.create({
        empresa_id: empresaSelecionadaId,
        ponto_suplementacao_id: ponto.id,
        ponto_nome: ponto.nome_ponto,
        area_id: areaIdsVinculados[0] || ponto.area_vinculada_id,
        area_nome: areaNomesResolvidos.join(", ") || ponto.area_vinculada_nome,
        area_ids: areaIdsVinculados,
        area_nomes: areaNomesResolvidos,
        data_lancamento: formData.data_lancamento,
        produto: formData.produto,
        produto_id: produtoSelecionado?.id || null,
        tipo_consumo: tipoConsumo || null,
        quantidade_total_kg: quantidadeKg,
        quantidade_sacos: sacosLancamento,
        peso_por_saco_kg: suportaSacos ? pesoPorSaco : null,
        unidade_lancamento: formData.unidade_lancamento,
        sobra_kg: parseNumber(formData.sobra_kg || 0),
        dias_periodo: null,
        consumo_diario_grupo_kg: null,
        total_cabecas_afetadas: totalCabecas,
        peso_medio_lotes_kg: pesoMedioGeral || null,
        peso_total_consumo: totalCabecas,
        consumo_esperado_pv_kg: consumoEsperadoGrupoDiaPV > 0 ? consumoEsperadoGrupoDiaPV : null,
        percentual_consumo_pv_usado: pctPV > 0 ? pctPV : null,
        movimentacao_estoque_id: movimentoEstoque?.id || null,
        observacoes: formData.observacoes || null,
      });

      const lotesPayload = lotes.map((lote) => {
        const pesoMedioLote = Number(lote.peso_medio_kg || 0);
        const consumoEsperadoLotePV = pctPV > 0 && pesoMedioLote > 0
          ? consumoEsperadoPorCabecaDia(pesoMedioLote, pctPV) * (lote.quantidade_cabecas || 0)
          : null;
        const percentualLote = totalCabecas > 0 ? (lote.quantidade_cabecas || 0) / totalCabecas : 0;

        return {
          empresa_id: empresaSelecionadaId,
          suplementacao_evento_id: novoEvento.id,
          lote_id: lote.id,
          lote_nome: lote.nome,
          categoria: lote.categoria,
          fator_consumo: 1,
          peso_medio_lote_kg: pesoMedioLote || null,
          consumo_esperado_pv_lote_kg: consumoEsperadoLotePV,
          data_lancamento: formData.data_lancamento,
          produto: formData.produto,
          cabecas_na_area: lote.quantidade_cabecas,
          peso_consumo_lote: lote.quantidade_cabecas || 0,
          percentual_consumo_lote: percentualLote,
          dias_periodo: null,
          dias_ativos_periodo: null,
          animal_dias_periodo: null,
          consumo_unitario_dia: null,
          consumo_por_cabeca_dia_kg: null,
          consumo_total_lote_periodo_kg: null,
        };
      });

      if (lotesPayload.length > 0) {
        await base44.entities.SuplementacaoLote.bulkCreate(lotesPayload);
      }

      try {
        if (ultimoEvento && ultimoEvento.dias_periodo == null) {
          const diasPeriodoCalculado = calcularDiasPeriodo(
            ultimoEvento.data_lancamento,
            closingDateForPreviousPeriod
          );

          if (diasPeriodoCalculado > 0) {
            const { fecharPeriodoSupplementacao } = await import("../utils/consumoUtils");
            await fecharPeriodoSupplementacao({
              evento: ultimoEvento,
              diasPeriodo: diasPeriodoCalculado,
              sobraInicial: ultimoEvento.sobra_kg || 0,
              sobraFinal: parseNumber(formData.sobra_kg || 0),
            });
          } else {
            toast.warn("Datas inconsistentes — período anterior não foi fechado.");
          }
        }
      } catch (err) {
        toast.warn("Falha ao fechar período anterior, mas o lançamento foi salvo.");
      }

      await updateMapaCachedData('eventosSuplementacao', empresaSelecionadaId, (items) => [novoEvento, ...(items || [])]);
      await Promise.all([
        refreshMapaCacheEntry('eventosSuplementacao', empresaSelecionadaId, { force: true }),
        refreshMapaCacheEntry('movimentacaoEstoque', empresaSelecionadaId, { force: true }),
        refreshMapaCacheEntry('estoqueLotes', empresaSelecionadaId, { force: true }),
      ]);

      queryClient.setQueryData(["ultimo-evento-ponto", empresaSelecionadaId, ponto?.id], novoEvento);
      queryClient.setQueryData(["eventos-recentes-ponto", empresaSelecionadaId, ponto?.id], (current = []) => [novoEvento, ...current].slice(0, 12));
      queryClient.invalidateQueries({ predicate: (query) => Array.isArray(query.queryKey) && ["eventos-ponto", "ultimo-evento-ponto", "eventos-recentes-ponto", "lotes-nota-suplementacao", "mapa-eventos-supl", "movimentacoes", "produtos", "suplementacao-ponto", "saldo-deposito", "movimentacoes-deposito-detalhe", "mapa-eventosSuplementacao"].includes(query.queryKey[0]) });
      window.dispatchEvent(new CustomEvent("atualizar-mapa"));
      setProgresso({ show: true, atual: totalPassos, total: totalPassos, mensagem: "Concluído!" });
      toast.success("Suplementação registrada com sucesso.");
      setTimeout(() => {
        setProgresso({ show: false, atual: 0, total: 0, mensagem: "" });
        onCancel();
      }, 400);
    } catch (error) {
      setProgresso({ show: false, atual: 0, total: 0, mensagem: "" });
      toast.error(error.message || "Erro ao registrar suplementação.");
    }
  };

  const botaoHabilitado = totalCabecas > 0 && formData.produto && totalDisponivelNovo > 0;

  return (
    <>
      <SobraHerdadaDialog
        open={precisaDecidirSobra}
        sobraKg={sobraPendenteDoCochoKg}
        pontoNome={ponto?.nome_ponto}
        ultimoLancamentoData={ultimoEvento?.data_lancamento}
        onAproveitar={handleAproveitarSobra}
        onDescartar={handleDescartarSobra}
        onCancel={onCancel}
      />
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="bg-emerald-50 border-b border-emerald-200 py-2 px-3"><CardTitle className="text-sm font-bold text-emerald-900">Lançar Suplementação - {ponto?.nome_ponto}</CardTitle></CardHeader>
        <CardContent className="p-2 max-h-[calc(100vh-200px)] overflow-y-auto overflow-x-hidden">
          <div className="space-y-1">
            {/* Resumo do ponto */}
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-2 text-[11px] space-y-1">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-1 text-[10px]">
                <div className="rounded border border-slate-200 bg-white px-1.5 py-1 text-slate-600">Áreas: <span className="font-semibold text-slate-900">{areaNomesResolvidos.join(", ") || ponto?.area_vinculada_nome || "-"}</span></div>
                <div className="rounded border border-slate-200 bg-white px-1.5 py-1 text-slate-600">Depósito: <span className="font-semibold text-slate-900">{loadingPontoFresh ? "..." : (depositoVinculado?.nome_ponto || depositoOrigemNome || "Não vinculado")}</span></div>
                <div className="rounded border border-slate-200 bg-white px-1.5 py-1 text-slate-600">Lotes: <span className="font-semibold text-slate-900">{loadingLotes ? "..." : `${formatDecimal(lotes.length, 0, true)} lote(s) - ${formatDecimal(totalCabecas, 0, true)} cabeças`}</span></div>
                <div className="rounded border border-slate-200 bg-white px-1.5 py-1 text-slate-600">Peso médio: <span className="font-semibold text-slate-900">{pesoMedioGeral > 0 ? `${formatDecimal(pesoMedioGeral, 1)} kg` : "-"}</span></div>
              </div>
              {ultimoEvento && diasPeriodo && <div className="text-[10px] text-slate-600 pt-1 border-t border-emerald-200">Último lançamento: {formatDateBR(ultimoEvento.data_lancamento)} • Período: {formatDecimal(diasPeriodo, 0, true)} dia(s)</div>}
            </div>

            {!depositoVinculado?.local_estoque_id && <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] text-slate-600">Este cocho ainda não tem depósito vinculado. Lançamento sem baixa automática.</div>}

            {/* Formulário principal */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-1">
              <div>
                <label className="text-[12px] text-slate-500 pl-1 leading-none">Data do lançamento <span className="text-red-500">*</span></label>
                <div className="rounded-md border border-slate-300 focus-within:border-emerald-500 transition-colors"><Input type="date" value={formData.data_lancamento} onChange={(e) => setFormData((prev) => ({ ...prev, data_lancamento: e.target.value }))} className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent" /></div>
              </div>
              <div>
                <label className="text-[12px] text-slate-500 pl-1 leading-none">Data fim consumo anterior</label>
                <div className="rounded-md border border-slate-300 focus-within:border-emerald-500 transition-colors"><Input type="date" value={formData.data_fim_consumo_anterior} onChange={(e) => setFormData((prev) => ({ ...prev, data_fim_consumo_anterior: e.target.value }))} className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent" /></div>
              </div>
              <div>
                <label className="text-[12px] text-slate-500 pl-1 leading-none">Produto <span className="text-red-500">*</span></label>
                <div className="rounded-md border border-slate-300 focus-within:border-emerald-500 transition-colors"><Select value={formData.produto} onValueChange={(value) => setFormData((prev) => ({ ...prev, produto: value }))}>
                  <SelectTrigger className="h-7 text-xs border-0 shadow-none focus:ring-0 bg-transparent"><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                  <SelectContent>
                    {produtosDisponiveis.map((produto) => (
                      <SelectItem key={produto.id} value={produto.nome_produto} className="text-xs">
                        {produto.nome_produto}
                        {produto.percentual_consumo_pv ? ` (${produto.percentual_consumo_pv}% PV)` : ""}
                        {produto.unidade_principal_estoque === "SACO" ? ` • Saco ${produto.peso_por_saco_kg}kg` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select></div>
              </div>
            </div>

            {/* Campos de quantidade com suporte a sacos */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-1">
              {suportaSacos && (
                <div>
                  <label className="text-[12px] text-slate-500 pl-1 leading-none">Unidade de lançamento</label>
                  <div className="rounded-md border border-slate-300 focus-within:border-emerald-500 transition-colors"><Select value={formData.unidade_lancamento} onValueChange={(value) => setFormData((prev) => ({ ...prev, unidade_lancamento: value }))}>
                    <SelectTrigger className="h-7 text-xs border-0 shadow-none focus:ring-0 bg-transparent"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KG" className="text-xs">Quilogramas (KG)</SelectItem>
                      <SelectItem value="SACO" className="text-xs">Sacos ({pesoPorSaco} kg/saco)</SelectItem>
                    </SelectContent>
                  </Select></div>
                </div>
              )}

              {formData.unidade_lancamento === "SACO" && suportaSacos ? (
                <>
                  <div>
                    <label className="text-[12px] text-slate-500 pl-1 leading-none">Quantidade de sacos <span className="text-red-500">*</span></label>
                    <div className="rounded-md border border-slate-300 focus-within:border-emerald-500 transition-colors"><Input type="text" inputMode="decimal" value={formData.quantidade_sacos} onChange={(e) => handleQuantidadeSacosChange(e.target.value)} className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent" placeholder="0" /></div>
                  </div>
                  <div>
                    <label className="text-[12px] text-slate-500 pl-1 leading-none">Equivalente em kg</label>
                    <div className="h-7 flex items-center px-3 bg-slate-100 rounded-md text-xs font-semibold text-slate-700 border border-slate-300">{formatDecimal(quantidadeKg)} kg</div>
                  </div>
                </>
              ) : (
                <div className={`${suportaSacos ? "" : "lg:col-span-2"}`}>
                  <label className="text-[12px] text-slate-500 pl-1 leading-none">Quantidade total fornecida (kg) <span className="text-red-500">*</span></label>
                  <div className="rounded-md border border-slate-300 focus-within:border-emerald-500 transition-colors"><Input type="text" inputMode="decimal" value={formData.quantidade_total_kg} onChange={(e) => handleQuantidadeKgChange(e.target.value)} className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent" placeholder="0,00" /></div>
                  {suportaSacos && pesoPorSaco > 0 && quantidadeKg > 0 && (
                    <div className="text-[10px] text-slate-500">≈ {formatDecimal(kgParaSacos(quantidadeKg, pesoPorSaco), 1)} saco(s)</div>
                  )}
                </div>
              )}

              <div>
                <label className="text-[12px] text-slate-500 pl-1 leading-none">
                  Sobra no cocho (kg)
                  {sobraHerdadaKg > 0 && <span className="ml-1 text-amber-700 font-semibold">• Herdada do ciclo anterior</span>}
                </label>
                <div className={`rounded-md border ${sobraHerdadaKg > 0 ? "border-amber-300 bg-amber-50" : "border-slate-300"} focus-within:border-emerald-500 transition-colors`}>
                  <Input type="text" inputMode="decimal" value={formData.sobra_kg} onChange={(e) => setFormData((prev) => ({ ...prev, sobra_kg: e.target.value }))} className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent" placeholder="0,00" />
                </div>
              </div>
            </div>

            {/* Saldo depósito */}
            {depositoVinculado?.local_estoque_id && produtoSelecionado && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-1 text-[10px]">
                <div className="rounded border border-slate-200 bg-white px-1.5 py-1 text-slate-600">Saldo depósito: <span className="font-semibold text-slate-900">{saldoNoDeposito.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {produtoSelecionado.unidade_medida || "KG"}</span></div>
                {suportaSacos && pesoPorSaco > 0 && <div className="rounded border border-slate-200 bg-white px-1.5 py-1 text-slate-600">Sacos: <span className="font-semibold text-slate-900">{kgParaSacos(saldoNoDeposito, pesoPorSaco).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} sacos</span></div>}
                <div className="rounded border border-slate-200 bg-white px-1.5 py-1 text-slate-600">Baixa automática: <span className="font-semibold text-emerald-700">Ativa</span></div>
              </div>
            )}
            {depositoVinculado?.local_estoque_id && formData.produto && produtoSelecionado && saldoNoDeposito <= 0 && (
              <div className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[10px] text-red-700">
                Produto sem saldo disponível neste depósito/local de estoque.
              </div>
            )}



            {/* Detalhes do consumo (colapsável) */}
            {(ultimoEvento || (pctPV > 0 && pesoMedioGeral > 0 && totalCabecas > 0) || (quantidadeKg > 0 && totalCabecas > 0 && lotes.length > 0)) && (
              <button type="button" onClick={() => setMostrarDetalhes((prev) => !prev)} className="flex items-center gap-1.5 w-full text-left text-xs font-semibold text-slate-700 hover:text-emerald-700 transition-colors py-1">
                {mostrarDetalhes ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                {mostrarDetalhes ? "Ocultar análises de consumo" : "Ver análises de consumo"}
              </button>
            )}
            {mostrarDetalhes && (
            <>
            {/* Consumo do fechamento / estimativa */}
            {ultimoEvento && (() => {
              const sobraAnterior = ultimoEvento.sobra_kg || 0;
              const fornecidoAnterior = ultimoEvento.quantidade_total_kg || 0;
              const diasAnterior = ultimoEvento.dias_periodo || diasPeriodo || 0;
              const totalDisponivelAnterior = ultimoEvento.dias_periodo != null ? fornecidoAnterior : fornecidoAnterior + sobraAnterior;
              const sobraFechamento = ultimoEvento.dias_periodo != null ? sobraAnterior : sobraInformada;
              const consumoDiarioAnterior = ultimoEvento.consumo_diario_grupo_kg || safeDivide(Math.max(0, totalDisponivelAnterior - sobraFechamento), diasAnterior);
              const consumoPorCabAnterior = safeDivide(consumoDiarioAnterior, ultimoEvento.total_cabecas_afetadas || 0);
              const consumidoAnterior = Math.max(0, totalDisponivelAnterior - sobraFechamento);
              return (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px] space-y-1">
                  <div className="text-xs font-semibold text-slate-900">Consumo do fechamento / estimativa</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-1 text-[10px]">
                    <div className="rounded border border-slate-200 bg-white px-1.5 py-1"><div className="text-slate-500">Fornecido</div><div className="font-bold text-slate-900">{fornecidoAnterior.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg</div></div>
                    <div className="rounded border border-slate-200 bg-white px-1.5 py-1"><div className="text-slate-500">Consumido</div><div className="font-bold text-slate-900">{consumidoAnterior.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg</div></div>
                    <div className="rounded border border-slate-200 bg-white px-1.5 py-1"><div className="text-slate-500">Consumo/dia</div><div className="font-bold text-slate-900">{consumoDiarioAnterior.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg</div></div>
                    <div className="rounded border border-slate-200 bg-white px-1.5 py-1"><div className="text-slate-500">Consumo/cab/dia</div><div className="font-bold text-slate-900">{consumoPorCabAnterior.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg</div></div>
                  </div>
                  <div className="text-[10px] text-slate-600">Período analisado: {formatDecimal(diasAnterior, 0, true)} dia(s) • Cabeças: {formatDecimal(ultimoEvento.total_cabecas_afetadas || 0, 0, true)}</div>
                </div>
              );
            })()}

            {/* Painel %PV - quando disponível */}
            {pctPV > 0 && pesoMedioGeral > 0 && totalCabecas > 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px] space-y-1">
                <div className="text-xs font-semibold text-slate-900">Consumo esperado por %PV do produto</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-1 text-[10px]">
                  <div className="rounded border border-slate-200 bg-white px-1.5 py-1"><div className="text-slate-500">%PV</div><div className="font-bold text-slate-900">{formatDecimal(pctPV, 3)}%</div></div>
                  <div className="rounded border border-slate-200 bg-white px-1.5 py-1"><div className="text-slate-500">Peso médio</div><div className="font-bold text-slate-900">{pesoMedioGeral.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg</div></div>
                  <div className="rounded border border-slate-200 bg-white px-1.5 py-1"><div className="text-slate-500">Esperado/cab/dia</div><div className="font-bold text-slate-900">{consumoEsperadoCabDiaPV.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg</div></div>
                  <div className="rounded border border-slate-200 bg-white px-1.5 py-1"><div className="text-slate-500">Esperado grupo/dia</div><div className="font-bold text-slate-900">{consumoEsperadoGrupoDiaPV.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg</div></div>
                </div>
              </div>
            )}

            {/* Consumo por lote */}
            {quantidadeKg > 0 && totalCabecas > 0 && lotes.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px] space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <div className="text-xs font-semibold text-slate-900">Consumo por Lote (novo lançamento)</div>
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setMostrarConsumoLote((prev) => !prev)}>
                    {mostrarConsumoLote ? "Ocultar" : "Ver"}
                  </Button>
                </div>
                {mostrarConsumoLote && (
                  <div className="space-y-1">
                    {lotes.map((lote) => {
                      const percentualConsumo = totalCabecas > 0 ? ((lote.quantidade_cabecas || 0) / totalCabecas) * 100 : 0;
                      const pesoMedioLote = Number(lote.peso_medio_kg || 0);
                      const quantidadeLoteKg = totalDisponivelNovo * (percentualConsumo / 100);
                      const duracaoLoteDias = lote.quantidade_cabecas > 0 && consumoEsperadoCabDiaPV > 0
                        ? Math.max(0, Math.round(safeDivide(quantidadeLoteKg, consumoEsperadoCabDiaPV * (lote.quantidade_cabecas || 0))))
                        : duracaoDiasInteira;
                      const dataReposicaoLote = (() => {
                        const dataBase = parseDateLocal(formData.data_lancamento);
                        if (!dataBase || duracaoLoteDias <= 0) return null;
                        return new Date(dataBase.getTime() + duracaoLoteDias * 86400000);
                      })();
                      return (
                        <div key={lote.id} className="rounded-lg border border-slate-200 bg-white p-2 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-semibold text-xs text-slate-900">{lote.nome}</div>
                            <Badge variant="outline" className="text-[10px]">{formatDecimal(percentualConsumo, 1)}%</Badge>
                          </div>
                          <div className="text-[10px] text-slate-600">Área: {lote.area_atual_nome || areaNomesResolvidos.join(', ') || ponto.area_vinculada_nome || '-'}</div>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-1 text-[10px]">
                            <div><div className="text-slate-500">Cabeças</div><div className="font-bold text-slate-900">{formatDecimal(lote.quantidade_cabecas || 0, 0, true)}</div></div>
                            <div><div className="text-slate-500">Peso médio</div><div className="font-bold text-slate-900">{pesoMedioLote > 0 ? `${formatDecimal(pesoMedioLote, 0)} kg` : '-'}</div></div>
                            <div><div className="text-slate-500">Qtd. lote</div><div className="font-bold text-slate-900">{formatDecimal(quantidadeLoteKg, 2)} kg</div></div>
                            <div><div className="text-slate-500">Duração</div><div className="font-bold text-slate-900">{duracaoLoteDias > 0 ? `${formatDecimal(duracaoLoteDias, 0, true)} dia(s)` : '-'}</div></div>
                            <div><div className="text-slate-500">Próx. reposição</div><div className="font-bold text-slate-900">{dataReposicaoLote ? dataReposicaoLote.toLocaleDateString('pt-BR') : '-'}</div></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            </>
            )}

            <div>
              <label className="text-[12px] text-slate-500 pl-1 leading-none">Observações</label>
              <div className="rounded-md border border-slate-300 focus-within:border-emerald-500 transition-colors"><Textarea value={formData.observacoes} onChange={(e) => setFormData((prev) => ({ ...prev, observacoes: e.target.value }))} className="text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent" rows={3} /></div>
            </div>
            <div className="flex justify-end gap-1 pt-1 border-t">
              <Button type="button" variant="outline" onClick={onCancel} size="sm" className="h-7 text-xs">Cancelar</Button>
              <Button type="button" onClick={handleSalvar} size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" disabled={!botaoHabilitado || progresso.show}>{progresso.show ? "Registrando..." : "Salvar novo ciclo"}</Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <Dialog open={progresso.show} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Salvando...</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-slate-600">{progresso.mensagem}</p>
            <Progress value={progresso.total ? (progresso.atual / progresso.total) * 100 : 0} className="w-full h-1.5" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}