import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Printer, Filter, X, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import AutocompleteGenerico from "../components/financeiro/AutocompleteGenerico";
import { getLocalEstoque, getLabelOperacao, toValue } from "../components/movimentacoes/utils/movimentacaoUtils";

// ========== CONSTANTES ==========
const MODELOS_RELATORIO = [
  { value: 'saldo_atual', label: 'Saldo Atual de Estoque', grupo: 'Estoque' },
  { value: 'saldo_simples', label: 'Saldo Simples por Produto', grupo: 'Estoque' },
  { value: 'estoque_lote', label: 'Estoque por Lote/Nota (FIFO)', grupo: 'Estoque' },
  { value: 'extrato_movimentacoes', label: 'Extrato de Movimentações', grupo: 'Movimentações' },
  { value: 'resumo_movimentacoes', label: 'Resumo de Movimentações por Produto', grupo: 'Movimentações' },
  { value: 'transferencias', label: 'Transferências', grupo: 'Movimentações' },
  { value: 'ajustes', label: 'Ajustes de Estoque', grupo: 'Movimentações' },
  { value: 'consumo_periodo', label: 'Consumo por Período', grupo: 'Consumo/Custos' },
  { value: 'perdas_quebras', label: 'Perdas e Quebras', grupo: 'Perdas' },
  { value: 'entradas_fornecedor', label: 'Entradas por Fornecedor', grupo: 'Compras/Entradas' },
  { value: 'kardex', label: 'Kardex do Produto', grupo: 'Auditoria' },
];

const formatarNumero = (num, decimais = 2) => {
  if (num === null || num === undefined || isNaN(num)) return "0,00";
  return Number(num).toLocaleString('pt-BR', { minimumFractionDigits: decimais, maximumFractionDigits: decimais });
};

