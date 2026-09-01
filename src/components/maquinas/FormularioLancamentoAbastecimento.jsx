import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import AutocompleteGenerico from "@/components/financeiro/AutocompleteGenerico";

const FL = ({ label, required, error, children }) =>
<div>
    <label className="text-[12px] text-slate-500 pl-1 leading-none">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    <div className={`rounded-md border ${error ? 'border-red-500 bg-red-50' : 'border-slate-300'} focus-within:border-emerald-500 transition-colors`}>
      {children}
    </div>
  </div>;


const INPUT_CLS = "h-7 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent";
const AC_INPUT_CLS = "border-0 shadow-none focus-visible:ring-0 bg-transparent h-7 text-xs";
const READONLY_CLS = "h-7 text-xs border-0 shadow-none focus-visible:ring-0 bg-slate-50/50";

const MIN_LITROS_CONFIAVEL = 10;
const MIN_CONSUMO = 0.1;
const MAX_CONSUMO = 200;

function calcularConsumo({ medicaoAnterior, medicaoAtual, litros }) {
  if (medicaoAnterior == null || medicaoAtual == null || !litros) return null;
  if (medicaoAtual <= medicaoAnterior) return null;
  const uso = medicaoAtual - medicaoAnterior;

  // Fórmula: Litros abastecidos / Uso (Horas ou KM) -> L/H ou L/KM
  const consumo = litros / uso;

  const confiavel = litros >= MIN_LITROS_CONFIAVEL && consumo >= MIN_CONSUMO && consumo <= MAX_CONSUMO;
  return { uso: Number(uso.toFixed(2)), consumo: Number(consumo.toFixed(2)), confiavel };
}

function calcularConsumoMedio(abastecimentos) {
  const validos = abastecimentos.filter(
    (a) => a.medicao != null && a.medicao_anterior != null && a.quantidade_litros >= MIN_LITROS_CONFIAVEL
  );
  if (validos.length === 0) return null;
  let usoTotal = 0;
  let litrosTotal = 0;
  for (const a of validos) {
    const uso = a.medicao - a.medicao_anterior;
    if (uso > 0) {
      usoTotal += uso;
      litrosTotal += a.quantidade_litros;
    }
  }
  if (litrosTotal === 0 || usoTotal === 0) return null;

  // Fórmula média: Total Litros / Total Uso
  const media = litrosTotal / usoTotal;

  if (media < MIN_CONSUMO || media > MAX_CONSUMO) return null;
  return Number(media.toFixed(2));
}