const formatarMoeda = (valor) => {
  if (valor === null || valor === undefined || isNaN(valor)) return "R$ 0,00";
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatarData = (dataString) => {
  if (!dataString) return '-';
  try {
    return format(new Date(dataString), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return '-';
  }
};

const formatarDataHora = (dataString) => {
  if (!dataString) return '-';
  try {
    return format(new Date(dataString), 'dd/MM/yyyy HH:mm', { locale: ptBR });
  } catch {
    return '-';
  }
};

export default function RelatoriosEstoque() {
  const empresaId = localStorage.getItem('empresa_selecionada_id');

  // ========== ESTADOS ==========
  const [modeloRelatorio, setModeloRelatorio] = useState('saldo_atual');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [produtoId, setProdutoId] = useState('');
  const [localEstoqueId, setLocalEstoqueId] = useState('');
  const [fornecedorId, setFornecedorId] = useState('');
  const [centroCustoId, setCentroCustoId] = useState('');
  const [tipoVinculo, setTipoVinculo] = useState('');
  const [apenasComSaldo, setApenasComSaldo] = useState(true);
  const [orientacao, setOrientacao] = useState('paisagem');

  // ========== QUERIES ==========
  const { data: empresaAtual } = useQuery({
    queryKey: ['empresa-rel', empresaId],
    queryFn: async () => {
      const empresas = await base44.entities.Empresa.list();
      return empresas.find(e => e.id === empresaId) || null;
    },
    enabled: !!empresaId,
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos-rel', empresaId],
    queryFn: async () => {
      const all = await base44.entities.Produto.list();
      return all.filter(p => p.empresa_id === empresaId);
    },
    enabled: !!empresaId,
  });

  const { data: locais = [] } = useQuery({
    queryKey: ['locais-rel'],
    queryFn: () => base44.entities.LocalEstoque.list(),
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ['fornecedores-rel', empresaId],
    queryFn: async () => {
      const all = await base44.entities.Fornecedor.list();
      return all.filter(f => f.empresa_id === empresaId);
    },
    enabled: !!empresaId,
  });

  const { data: centrosCusto = [] } = useQuery({
    queryKey: ['centros-rel', empresaId],
    queryFn: async () => {
      const all = await base44.entities.CentroCusto.list();
      return all.filter(c => c.empresa_id === empresaId && c.ativo !== false);
    },
    enabled: !!empresaId,
  });

  const { data: lotesNota = [] } = useQuery({
    queryKey: ['lotes-nota-rel', empresaId],
    queryFn: async () => {
      const all = await base44.entities.EstoqueLoteNota.list();
      return all.filter(l => l.empresa_id === empresaId);
    },
    enabled: !!empresaId,
  });

  const { data: movimentacoes = [] } = useQuery({
    queryKey: ['movimentacoes-rel', empresaId],
    queryFn: async () => {
      const all = await base44.entities.MovimentacaoEstoque.list('-data_movimentacao');
      return all.filter(m => m.empresa_id === empresaId && m.status === 'Ativa');
    },
    enabled: !!empresaId,
  });

  // ========== DADOS PROCESSADOS ==========
  const dadosRelatorio = useMemo(() => {
    // Filtro de data
    const filtrarPorData = (items, campoData = 'data_movimentacao') => {
      return items.filter(item => {
        if (dataInicio) {
          const itemDate = new Date(item[campoData]);
          const inicioDate = new Date(dataInicio);
          inicioDate.setHours(0, 0, 0, 0);
          if (itemDate < inicioDate) return false;
        }
        if (dataFim) {
          const itemDate = new Date(item[campoData]);
          const fimDate = new Date(dataFim);
          fimDate.setHours(23, 59, 59, 999);
          if (itemDate > fimDate) return false;
        }
        return true;
      });
    };

    const isEntradaMov = (mov) => mov.tipo_movimentacao === 'Entrada' || (mov.tipo_movimentacao === 'Ajuste' && toValue(mov.tipo_detalhado || '').includes('ajuste_positivo'));
    const isSaidaMov = (mov) => mov.tipo_movimentacao === 'Saída' || (mov.tipo_movimentacao === 'Ajuste' && !toValue(mov.tipo_detalhado || '').includes('ajuste_positivo'));
    const filtrarMovimentacaoPorLocal = (mov) => {
      if (!localEstoqueId) return true;
      return mov.local_estoque_origem === localEstoqueId || mov.local_estoque_destino === localEstoqueId;
    };

    switch (modeloRelatorio) {
      case 'saldo_atual': {
        // Agrupar lotes por produto+local
        const saldos = {};
        lotesNota.filter(l => l.status === 'Disponivel').forEach(l => {
          const key = `${l.produto_id}_${l.local_estoque_id}`;
          if (!saldos[key]) {
            const prod = produtos.find(p => p.id === l.produto_id);
            saldos[key] = {
              produto_id: l.produto_id,
              produto_nome: l.produto_nome || prod?.nome_produto,
              produto_codigo: prod?.codigo_interno,
              categoria: prod?.categoria,
              local_nome: l.local_estoque_nome,
              unidade: prod?.unidade_medida || 'UN',
              quantidade: 0,
              valor_total: 0
            };
          }
          saldos[key].quantidade += l.quantidade_disponivel || 0;
          saldos[key].valor_total += (l.quantidade_disponivel || 0) * (l.custo_unitario || 0);
        });

        let resultado = Object.values(saldos);
        
        // Filtros
        if (localEstoqueId) resultado = resultado.filter(r => lotesNota.some(l => l.produto_id === r.produto_id && l.local_estoque_id === localEstoqueId));
        if (apenasComSaldo) resultado = resultado.filter(r => r.quantidade > 0);

        return resultado.map(r => ({
          ...r,
          custo_medio: r.quantidade > 0 ? r.valor_total / r.quantidade : 0
        })).sort((a, b) => (a.produto_nome || '').localeCompare(b.produto_nome || ''));
      }

      case 'saldo_simples': {
        const saldosAtuais = {};
        lotesNota
          .filter(l => l.status === 'Disponivel')
          .filter(l => !produtoId || l.produto_id === produtoId)
          .filter(l => !localEstoqueId || l.local_estoque_id === localEstoqueId)
          .forEach(l => {
            if (!saldosAtuais[l.produto_id]) saldosAtuais[l.produto_id] = { quantidade: 0, valor: 0 };
            saldosAtuais[l.produto_id].quantidade += l.quantidade_disponivel || 0;
            saldosAtuais[l.produto_id].valor += (l.quantidade_disponivel || 0) * (l.custo_unitario || 0);
          });

        const resumo = {};
        const movs = movimentacoes
          .filter(m => !produtoId || m.produto_id === produtoId)
          .filter(filtrarMovimentacaoPorLocal);

        const produtosBase = produtos.filter(p => !produtoId || p.id === produtoId);
        produtosBase.forEach(prod => {
          resumo[prod.id] = {
            produto_id: prod.id,
            produto_nome: prod.nome_produto,
            produto_codigo: prod.codigo_interno || prod.numero_produto,
            categoria: prod.categoria,
            unidade: prod.unidade_medida || 'UN',
            qtd_entradas: 0,
            valor_entradas: 0,
            qtd_saidas: 0,
            valor_saidas: 0,
            saldo_atual: saldosAtuais[prod.id]?.quantidade || 0,
            valor_saldo: saldosAtuais[prod.id]?.valor || 0,
          };
        });

        movs.forEach(m => {
          if (!resumo[m.produto_id]) {
            const prod = produtos.find(p => p.id === m.produto_id);
            resumo[m.produto_id] = {
              produto_id: m.produto_id,
              produto_nome: m.produto_nome || prod?.nome_produto,
              produto_codigo: m.produto_codigo || prod?.codigo_interno || prod?.numero_produto,
              categoria: m.produto_categoria || prod?.categoria,
              unidade: m.unidade_medida || prod?.unidade_medida || 'UN',
              qtd_entradas: 0,
              valor_entradas: 0,
              qtd_saidas: 0,
              valor_saidas: 0,
              saldo_atual: saldosAtuais[m.produto_id]?.quantidade || 0,
              valor_saldo: saldosAtuais[m.produto_id]?.valor || 0,
            };
          }
          if (isEntradaMov(m)) {
            resumo[m.produto_id].qtd_entradas += m.quantidade || 0;
            resumo[m.produto_id].valor_entradas += m.valor_total || 0;
          }
          if (isSaidaMov(m)) {
            resumo[m.produto_id].qtd_saidas += m.quantidade || 0;
            resumo[m.produto_id].valor_saidas += m.valor_total || 0;
          }
        });

        let resultado = Object.values(resumo);
        if (apenasComSaldo) resultado = resultado.filter(r => r.saldo_atual > 0);
        return resultado.sort((a, b) => (a.produto_nome || '').localeCompare(b.produto_nome || ''));
      }

      case 'resumo_movimentacoes': {
        let movs = filtrarPorData(movimentacoes).filter(filtrarMovimentacaoPorLocal);
        if (produtoId) movs = movs.filter(m => m.produto_id === produtoId);
        if (fornecedorId) movs = movs.filter(m => m.fornecedor_id === fornecedorId);

        const resumo = {};
        movs.forEach(m => {
          const prod = produtos.find(p => p.id === m.produto_id);
          if (!resumo[m.produto_id]) {
            resumo[m.produto_id] = {
              produto_id: m.produto_id,
              produto_nome: m.produto_nome || prod?.nome_produto,
              produto_codigo: m.produto_codigo || prod?.codigo_interno || prod?.numero_produto,
              categoria: m.produto_categoria || prod?.categoria,
              unidade: m.unidade_medida || prod?.unidade_medida || 'UN',
              qtd_entradas: 0,
              valor_entradas: 0,
              qtd_saidas: 0,
              valor_saidas: 0,
              saldo_atual: 0,
              valor_saldo: 0,
            };
          }
          if (isEntradaMov(m)) {
            resumo[m.produto_id].qtd_entradas += m.quantidade || 0;
            resumo[m.produto_id].valor_entradas += m.valor_total || 0;
          }
          if (isSaidaMov(m)) {
            resumo[m.produto_id].qtd_saidas += m.quantidade || 0;
            resumo[m.produto_id].valor_saidas += m.valor_total || 0;
          }
          resumo[m.produto_id].saldo_atual = resumo[m.produto_id].qtd_entradas - resumo[m.produto_id].qtd_saidas;
          resumo[m.produto_id].valor_saldo = resumo[m.produto_id].valor_entradas - resumo[m.produto_id].valor_saidas;
        });

        return Object.values(resumo).sort((a, b) => (a.produto_nome || '').localeCompare(b.produto_nome || ''));
      }

      case 'estoque_lote': {
        let lotes = lotesNota.filter(l => l.status === 'Disponivel');
        if (localEstoqueId) lotes = lotes.filter(l => l.local_estoque_id === localEstoqueId);
        if (produtoId) lotes = lotes.filter(l => l.produto_id === produtoId);
        if (apenasComSaldo) lotes = lotes.filter(l => l.quantidade_disponivel > 0);

        return lotes.map(l => {
          const prod = produtos.find(p => p.id === l.produto_id);
          return {
            ...l,
            produto_codigo: prod?.codigo_interno,
            categoria: prod?.categoria,
            unidade: prod?.unidade_medida || 'UN',
            valor_total: (l.quantidade_disponivel || 0) * (l.custo_unitario || 0)
          };
        }).sort((a, b) => new Date(a.data_documento || a.created_date) - new Date(b.data_documento || b.created_date));
      }

      case 'extrato_movimentacoes': {
        let movs = filtrarPorData(movimentacoes);
        if (produtoId) movs = movs.filter(m => m.produto_id === produtoId);
        if (localEstoqueId) {
          movs = movs.filter(m => (
            (m.tipo_movimentacao === 'Entrada' && m.local_estoque_destino === localEstoqueId) ||
            (m.tipo_movimentacao === 'Saída' && m.local_estoque_origem === localEstoqueId) ||
            (m.tipo_movimentacao === 'Transferência' && (m.local_estoque_origem === localEstoqueId || m.local_estoque_destino === localEstoqueId)) ||
            (m.tipo_movimentacao === 'Ajuste' && (
              (toValue(m.tipo_detalhado || '')?.includes('ajuste_positivo') && m.local_estoque_destino === localEstoqueId) ||
              (toValue(m.tipo_detalhado || '')?.includes('ajuste_negativo') && m.local_estoque_origem === localEstoqueId)
            ))
          ));
        }
        if (fornecedorId) movs = movs.filter(m => m.fornecedor_id === fornecedorId);

        return movs.sort((a, b) => new Date(b.data_movimentacao) - new Date(a.data_movimentacao));
      }

      case 'consumo_periodo': {
        let movs = filtrarPorData(movimentacoes.filter(m => m.tipo_movimentacao === 'Saída'));
        if (localEstoqueId) movs = movs.filter(m => m.local_estoque_origem === localEstoqueId);
        if (centroCustoId) movs = movs.filter(m => m.centro_custo_id === centroCustoId);

        // Agrupar por produto
        const consumo = {};
        movs.forEach(m => {
          if (!consumo[m.produto_id]) {
            consumo[m.produto_id] = {
              produto_nome: m.produto_nome,
              produto_codigo: m.produto_codigo,
              unidade: m.unidade_medida,
              quantidade: 0,
              valor_total: 0
            };
          }
          consumo[m.produto_id].quantidade += m.quantidade || 0;
          consumo[m.produto_id].valor_total += m.valor_total || 0;
        });

        return Object.values(consumo).sort((a, b) => b.valor_total - a.valor_total);
      }

      case 'perdas_quebras': {
        let movs = filtrarPorData(movimentacoes.filter(m => m.tipo_detalhado === 'perda_quebra'));
        if (produtoId) movs = movs.filter(m => m.produto_id === produtoId);
        if (localEstoqueId) movs = movs.filter(m => m.local_estoque_origem === localEstoqueId);

        return movs.sort((a, b) => new Date(b.data_movimentacao) - new Date(a.data_movimentacao));
      }

      case 'entradas_fornecedor': {
        let movs = filtrarPorData(movimentacoes.filter(m => m.tipo_movimentacao === 'Entrada' && m.fornecedor_id));
        if (fornecedorId) movs = movs.filter(m => m.fornecedor_id === fornecedorId);

        // Agrupar por fornecedor
        const entradas = {};
        movs.forEach(m => {
          if (!entradas[m.fornecedor_id]) {
            entradas[m.fornecedor_id] = {
              fornecedor_nome: m.fornecedor_nome,
              quantidade: 0,
              valor_total: 0,
              num_notas: new Set()
            };
          }
          entradas[m.fornecedor_id].quantidade += m.quantidade || 0;
          entradas[m.fornecedor_id].valor_total += m.valor_total || 0;
          if (m.numero_documento) entradas[m.fornecedor_id].num_notas.add(m.numero_documento);
        });

        return Object.values(entradas).map(e => ({
          ...e,
          num_notas: e.num_notas.size
        })).sort((a, b) => b.valor_total - a.valor_total);
      }

      case 'kardex': {
        if (!produtoId) return [];
        let movs = filtrarPorData(movimentacoes.filter(m => m.produto_id === produtoId));
        if (localEstoqueId) movs = movs.filter(m => m.local_estoque_origem === localEstoqueId || m.local_estoque_destino === localEstoqueId);

        // Ordenar por data crescente e calcular saldo progressivo
        movs = movs.sort((a, b) => new Date(a.data_movimentacao) - new Date(b.data_movimentacao));
        let saldo = 0;
        return movs.map(m => {
          const isEntrada = m.tipo_movimentacao === 'Entrada' || 
            (m.tipo_movimentacao === 'Ajuste' && m.tipo_detalhado?.includes('positivo'));
          if (isEntrada) {
            saldo += m.quantidade || 0;
          } else {
            saldo -= m.quantidade || 0;
          }
          return { ...m, saldo_apos: saldo, is_entrada: isEntrada };
        });
      }

      case 'transferencias': {
        let movs = filtrarPorData(movimentacoes.filter(m => m.tipo_movimentacao === 'Transferência'));
        if (localEstoqueId) movs = movs.filter(m => m.local_estoque_origem === localEstoqueId || m.local_estoque_destino === localEstoqueId);
        return movs.sort((a, b) => new Date(b.data_movimentacao) - new Date(a.data_movimentacao));
      }

      case 'ajustes': {
        let movs = filtrarPorData(movimentacoes.filter(m => m.tipo_movimentacao === 'Ajuste'));
        if (localEstoqueId) movs = movs.filter(m => m.local_estoque_origem === localEstoqueId || m.local_estoque_destino === localEstoqueId);
        return movs.sort((a, b) => new Date(b.data_movimentacao) - new Date(a.data_movimentacao));
      }

      default:
        return [];
    }
  }, [modeloRelatorio, lotesNota, movimentacoes, produtos, dataInicio, dataFim, produtoId, localEstoqueId, fornecedorId, centroCustoId, apenasComSaldo]);

  // ========== TOTAIS ==========
  const totais = useMemo(() => {
    switch (modeloRelatorio) {
      case 'saldo_atual':
      case 'estoque_lote':
        return {
          quantidade: dadosRelatorio.reduce((s, d) => s + (d.quantidade || d.quantidade_disponivel || 0), 0),
          valor: dadosRelatorio.reduce((s, d) => s + (d.valor_total || 0), 0)
        };
      case 'saldo_simples':
      case 'resumo_movimentacoes':
        return {
          quantidade: dadosRelatorio.reduce((s, d) => s + (d.saldo_atual || 0), 0),
          valor: dadosRelatorio.reduce((s, d) => s + (d.valor_saldo || 0), 0),
          qtdEntradas: dadosRelatorio.reduce((s, d) => s + (d.qtd_entradas || 0), 0),
          valorEntradas: dadosRelatorio.reduce((s, d) => s + (d.valor_entradas || 0), 0),
          qtdSaidas: dadosRelatorio.reduce((s, d) => s + (d.qtd_saidas || 0), 0),
          valorSaidas: dadosRelatorio.reduce((s, d) => s + (d.valor_saidas || 0), 0)
        };
      case 'consumo_periodo':
      case 'entradas_fornecedor':
        return {
          quantidade: dadosRelatorio.reduce((s, d) => s + (d.quantidade || 0), 0),
          valor: dadosRelatorio.reduce((s, d) => s + (d.valor_total || 0), 0)
        };
      case 'extrato_movimentacoes':
      case 'perdas_quebras':
      case 'transferencias':
      case 'ajustes':
        return {
          quantidade: dadosRelatorio.reduce((s, d) => s + (d.quantidade || 0), 0),
          valor: dadosRelatorio.reduce((s, d) => s + (d.valor_total || 0), 0)
        };
      default:
        return { quantidade: 0, valor: 0 };
    }
  }, [dadosRelatorio, modeloRelatorio]);

  // ========== LIMPAR FILTROS ==========
  const limparFiltros = () => {
    setDataInicio('');
    setDataFim('');
    setProdutoId('');
    setLocalEstoqueId('');
    setFornecedorId('');
    setCentroCustoId('');
    setTipoVinculo('');
    setApenasComSaldo(true);
  };

  // ========== MODELO SELECIONADO ==========
  const modeloAtual = MODELOS_RELATORIO.find(m => m.value === modeloRelatorio);

  // ========== VERIFICAR SE PRECISA DE FILTROS ESPECÍFICOS ==========
  const precisaData = ['extrato_movimentacoes', 'resumo_movimentacoes', 'consumo_periodo', 'perdas_quebras', 'entradas_fornecedor', 'kardex', 'transferencias', 'ajustes'].includes(modeloRelatorio);
  const precisaProduto = ['kardex'].includes(modeloRelatorio);
  const precisaFornecedor = ['entradas_fornecedor'].includes(modeloRelatorio);
  const precisaCentroCusto = ['consumo_periodo'].includes(modeloRelatorio);

  // ========== RENDER ==========
  return (
    <div className="absolute inset-0 overflow-y-auto p-4 md:p-6 space-y-2">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Relatórios de Estoque</h1>
          <p className="text-xs text-slate-600">Selecione o modelo e aplique os filtros desejados</p>
        </div>
        <Button onClick={() => window.print()} size="sm" className="h-8 gap-1 text-xs bg-emerald-600 hover:bg-emerald-700">
          <Printer className="w-3.5 h-3.5" />
          Imprimir
        </Button>
      </div>

      {/* Filtros */}
      <Card className="print:hidden">
        <CardContent className="p-4 space-y-3">
          {/* Linha 1: Modelo e Orientação */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Modelo de Relatório *</Label>
              <Select value={modeloRelatorio} onValueChange={setModeloRelatorio}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['Estoque', 'Movimentações', 'Consumo/Custos', 'Perdas', 'Compras/Entradas', 'Auditoria'].map(grupo => (
                    <React.Fragment key={grupo}>
                      <div className="px-2 py-1 text-xs font-semibold text-slate-500 bg-slate-100">{grupo}</div>
                      {MODELOS_RELATORIO.filter(m => m.grupo === grupo).map(m => (
                        <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>
                      ))}
                    </React.Fragment>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Orientação</Label>
              <Select value={orientacao} onValueChange={setOrientacao}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paisagem" className="text-xs">Paisagem</SelectItem>
                  <SelectItem value="retrato" className="text-xs">Retrato</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {precisaData && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Data Início</Label>
                  <div className="relative flex items-center">
                    <CalendarDays className="absolute left-3 w-4 h-4 text-emerald-500 pointer-events-none z-10" />
                    <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="h-8 text-xs rounded-full pl-9 border-slate-300 hover:border-emerald-400 focus:border-emerald-500 shadow-sm [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Data Fim</Label>
                  <div className="relative flex items-center">
                    <CalendarDays className="absolute left-3 w-4 h-4 text-emerald-500 pointer-events-none z-10" />
                    <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="h-8 text-xs rounded-full pl-9 border-slate-300 hover:border-emerald-400 focus:border-emerald-500 shadow-sm [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Linha 2: Filtros específicos */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Local de Estoque</Label>
              <AutocompleteGenerico
                items={locais}
                value={localEstoqueId}
                onChange={setLocalEstoqueId}
                placeholder="Todos"
                displayField="nome"
                searchFields={["nome"]}
                className="h-8"
              />
            </div>

            {(precisaProduto || ['saldo_atual', 'saldo_simples', 'estoque_lote', 'extrato_movimentacoes', 'resumo_movimentacoes', 'perdas_quebras'].includes(modeloRelatorio)) && (
              <div className="space-y-1">
                <Label className="text-xs">Produto {precisaProduto ? '*' : ''}</Label>
                <AutocompleteGenerico
                  items={produtos}
                  value={produtoId}
                  onChange={setProdutoId}
                  placeholder={precisaProduto ? "Selecione" : "Todos"}
                  displayField="nome_produto"
                  searchFields={["nome_produto", "codigo_interno"]}
                  className="h-8"
                />
              </div>
            )}

            {(precisaFornecedor || modeloRelatorio === 'extrato_movimentacoes' || modeloRelatorio === 'resumo_movimentacoes') && (
              <div className="space-y-1">
                <Label className="text-xs">Fornecedor</Label>
                <AutocompleteGenerico
                  items={fornecedores}
                  value={fornecedorId}
                  onChange={setFornecedorId}
                  placeholder="Todos"
                  displayField="nome"
                  searchFields={["nome", "cnpj"]}
                  className="h-8"
                />
              </div>
            )}

            {precisaCentroCusto && (
              <div className="space-y-1">
                <Label className="text-xs">Centro de Custo</Label>
                <AutocompleteGenerico
                  items={centrosCusto}
                  value={centroCustoId}
                  onChange={setCentroCustoId}
                  placeholder="Todos"
                  displayField="nome"
                  searchFields={["nome", "codigo"]}
                  className="h-8"
                />
              </div>
            )}

            {['saldo_atual', 'saldo_simples', 'estoque_lote'].includes(modeloRelatorio) && (
              <div className="space-y-1 flex items-end">
                <div className="flex items-center space-x-2">
                  <Checkbox id="apenasComSaldo" checked={apenasComSaldo} onCheckedChange={setApenasComSaldo} />
                  <label htmlFor="apenasComSaldo" className="text-xs cursor-pointer">Apenas com saldo</label>
                </div>
              </div>
            )}
          </div>

          {/* Botão Limpar */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={limparFiltros}>
              <X className="w-3.5 h-3.5 mr-1" />
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Área de Impressão */}
      <div className="bg-white print:shadow-none">
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            @page { size: A4 ${orientacao}; margin: 1.5cm 1cm 2cm 1cm; }
            body * { visibility: hidden; }
            .print-area, .print-area * { visibility: visible; }
            .print-area { position: absolute; left: 0; top: 0; width: 100%; }
            header, nav, .no-print, .print\\:hidden { display: none !important; }
          }
        `}} />

        <div className="print-area p-4 print:p-0">
          {/* Cabeçalho do Relatório */}
          <div className="border-b-2 border-black pb-1 mb-2">
            <div className="flex items-center justify-between gap-3">
              {empresaAtual?.logotipo_url && (
                <img src={empresaAtual.logotipo_url} alt="Logo" className="h-16 w-16 object-contain" />
              )}
              <div className="flex-1 text-center">
                <h1 className="text-base font-bold uppercase">{empresaAtual?.nome || 'Empresa'}</h1>
                {empresaAtual?.endereco && (
                  <p className="text-xs">{empresaAtual.endereco}{empresaAtual?.cidade && `, ${empresaAtual.cidade}-${empresaAtual.estado}`}</p>
                )}
              </div>
            </div>
            <div className="mt-1">
              <h2 className="text-sm font-bold">{modeloAtual?.label}</h2>
              <p className="text-xs text-gray-600">
                {dadosRelatorio.length} registro(s) | 
                {['saldo_simples', 'resumo_movimentacoes'].includes(modeloRelatorio) ? ` Entradas: ${formatarNumero(totais.qtdEntradas || 0)} (${formatarMoeda(totais.valorEntradas || 0)}) | Saídas: ${formatarNumero(totais.qtdSaidas || 0)} (${formatarMoeda(totais.valorSaidas || 0)}) | Saldo: ${formatarNumero(totais.quantidade || 0)} (${formatarMoeda(totais.valor || 0)})` : ''}
                {!['saldo_simples', 'resumo_movimentacoes'].includes(modeloRelatorio) && totais.quantidade > 0 && ` Qtd: ${formatarNumero(totais.quantidade)} |`}
                {!['saldo_simples', 'resumo_movimentacoes'].includes(modeloRelatorio) && totais.valor > 0 && ` Valor: ${formatarMoeda(totais.valor)}`}
                {dataInicio && ` | De: ${formatarData(dataInicio)}`}
                {dataFim && ` até ${formatarData(dataFim)}`}
              </p>
            </div>
          </div>

          {/* Tabela de Dados */}
          {modeloRelatorio === 'kardex' && !produtoId ? (
            <div className="text-center py-12 text-slate-400">
              <p className="text-sm">Selecione um produto para visualizar o Kardex</p>
            </div>
          ) : dadosRelatorio.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="text-sm">Nenhum registro encontrado com os filtros aplicados</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {/* Colunas dinâmicas por modelo */}
                  {modeloRelatorio === 'saldo_atual' && (
                    <>
                      <TableHead className="text-xs font-bold py-1 border border-black">Produto</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black">Código</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black">Categoria</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black">Local</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black">UN</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black text-right">Saldo</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black text-right">Custo Médio</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black text-right">Valor Total</TableHead>
                    </>
                  )}
                  {(modeloRelatorio === 'saldo_simples' || modeloRelatorio === 'resumo_movimentacoes') && (
                    <>
                      <TableHead className="text-xs font-bold py-1 border border-black">Produto</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black">Código</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black">Categoria</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black">UN</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black text-right">Entradas</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black text-right">Valor Entradas</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black text-right">Saídas</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black text-right">Valor Saídas</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black text-right bg-blue-50">Saldo Atual</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black text-right bg-blue-50">Valor Saldo</TableHead>
                    </>
                  )}
                  {modeloRelatorio === 'estoque_lote' && (
                    <>
                      <TableHead className="text-xs font-bold py-1 border border-black">Produto</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black">Local</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black">Documento</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black">Data</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black">Fornecedor</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black text-right">Saldo</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black text-right">Custo Unit.</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black text-right">Valor Total</TableHead>
                    </>
                  )}
                  {(modeloRelatorio === 'extrato_movimentacoes' || modeloRelatorio === 'transferencias' || modeloRelatorio === 'ajustes') && (
                    <>
                      <TableHead className="text-xs font-bold py-1 border border-black">Data</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black">Tipo</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black">Operação</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black">Produto</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black text-right">Qtd</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black text-right">Valor</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black">Origem/Destino</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black">Doc.</TableHead>
                    </>
                  )}
                  {modeloRelatorio === 'consumo_periodo' && (
                    <>
                      <TableHead className="text-xs font-bold py-1 border border-black">Produto</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black">Código</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black">UN</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black text-right">Qtd Consumida</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black text-right">Valor Total</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black text-right">Custo Médio</TableHead>
                    </>
                  )}
                  {modeloRelatorio === 'perdas_quebras' && (
                    <>
                      <TableHead className="text-xs font-bold py-1 border border-black">Data</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black">Produto</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black">Local</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black text-right">Qtd</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black text-right">Valor</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black">Motivo</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black">Responsável</TableHead>
                    </>
                  )}
                  {modeloRelatorio === 'entradas_fornecedor' && (
                    <>
                      <TableHead className="text-xs font-bold py-1 border border-black">Fornecedor</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black text-right">Nº Notas</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black text-right">Qtd Total</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black text-right">Valor Total</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black text-right">Ticket Médio</TableHead>
                    </>
                  )}
                  {modeloRelatorio === 'kardex' && (
                    <>
                      <TableHead className="text-xs font-bold py-1 border border-black">Data</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black">Tipo</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black">Operação</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black">Doc.</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black text-right">Entrada</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black text-right">Saída</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black text-right bg-blue-50">Saldo</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black text-right">Custo</TableHead>
                      <TableHead className="text-xs font-bold py-1 border border-black text-right">Valor</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {dadosRelatorio.map((d, idx) => (
                  <TableRow key={idx} className="hover:bg-gray-50">
                    {modeloRelatorio === 'saldo_atual' && (
                      <>
                        <TableCell className="text-xs py-1 border border-gray-300">{d.produto_nome}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300">{d.produto_codigo || '-'}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300">{d.categoria || '-'}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300">{d.local_nome}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300">{d.unidade}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300 text-right font-mono">{formatarNumero(d.quantidade)}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300 text-right font-mono">{formatarMoeda(d.custo_medio)}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300 text-right font-mono font-semibold">{formatarMoeda(d.valor_total)}</TableCell>
                      </>
                    )}
                    {(modeloRelatorio === 'saldo_simples' || modeloRelatorio === 'resumo_movimentacoes') && (
                      <>
                        <TableCell className="text-xs py-1 border border-gray-300">{d.produto_nome}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300">{d.produto_codigo || '-'}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300">{d.categoria || '-'}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300">{d.unidade || 'UN'}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300 text-right font-mono text-green-700">{formatarNumero(d.qtd_entradas)}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300 text-right font-mono text-green-700">{formatarMoeda(d.valor_entradas)}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300 text-right font-mono text-red-700">{formatarNumero(d.qtd_saidas)}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300 text-right font-mono text-red-700">{formatarMoeda(d.valor_saidas)}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300 text-right font-mono font-semibold bg-blue-50">{formatarNumero(d.saldo_atual)}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300 text-right font-mono font-semibold bg-blue-50">{formatarMoeda(d.valor_saldo)}</TableCell>
                      </>
                    )}
                    {modeloRelatorio === 'estoque_lote' && (
                      <>
                        <TableCell className="text-xs py-1 border border-gray-300">{d.produto_nome}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300">{d.local_estoque_nome}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300">{d.numero_documento || 'S/N'}/{d.serie_documento || ''}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300">{formatarData(d.data_documento)}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300">{d.fornecedor_nome || '-'}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300 text-right font-mono">{formatarNumero(d.quantidade_disponivel)}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300 text-right font-mono">{formatarMoeda(d.custo_unitario)}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300 text-right font-mono font-semibold">{formatarMoeda(d.valor_total)}</TableCell>
                      </>
                    )}
                    {(modeloRelatorio === 'extrato_movimentacoes' || modeloRelatorio === 'transferencias' || modeloRelatorio === 'ajustes') && (
                      <>
                        <TableCell className="text-xs py-1 border border-gray-300">{formatarData(d.data_movimentacao)}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300">{d.tipo_movimentacao}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300">{getLabelOperacao(d.tipo_detalhado)}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300">{d.produto_nome}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300 text-right font-mono">{formatarNumero(d.quantidade)}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300 text-right font-mono">{formatarMoeda(d.valor_total)}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300">{getLocalEstoque(d) || d.fornecedor_nome || '-'}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300">{d.numero_documento || '-'}</TableCell>
                      </>
                    )}
                    {modeloRelatorio === 'consumo_periodo' && (
                      <>
                        <TableCell className="text-xs py-1 border border-gray-300">{d.produto_nome}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300">{d.produto_codigo || '-'}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300">{d.unidade || 'UN'}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300 text-right font-mono">{formatarNumero(d.quantidade)}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300 text-right font-mono font-semibold">{formatarMoeda(d.valor_total)}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300 text-right font-mono">{formatarMoeda(d.quantidade > 0 ? d.valor_total / d.quantidade : 0)}</TableCell>
                      </>
                    )}
                    {modeloRelatorio === 'perdas_quebras' && (
                      <>
                        <TableCell className="text-xs py-1 border border-gray-300">{formatarData(d.data_movimentacao)}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300">{d.produto_nome}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300">{d.local_estoque_origem || '-'}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300 text-right font-mono">{formatarNumero(d.quantidade)}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300 text-right font-mono">{formatarMoeda(d.valor_total)}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300">{d.motivo_perda || d.motivo_movimentacao || '-'}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300">{d.usuario_responsavel || d.created_by || '-'}</TableCell>
                      </>
                    )}
                    {modeloRelatorio === 'entradas_fornecedor' && (
                      <>
                        <TableCell className="text-xs py-1 border border-gray-300">{d.fornecedor_nome}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300 text-right font-mono">{d.num_notas}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300 text-right font-mono">{formatarNumero(d.quantidade)}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300 text-right font-mono font-semibold">{formatarMoeda(d.valor_total)}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300 text-right font-mono">{formatarMoeda(d.num_notas > 0 ? d.valor_total / d.num_notas : 0)}</TableCell>
                      </>
                    )}
                    {modeloRelatorio === 'kardex' && (
                      <>
                        <TableCell className="text-xs py-1 border border-gray-300">{formatarDataHora(d.data_movimentacao)}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300">{d.tipo_movimentacao}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300">{getLabelOperacao(d.tipo_detalhado)}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300">{d.numero_documento || '-'}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300 text-right font-mono text-green-700">
                          {d.is_entrada ? formatarNumero(d.quantidade) : ''}
                        </TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300 text-right font-mono text-red-700">
                          {!d.is_entrada ? formatarNumero(d.quantidade) : ''}
                        </TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300 text-right font-mono font-semibold bg-blue-50">
                          {formatarNumero(d.saldo_apos)}
                        </TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300 text-right font-mono">{formatarMoeda(d.valor_unitario)}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300 text-right font-mono">{formatarMoeda(d.valor_total)}</TableCell>
                      </>
                    )}
                  </TableRow>
                ))}

                {/* Linha de Totais */}
                <TableRow className="bg-gray-100 font-bold">
                  {modeloRelatorio === 'saldo_atual' && (
                    <>
                      <TableCell colSpan={5} className="text-xs py-1 border border-black">TOTAL</TableCell>
                      <TableCell className="text-xs py-1 border border-black text-right">{formatarNumero(totais.quantidade)}</TableCell>
                      <TableCell className="text-xs py-1 border border-black">-</TableCell>
                      <TableCell className="text-xs py-1 border border-black text-right">{formatarMoeda(totais.valor)}</TableCell>
                    </>
                  )}
                  {modeloRelatorio === 'estoque_lote' && (
                    <>
                      <TableCell colSpan={5} className="text-xs py-1 border border-black">TOTAL</TableCell>
                      <TableCell className="text-xs py-1 border border-black text-right">{formatarNumero(totais.quantidade)}</TableCell>
                      <TableCell className="text-xs py-1 border border-black">-</TableCell>
                      <TableCell className="text-xs py-1 border border-black text-right">{formatarMoeda(totais.valor)}</TableCell>
                    </>
                  )}
                  {(modeloRelatorio === 'saldo_simples' || modeloRelatorio === 'resumo_movimentacoes') && (
                    <>
                      <TableCell colSpan={4} className="text-xs py-1 border border-black">TOTAL</TableCell>
                      <TableCell className="text-xs py-1 border border-black text-right">{formatarNumero(totais.qtdEntradas)}</TableCell>
                      <TableCell className="text-xs py-1 border border-black text-right">{formatarMoeda(totais.valorEntradas)}</TableCell>
                      <TableCell className="text-xs py-1 border border-black text-right">{formatarNumero(totais.qtdSaidas)}</TableCell>
                      <TableCell className="text-xs py-1 border border-black text-right">{formatarMoeda(totais.valorSaidas)}</TableCell>
                      <TableCell className="text-xs py-1 border border-black text-right bg-blue-50">{formatarNumero(totais.quantidade)}</TableCell>
                      <TableCell className="text-xs py-1 border border-black text-right bg-blue-50">{formatarMoeda(totais.valor)}</TableCell>
                    </>
                  )}
                  {(modeloRelatorio === 'extrato_movimentacoes' || modeloRelatorio === 'transferencias' || modeloRelatorio === 'ajustes') && (
                    <>
                      <TableCell colSpan={4} className="text-xs py-1 border border-black">TOTAL</TableCell>
                      <TableCell className="text-xs py-1 border border-black text-right">{formatarNumero(totais.quantidade)}</TableCell>
                      <TableCell className="text-xs py-1 border border-black text-right">{formatarMoeda(totais.valor)}</TableCell>
                      <TableCell colSpan={2} className="text-xs py-1 border border-black"></TableCell>
                    </>
                  )}
                  {modeloRelatorio === 'consumo_periodo' && (
                    <>
                      <TableCell colSpan={3} className="text-xs py-1 border border-black">TOTAL</TableCell>
                      <TableCell className="text-xs py-1 border border-black text-right">{formatarNumero(totais.quantidade)}</TableCell>
                      <TableCell className="text-xs py-1 border border-black text-right">{formatarMoeda(totais.valor)}</TableCell>
                      <TableCell className="text-xs py-1 border border-black"></TableCell>
                    </>
                  )}
                  {modeloRelatorio === 'perdas_quebras' && (
                    <>
                      <TableCell colSpan={3} className="text-xs py-1 border border-black">TOTAL</TableCell>
                      <TableCell className="text-xs py-1 border border-black text-right">{formatarNumero(totais.quantidade)}</TableCell>
                      <TableCell className="text-xs py-1 border border-black text-right">{formatarMoeda(totais.valor)}</TableCell>
                      <TableCell colSpan={2} className="text-xs py-1 border border-black"></TableCell>
                    </>
                  )}
                  {modeloRelatorio === 'entradas_fornecedor' && (
                    <>
                      <TableCell className="text-xs py-1 border border-black">TOTAL</TableCell>
                      <TableCell className="text-xs py-1 border border-black text-right">{dadosRelatorio.reduce((s, d) => s + d.num_notas, 0)}</TableCell>
                      <TableCell className="text-xs py-1 border border-black text-right">{formatarNumero(totais.quantidade)}</TableCell>
                      <TableCell className="text-xs py-1 border border-black text-right">{formatarMoeda(totais.valor)}</TableCell>
                      <TableCell className="text-xs py-1 border border-black"></TableCell>
                    </>
                  )}
                  {modeloRelatorio === 'kardex' && (
                    <>
                      <TableCell colSpan={9} className="text-xs py-1 border border-black text-right">
                        Saldo Final: {formatarNumero(dadosRelatorio.length > 0 ? dadosRelatorio[dadosRelatorio.length - 1].saldo_apos : 0)}
                      </TableCell>
                    </>
                  )}
                </TableRow>
              </TableBody>
            </Table>
          )}

          {/* Rodapé */}
          <div className="mt-4 pt-2 border-t border-gray-300 text-center text-xs text-gray-500">
            <p>Impresso em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
          </div>
        </div>
      </div>
    </div>
  );
}