export default function FormularioLancamentoAbastecimento({ abastecimento, onSave, onCancel }) {
  const empresaSelecionadaId = localStorage.getItem("empresa_selecionada_id");
  const [invalidFields, setInvalidFields] = useState([]);
  const [saldoDisponivel, setSaldoDisponivel] = useState(null);

  const [formData, setFormData] = useState({
    data_abastecimento: abastecimento?.data_abastecimento || new Date().toISOString().split("T")[0],
    maquina_id: abastecimento?.maquina_id || "",
    grupo_atividade_id: abastecimento?.grupo_atividade_id || "",
    tipo_servico: abastecimento?.tipo_servico || "",
    responsavel: abastecimento?.responsavel || "",
    local_estoque_id: abastecimento?.local_estoque_id || "",
    produto_id: abastecimento?.produto_id || "",
    quantidade_litros: abastecimento?.quantidade_litros || "",
    medicao: abastecimento?.medicao || "",
    observacoes: abastecimento?.observacoes || ""
  });

  const handleChange = (field, value) => {
    setInvalidFields((prev) => prev.filter((f) => f !== field));
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // ========== QUERIES ==========

  const { data: maquinas = [] } = useQuery({
    queryKey: ["maquinas-abastecimento", empresaSelecionadaId],
    queryFn: async () => {
      const all = await base44.entities.Maquina.list();
      return all.
      filter((m) => m.empresa_id === empresaSelecionadaId && m.status !== "Inativo" && m.status !== "Vendido").
      sort((a, b) => a.nome.localeCompare(b.nome));
    },
    enabled: !!empresaSelecionadaId
  });

  const { data: todosProdutos = [] } = useQuery({
    queryKey: ["produtos-empresa-abast", empresaSelecionadaId],
    queryFn: async () => {
      const all = await base44.entities.Produto.list();
      return all.
      filter((p) => p.empresa_id === empresaSelecionadaId && p.ativo !== false).
      sort((a, b) => a.nome_produto.localeCompare(b.nome_produto));
    },
    enabled: !!empresaSelecionadaId
  });

  const { data: locais = [] } = useQuery({
    queryKey: ["locais-estoque-abastecimento"],
    queryFn: async () => {
      const all = await base44.entities.LocalEstoque.list();
      return all.sort((a, b) => a.nome.localeCompare(b.nome));
    }
  });

  const { data: gruposAtividade = [] } = useQuery({
    queryKey: ["grupos-atividade-abastecimento"],
    queryFn: async () => {
      const all = await base44.entities.GrupoAtividade.list();
      return all.
      filter((g) => g.ativo !== false).
      sort((a, b) => a.nome_grupo.localeCompare(b.nome_grupo));
    }
  });

  const { data: tiposTarefa = [] } = useQuery({
    queryKey: ["tipos-tarefa-abastecimento"],
    queryFn: async () => {
      const all = await base44.entities.TipoTarefa.list();
      return all.
      filter((t) => t.ativo !== false).
      sort((a, b) => a.nome_tipo.localeCompare(b.nome_tipo));
    }
  });

  const { data: lotesEstoque = [] } = useQuery({
    queryKey: ["lotes-estoque-abastecimento", empresaSelecionadaId],
    queryFn: async () => {
      const all = await base44.entities.EstoqueLoteNota.list();
      return all.filter((l) => l.empresa_id === empresaSelecionadaId);
    },
    enabled: !!empresaSelecionadaId
  });

  // Buscar movimento de estoque vinculado ao abastecimento em edição (para reverter)
  const { data: movimentoAntigo = [] } = useQuery({
    queryKey: ["movimento-abastecimento", abastecimento?.id],
    queryFn: async () => {
      if (!abastecimento?.id) return [];
      const porRef = abastecimento.referencia_movimentacao
        ? await base44.entities.MovimentacaoEstoque.filter({ referencia_movimentacao: abastecimento.referencia_movimentacao })
        : [];
      const todas = await base44.entities.MovimentacaoEstoque.list();
      const porObs = todas.filter((m) => m.observacoes === `Saída automática por abastecimento ${abastecimento.id}`);
      const movs = [...porRef];
      porObs.forEach((m) => { if (!movs.find((x) => x.id === m.id)) movs.push(m); });
      return movs;
    },
    enabled: !!abastecimento?.id
  });

  const lotesConsumidosAntigo = useMemo(
    () => (movimentoAntigo || []).flatMap((m) => m.lotes_consumidos || []),
    [movimentoAntigo]
  );

  // Lotes efetivos: ao editar, adiciona de volta as quantidades consumidas no lançamento original
  const lotesEstoqueEfetivo = useMemo(() => {
    if (!abastecimento || lotesConsumidosAntigo.length === 0) return lotesEstoque;
    return lotesEstoque.map((l) => {
      const consumidoAntigo = lotesConsumidosAntigo
        .filter((oc) => oc.lote_id === l.id)
        .reduce((acc, oc) => acc + (oc.quantidade_consumida || 0), 0);
      return consumidoAntigo > 0
        ? { ...l, quantidade_disponivel: (l.quantidade_disponivel || 0) + consumidoAntigo }
        : l;
    });
  }, [lotesEstoque, lotesConsumidosAntigo, abastecimento]);

  // Buscar todos os abastecimentos do ativo para pegar o último
  const { data: abastecimentosDoAtivo = [] } = useQuery({
    queryKey: ["abastecimentos-ativo", empresaSelecionadaId, formData.maquina_id],
    queryFn: async () => {
      const all = await base44.entities.AbastecimentoMaquina.list("-data_abastecimento");
      return all.filter((a) => a.empresa_id === empresaSelecionadaId && a.maquina_id === formData.maquina_id && a.medicao != null);
    },
    enabled: !!empresaSelecionadaId && !!formData.maquina_id
  });

  // ========== DERIVADOS ==========

  const maquinaSelecionada = useMemo(() => maquinas.find((m) => m.id === formData.maquina_id), [maquinas, formData.maquina_id]);

  const produtosCombustivelIds = useMemo(() => {
    if (!maquinaSelecionada) return [];
    return (maquinaSelecionada.produtos_combustiveis_vinculados || []).map((v) => v.produto_id);
  }, [maquinaSelecionada]);

  // Locais que têm saldo dos combustíveis vinculados ao ativo
  const locaisFiltrados = useMemo(() => {
    if (produtosCombustivelIds.length === 0) return [];
    const locaisComSaldo = new Set();
    lotesEstoqueEfetivo.forEach((lote) => {
      if (produtosCombustivelIds.includes(lote.produto_id) && (lote.quantidade_disponivel || 0) > 0) {
        locaisComSaldo.add(lote.local_estoque_id);
      }
    });
    return locais.filter((l) => locaisComSaldo.has(l.id));
  }, [locais, lotesEstoqueEfetivo, produtosCombustivelIds]);

  // Produtos disponíveis = combustíveis vinculados ao ativo que possuem saldo no local selecionado
  const produtosDisponiveis = useMemo(() => {
    if (!formData.local_estoque_id || produtosCombustivelIds.length === 0) return [];
    const produtosComSaldo = new Set();
    lotesEstoqueEfetivo.forEach((lote) => {
      if (lote.local_estoque_id === formData.local_estoque_id && produtosCombustivelIds.includes(lote.produto_id) && (lote.quantidade_disponivel || 0) > 0) {
        produtosComSaldo.add(lote.produto_id);
      }
    });
    return todosProdutos.filter((p) => produtosComSaldo.has(p.id));
  }, [todosProdutos, lotesEstoqueEfetivo, formData.local_estoque_id, produtosCombustivelIds]);

  const custoFifoPreview = useMemo(() => {
    const quantidade = Number(formData.quantidade_litros || 0);
    if (!formData.produto_id || !formData.local_estoque_id || quantidade <= 0) {
      return { valorUnitario: 0, valorTotal: 0, saldoInsuficiente: false };
    }

    const lotesLocal = lotesEstoqueEfetivo
      .filter((l) => l.produto_id === formData.produto_id && l.local_estoque_id === formData.local_estoque_id)
      .sort((a, b) => new Date(a.data_documento || a.created_date) - new Date(b.data_documento || b.created_date));

    let restante = quantidade;
    let total = 0;

    for (const lote of lotesLocal) {
      if (restante <= 0) break;
      const consumir = Math.min(lote.quantidade_disponivel || 0, restante);
      total += consumir * (lote.custo_unitario || 0);
      restante -= consumir;
    }

    const quantidadeConsumida = quantidade - restante;
    const unitario = quantidadeConsumida > 0 ? total / quantidadeConsumida : 0;

    return {
      valorUnitario: Number(unitario.toFixed(4)),
      valorTotal: Number(total.toFixed(2)),
      saldoInsuficiente: restante > 0,
    };
  }, [formData.produto_id, formData.local_estoque_id, formData.quantidade_litros, lotesEstoqueEfetivo]);

  const tiposFiltrados = useMemo(() => {
    if (!formData.grupo_atividade_id) return [];
    return tiposTarefa.filter((t) => t.grupo_atividade_id === formData.grupo_atividade_id);
  }, [tiposTarefa, formData.grupo_atividade_id]);

  // Último abastecimento do ativo (para calcular consumo)
  const ultimoAbastecimento = useMemo(() => {
    if (abastecimentosDoAtivo.length === 0) return null;
    // Se estamos editando, ignorar o próprio registro
    const filtrados = abastecimento?.id ?
    abastecimentosDoAtivo.filter((a) => a.id !== abastecimento.id) :
    abastecimentosDoAtivo;
    return filtrados[0] || null;
  }, [abastecimentosDoAtivo, abastecimento?.id]);

  const medicaoAnterior = ultimoAbastecimento?.medicao || null;

  // Cálculo de consumo em tempo real
  const consumoPreview = useMemo(() => {
    if (!maquinaSelecionada || maquinaSelecionada.tipo_medicao === "Nenhum") return null;
    if (medicaoAnterior == null) return null;
    return calcularConsumo({
      medicaoAnterior,
      medicaoAtual: Number(formData.medicao || 0),
      litros: Number(formData.quantidade_litros || 0)
    });
  }, [maquinaSelecionada, medicaoAnterior, formData.medicao, formData.quantidade_litros]);

  // Média dos últimos 3 abastecimentos
  const consumoMedio = useMemo(() => {
    if (!maquinaSelecionada || maquinaSelecionada.tipo_medicao === "Nenhum") return null;
    const filtrados = abastecimento?.id ?
    abastecimentosDoAtivo.filter((a) => a.id !== abastecimento.id) :
    abastecimentosDoAtivo;
    // Pegar os últimos 3 que tenham medicao_anterior
    const comAnterior = filtrados.filter((a) => a.medicao_anterior != null).slice(0, 3);
    return calcularConsumoMedio(comAnterior);
  }, [abastecimentosDoAtivo, maquinaSelecionada, abastecimento?.id]);

  const unidadeConsumo = maquinaSelecionada?.tipo_medicao === "Horímetro" ? "L/H" : "L/KM";

  // ========== EFEITOS ==========

  useEffect(() => {
    if (!abastecimento) {
      setFormData((prev) => ({ ...prev, produto_id: "", medicao: "" }));
    }
  }, [formData.maquina_id]);

  useEffect(() => {
    if (!formData.local_estoque_id) {
      setFormData((prev) => ({ ...prev, produto_id: "" }));
      return;
    }
    if (!abastecimento) {
      if (produtosDisponiveis.length === 1) {
        setFormData((prev) => ({ ...prev, produto_id: produtosDisponiveis[0].id }));
      } else {
        const vinculados = maquinaSelecionada?.produtos_combustiveis_vinculados || [];
        const principal = vinculados.find((v) => v.principal);
        if (principal && produtosDisponiveis.find((p) => p.id === principal.produto_id)) {
          setFormData((prev) => ({ ...prev, produto_id: principal.produto_id }));
        } else {
          setFormData((prev) => ({ ...prev, produto_id: "" }));
        }
      }
    }
  }, [formData.local_estoque_id, produtosDisponiveis.length]);

  useEffect(() => {
    if (!abastecimento) {
      setFormData((prev) => ({ ...prev, tipo_servico: "" }));
    }
  }, [formData.grupo_atividade_id]);

  useEffect(() => {
    if (!empresaSelecionadaId || !formData.produto_id || !formData.local_estoque_id) {
      setSaldoDisponivel(null);
      return;
    }
    const saldo = lotesEstoqueEfetivo.
    filter((l) => l.produto_id === formData.produto_id && l.local_estoque_id === formData.local_estoque_id).
    reduce((acc, l) => acc + (l.quantidade_disponivel || 0), 0);
    setSaldoDisponivel(saldo);
  }, [empresaSelecionadaId, formData.produto_id, formData.local_estoque_id, lotesEstoqueEfetivo]);

  // ========== MUTATION ==========

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (!maquinaSelecionada) throw new Error("Selecione um ativo");
      const produtoSelecionado = todosProdutos.find((p) => p.id === data.produto_id);
      if (!produtoSelecionado) throw new Error("Produto não encontrado");

      const quantidade = Number(data.quantidade_litros);
      if (quantidade <= 0) throw new Error("Quantidade deve ser maior que zero");
      if ((saldoDisponivel || 0) < quantidade) throw new Error("Saldo insuficiente no local selecionado");

      const novaMedicao = Number(data.medicao || 0);
      const isEdit = !!abastecimento?.id;

      // Validação de medição com base no último abastecimento
      if (maquinaSelecionada.tipo_medicao !== "Nenhum") {
        if (medicaoAnterior != null && novaMedicao <= medicaoAnterior) {
          throw new Error(`Nova medição (${novaMedicao}) deve ser maior que a última medição (${medicaoAnterior})`);
        }
      }

      // Se editando, reverter o movimento de estoque antigo antes de refazer
      if (isEdit) {
        // Bloquear edição se houver abastecimentos mais recentes (corromperia a cadeia de consumo)
        if (maquinaSelecionada.tipo_medicao !== "Nenhum") {
          const maisRecentes = abastecimentosDoAtivo.filter(
            (a) => a.id !== abastecimento.id &&
              new Date(a.data_abastecimento) > new Date(abastecimento.data_abastecimento)
          );
          if (maisRecentes.length > 0) {
            throw new Error("Não é possível editar: existem abastecimentos mais recentes para este ativo. Exclua os registros mais novos primeiro.");
          }
        }

        const porRef = abastecimento.referencia_movimentacao
          ? await base44.entities.MovimentacaoEstoque.filter({ referencia_movimentacao: abastecimento.referencia_movimentacao })
          : [];
        const todas = await base44.entities.MovimentacaoEstoque.list();
        const porObs = todas.filter((m) => m.observacoes === `Saída automática por abastecimento ${abastecimento.id}`);
        const movsAntigas = [...porRef];
        porObs.forEach((m) => { if (!movsAntigas.find((x) => x.id === m.id)) movsAntigas.push(m); });

        for (const mov of movsAntigas) {
          for (const lote of mov.lotes_consumidos || []) {
            const loteAtual = await base44.entities.EstoqueLoteNota.get(lote.lote_id);
            await base44.entities.EstoqueLoteNota.update(lote.lote_id, {
              quantidade_disponivel: (loteAtual.quantidade_disponivel || 0) + (lote.quantidade_consumida || 0),
              status: "Disponivel"
            });
          }
          await base44.entities.MovimentacaoEstoque.delete(mov.id);
        }
      }

      // Calcular consumo
      let consumoData = { medicao_anterior: null, uso_realizado: null, consumo_calculado: null };
      if (maquinaSelecionada.tipo_medicao !== "Nenhum" && medicaoAnterior != null) {
        const resultado = calcularConsumo({
          medicaoAnterior,
          medicaoAtual: novaMedicao,
          litros: quantidade
        });
        if (resultado) {
          consumoData = {
            medicao_anterior: medicaoAnterior,
            uso_realizado: resultado.uso,
            consumo_calculado: resultado.confiavel ? resultado.consumo : null
          };
        }
      }

      // FIFO (sobre lotes efetivos, já considerando a reversão ao editar)
      const lotesLocal = lotesEstoqueEfetivo.
      filter((l) => l.produto_id === data.produto_id && l.local_estoque_id === data.local_estoque_id).
      sort((a, b) => new Date(a.data_documento || a.created_date) - new Date(b.data_documento || b.created_date));

      let restante = quantidade;
      const lotesConsumidos = [];
      for (const lote of lotesLocal) {
        if (restante <= 0) break;
        const consumir = Math.min(lote.quantidade_disponivel || 0, restante);
        if (consumir > 0) {
          lotesConsumidos.push({
            lote_id: lote.id,
            numero_documento: lote.numero_documento,
            fornecedor_nome: lote.fornecedor_nome,
            quantidade_consumida: consumir,
            custo_unitario: lote.custo_unitario
          });
          restante -= consumir;
        }
      }
      if (restante > 0) throw new Error("Não foi possível aplicar FIFO para toda a quantidade");

      const valorTotalSaida = lotesConsumidos.reduce((acc, item) => acc + ((item.quantidade_consumida || 0) * (item.custo_unitario || 0)), 0);
      const valorUnitarioSaida = quantidade > 0 ? valorTotalSaida / quantidade : 0;
      const referenciaMovimentacao = crypto.randomUUID();

      const grupoSel = gruposAtividade.find((g) => g.id === data.grupo_atividade_id);
      const localEstoqueSel = locais.find((l) => l.id === data.local_estoque_id);

      const payloadAbast = {
        empresa_id: empresaSelecionadaId,
        maquina_id: maquinaSelecionada.id,
        maquina_nome: maquinaSelecionada.nome,
        produto_id: produtoSelecionado.id,
        produto_nome: produtoSelecionado.nome_produto,
        data_abastecimento: data.data_abastecimento,
        quantidade_litros: quantidade,
        valor_litro: Number(valorUnitarioSaida.toFixed(4)),
        valor_total: Number(valorTotalSaida.toFixed(2)),
        medicao: maquinaSelecionada.tipo_medicao !== "Nenhum" ? novaMedicao : null,
        medicao_anterior: consumoData.medicao_anterior,
        uso_realizado: consumoData.uso_realizado,
        consumo_calculado: consumoData.consumo_calculado,
        operador: data.responsavel,
        observacoes: data.observacoes || "",
        local_estoque_id: data.local_estoque_id,
        local_estoque_nome: localEstoqueSel?.nome || "",
        grupo_atividade_id: data.grupo_atividade_id,
        grupo_atividade_nome: grupoSel?.nome_grupo || "",
        tipo_servico: data.tipo_servico,
        responsavel: data.responsavel,
        referencia_movimentacao: referenciaMovimentacao
      };

      let abastecimentoSalvo;
      if (isEdit) {
        abastecimentoSalvo = await base44.entities.AbastecimentoMaquina.update(abastecimento.id, payloadAbast);
      } else {
        abastecimentoSalvo = await base44.entities.AbastecimentoMaquina.create(payloadAbast);
      }

      await base44.entities.MovimentacaoEstoque.create({
        empresa_id: empresaSelecionadaId,
        tipo_movimentacao: "Saída",
        tipo_detalhado: "ABASTECIMENTO",
        data_movimentacao: new Date(`${data.data_abastecimento}T12:00:00`).toISOString(),
        data_documento: data.data_abastecimento,
        produto_id: produtoSelecionado.id,
        produto_nome: produtoSelecionado.nome_produto,
        quantidade,
        valor_unitario: Number(valorUnitarioSaida.toFixed(4)),
        valor_total: Number(valorTotalSaida.toFixed(2)),
        unidade_medida: produtoSelecionado.unidade_medida || "LT",
        local_estoque_origem: data.local_estoque_id,
        local_origem: localEstoqueSel?.nome || "",
        maquina_vinculada_id: maquinaSelecionada.id,
        maquina_vinculada_nome: maquinaSelecionada.nome,
        vinculado: true,
        tipo_vinculo: "maquina",
        lotes_consumidos: lotesConsumidos,
        referencia_movimentacao: referenciaMovimentacao,
        observacoes: `Saída automática por abastecimento ${abastecimentoSalvo.id}`,
        status: "Ativa",
        origem_sistema: "manual",
        is_registro_principal: true,
        numero_movimentacao_seq: 1,
        total_movimentacoes_grupo: 1,
        bloqueado_exclusao_estoque: true,
        exclusao_somente_em: "estoque"
      });

      for (const item of lotesConsumidos) {
        const lote = lotesLocal.find((l) => l.id === item.lote_id);
        const novaQtd = (lote.quantidade_disponivel || 0) - item.quantidade_consumida;
        await base44.entities.EstoqueLoteNota.update(item.lote_id, {
          quantidade_disponivel: novaQtd,
          status: novaQtd > 0 ? "Disponivel" : "Esgotado"
        });
      }

      if (maquinaSelecionada.tipo_medicao !== "Nenhum") {
        await base44.entities.Maquina.update(maquinaSelecionada.id, { medicao_atual: novaMedicao });
      }

      return abastecimentoSalvo;
    },
    onSuccess: () => {
      toast.success(abastecimento?.id ? "Abastecimento atualizado com sucesso" : "Abastecimento lançado com sucesso");
      onSave();
    },
    onError: (error) => toast.error(error.message)
  });

  // ========== SUBMIT ==========

  const handleSubmit = (e) => {
    e.preventDefault();
    const missing = [];
    if (!formData.data_abastecimento) missing.push("data_abastecimento");
    if (!formData.maquina_id) missing.push("maquina_id");
    if (!formData.grupo_atividade_id) missing.push("grupo_atividade_id");
    if (!formData.tipo_servico) missing.push("tipo_servico");
    if (!formData.responsavel) missing.push("responsavel");
    if (!formData.local_estoque_id) missing.push("local_estoque_id");
    if (!formData.produto_id) missing.push("produto_id");
    if (!formData.quantidade_litros) missing.push("quantidade_litros");
    if (maquinaSelecionada?.tipo_medicao !== "Nenhum" && !formData.medicao) missing.push("medicao");

    if (missing.length > 0) {
      setInvalidFields(missing);
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    if (custoFifoPreview.saldoInsuficiente) {
      toast.error("Não foi possível calcular o FIFO para toda a quantidade informada");
      return;
    }
    mutation.mutate(formData);
  };

  // ========== RENDER ==========

  const temMedicao = maquinaSelecionada && maquinaSelecionada.tipo_medicao !== "Nenhum";

  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
      <form onSubmit={handleSubmit} className="space-y-1">

        <Card className="shadow-sm border-slate-300">
          <CardHeader className="flex flex-col space-y-1.5 p-6 bg-slate-50 border-b py-1 px-1">
            <CardTitle className="text-sm font-semibold text-slate-900 uppercase">
              {abastecimento ? "Editar Lançamento de Abastecimento" : "Lançamento de Abastecimento"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-1 space-y-1" style={{ maxHeight: 'calc(100vh - 170px)', overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}>

            {/* Linha 1: Data | Ativo | Grupo | Tipo Serviço */}
            <div className="grid grid-cols-2 lg:grid-cols-12 gap-1">
              <div className="lg:col-span-2">
                <FL label="Data" required error={invalidFields.includes("data_abastecimento")}>
                  <Input type="date" value={formData.data_abastecimento} onChange={(e) => handleChange("data_abastecimento", e.target.value)} className={INPUT_CLS} />
                </FL>
              </div>
              <div className="lg:col-span-4">
                <FL label="Ativo" required error={invalidFields.includes("maquina_id")}>
                  <AutocompleteGenerico items={maquinas} value={formData.maquina_id} onChange={(v) => handleChange("maquina_id", v)} placeholder="BUSCAR ATIVO..." displayField="nome" searchFields={["nome", "codigo", "placa", "identificador_curto"]} className="w-full" inputClassName={AC_INPUT_CLS} renderSubtext={(item) => [item.categoria, item.placa].filter(Boolean).join(" | ")} />
                </FL>
              </div>
              <div className="lg:col-span-3">
                <FL label="Grupo de Atividade" required error={invalidFields.includes("grupo_atividade_id")}>
                  <AutocompleteGenerico items={gruposAtividade} value={formData.grupo_atividade_id} onChange={(v) => handleChange("grupo_atividade_id", v)} placeholder="BUSCAR GRUPO..." displayField="nome_grupo" searchFields={["nome_grupo"]} className="w-full" inputClassName={AC_INPUT_CLS} />
                </FL>
              </div>
              <div className="lg:col-span-3">
                <FL label="Tipo de Serviço" required error={invalidFields.includes("tipo_servico")}>
                  <AutocompleteGenerico items={tiposFiltrados} value={tiposFiltrados.find((t) => t.nome_tipo === formData.tipo_servico)?.id || ""} onChange={(v) => {const tipo = tiposFiltrados.find((t) => t.id === v);handleChange("tipo_servico", tipo?.nome_tipo || "");}} placeholder={!formData.grupo_atividade_id ? "SELECIONE O GRUPO" : "BUSCAR TIPO..."} displayField="nome_tipo" searchFields={["nome_tipo"]} className="w-full" inputClassName={AC_INPUT_CLS} />
                </FL>
              </div>
            </div>

            {/* Linha 2: Responsável | Local Estoque | Produto | Saldo | Quantidade */}
            <div className="grid grid-cols-2 lg:grid-cols-12 gap-1">
              <div className="lg:col-span-4">
                <FL label="Responsável" required error={invalidFields.includes("responsavel")}>
                  <Input value={formData.responsavel} onChange={(e) => handleChange("responsavel", e.target.value.toUpperCase())} className={`${INPUT_CLS} uppercase`} style={{ textTransform: "uppercase" }} placeholder="DIGITE O RESPONSÁVEL" />
                </FL>
              </div>
            </div>

            {/* Linha 3: Local Estoque | Produto | Saldo | Quantidade | Valores FIFO */}
            <div className="grid grid-cols-2 lg:grid-cols-12 gap-1">
              <div className="lg:col-span-3">
                <FL label="Local de Estoque (Origem)" required error={invalidFields.includes("local_estoque_id")}>
                  <AutocompleteGenerico items={locaisFiltrados} value={formData.local_estoque_id} onChange={(v) => handleChange("local_estoque_id", v)} placeholder={!maquinaSelecionada ? "SELECIONE O ATIVO" : "BUSCAR LOCAL..."} displayField="nome" searchFields={["nome", "descricao"]} className="w-full" inputClassName={AC_INPUT_CLS} />
                </FL>
              </div>
              <div className="lg:col-span-3">
                <FL label="Produto Combustível" required error={invalidFields.includes("produto_id")}>
                  <AutocompleteGenerico items={produtosDisponiveis} value={formData.produto_id} onChange={(v) => handleChange("produto_id", v)} placeholder={!formData.local_estoque_id ? "SELECIONE O LOCAL" : !maquinaSelecionada ? "SELECIONE O ATIVO" : "BUSCAR PRODUTO..."} displayField="nome_produto" searchFields={["nome_produto", "codigo_interno"]} className="w-full" inputClassName={AC_INPUT_CLS} renderSubtext={(item) => item.unidade_medida || ""} />
                </FL>
              </div>
              <div className="lg:col-span-2">
                <FL label="Saldo Atual">
                  <Input readOnly value={saldoDisponivel == null ? "" : saldoDisponivel.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} className={READONLY_CLS} />
                </FL>
              </div>
              <div className="lg:col-span-2">
                <FL label="Quantidade Abastecimento" required error={invalidFields.includes("quantidade_litros")}>
                  <Input type="number" step="0.01" min="0.01" value={formData.quantidade_litros} onChange={(e) => handleChange("quantidade_litros", e.target.value)} className={INPUT_CLS} placeholder="0,00" />
                </FL>
              </div>
              <div className="lg:col-span-1">
                <FL label="Vlr. Unitário">
                  <Input readOnly value={custoFifoPreview.valorUnitario.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} className={READONLY_CLS} />
                </FL>
              </div>
              <div className="lg:col-span-1">
                <FL label="Vlr. Total">
                  <Input readOnly value={custoFifoPreview.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} className={READONLY_CLS} />
                </FL>
              </div>
            </div>

            {/* Linha 4: Medição */}
            {temMedicao &&
            <>
                <div className="grid grid-cols-2 lg:grid-cols-12 gap-1">
                  <div className="lg:col-span-2">
                    <FL label="Última Medição">
                      <Input readOnly value={medicaoAnterior != null ? medicaoAnterior : "Sem anterior"} className={READONLY_CLS} />
                    </FL>
                  </div>
                  <div className="lg:col-span-2">
                    <FL label="Nova Medição" required error={invalidFields.includes("medicao")}>
                      <Input type="number" step="0.01" value={formData.medicao} onChange={(e) => handleChange("medicao", e.target.value)} className={INPUT_CLS} />
                    </FL>
                  </div>
                  <div className="lg:col-span-2">
                    <FL label={`Uso (${maquinaSelecionada.tipo_medicao === "Horímetro" ? "Horas" : "KM"})`}>
                      <Input readOnly value={consumoPreview ? consumoPreview.uso : ""} className={READONLY_CLS} />
                    </FL>
                  </div>
                  <div className="lg:col-span-3">
                    <FL label={`Consumo Atual (${unidadeConsumo})`}>
                      <Input
                      readOnly
                      value={
                      consumoPreview ?
                      consumoPreview.confiavel ?
                      consumoPreview.consumo :
                      `${consumoPreview.consumo} ⚠` :
                      medicaoAnterior == null ? "Sem anterior" : ""
                      }
                      className={`${READONLY_CLS} ${consumoPreview && !consumoPreview.confiavel ? "text-amber-600 font-semibold" : ""}`} />
                    
                    </FL>
                  </div>
                  <div className="lg:col-span-3">
                    <FL label={`Média Últ. 3 (${unidadeConsumo})`}>
                      <Input readOnly value={consumoMedio != null ? consumoMedio : "Sem histórico"} className={`${READONLY_CLS} font-semibold text-emerald-700`} />
                    </FL>
                  </div>
                </div>
                



              
              </>
            }

            {/* Observações */}
            <FL label="Observações">
              <Textarea value={formData.observacoes} onChange={(e) => handleChange("observacoes", e.target.value.toUpperCase())} placeholder="OBSERVAÇÕES..." className="text-xs uppercase border-0 shadow-none focus-visible:ring-0 bg-transparent min-h-[36px]" style={{ textTransform: "uppercase" }} rows={1} />
            </FL>

          </CardContent>
        </Card>

        {/* Botões */}
        <div className="flex flex-col-reverse lg:flex-row justify-end gap-1 pt-1 border-t">
          <Button type="button" variant="outline" onClick={onCancel} size="sm" className="h-7 text-xs">Cancelar</Button>
          <Button type="submit" disabled={mutation.isPending} size="sm" className="h-7 text-xs px-3 bg-emerald-600 hover:bg-emerald-700 text-white">
            {mutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </motion.div>);

}