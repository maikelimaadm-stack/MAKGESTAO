import React, { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { BarChart3, AlertTriangle, Package, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, subMonths } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CORES = ['#2899f5', '#60a5fa', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

export default function Home() {
  const [showConfigGraficos, setShowConfigGraficos] = useState(false);
  
  const [graficosVisiveis, setGraficosVisiveis] = useState(() => {
    const saved = localStorage.getItem('graficos_dashboard');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const validGraphIds = ['movimentacoes_mes', 'estoque_categoria'];
        const filtered = parsed.filter(id => validGraphIds.includes(id));
        if (filtered.length !== parsed.length) {
          localStorage.setItem('graficos_dashboard', JSON.stringify(filtered));
        }
        return filtered.length > 0 ? filtered : ['movimentacoes_mes', 'estoque_categoria'];
      } catch {
        localStorage.removeItem('graficos_dashboard');
        return ['movimentacoes_mes', 'estoque_categoria'];
      }
    }
    return ['movimentacoes_mes', 'estoque_categoria'];
  });



  const empresaSelecionadaId = localStorage.getItem('empresa_selecionada_id');

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos_dashboard', empresaSelecionadaId],
    queryFn: async () => {
      const all = await base44.entities.Produto.list();
      return all.filter(p => p && p.empresa_id === empresaSelecionadaId);
    },
    enabled: !!empresaSelecionadaId,
  });

  const { data: movimentacoes = [] } = useQuery({
    queryKey: ['movimentacoes_dashboard', empresaSelecionadaId],
    queryFn: async () => {
      const all = await base44.entities.MovimentacaoEstoque.list('-data_movimentacao');
      return all.filter(m => m && m.empresa_id === empresaSelecionadaId && m.status === 'Ativa');
    },
    enabled: !!empresaSelecionadaId,
  });

  const { data: pontosSuplementacao = [] } = useQuery({
    queryKey: ['pontos-supl-dash', empresaSelecionadaId],
    queryFn: async () => {
      const all = await base44.entities.PontoSuplementacao.list();
      return all.filter(p => p.empresa_id === empresaSelecionadaId);
    },
    enabled: !!empresaSelecionadaId,
  });

  const { data: eventosSuplementacao = [] } = useQuery({
    queryKey: ['eventos-supl-dash', empresaSelecionadaId],
    queryFn: async () => {
      const all = await base44.entities.SuplementacaoEvento.list();
      return all.filter(e => e.empresa_id === empresaSelecionadaId);
    },
    enabled: !!empresaSelecionadaId,
  });

  const dadosSuplementacao = useMemo(() => {
    const pontosAtivos = pontosSuplementacao.filter(p => p.status === 'Ativo').length;
    const eventosUltimos30 = eventosSuplementacao.filter(e => {
      const diasAtras = Math.floor((new Date() - new Date(e.data_lancamento)) / (1000 * 60 * 60 * 24));
      return diasAtras <= 30;
    });
    const totalFornecido = eventosUltimos30.reduce((sum, e) => sum + e.quantidade_total_kg, 0);

    const pontosComAlerta = pontosSuplementacao.filter(p => {
      if (p.status !== 'Ativo') return false;
      const eventosP = eventosSuplementacao.filter(e => e.ponto_suplementacao_id === p.id);
      if (eventosP.length === 0) return true;
      
      const ultimoEvento = eventosP.sort((a, b) => 
        new Date(b.data_lancamento) - new Date(a.data_lancamento)
      )[0];
      
      const diasSemLancamento = Math.floor(
        (new Date() - new Date(ultimoEvento.data_lancamento)) / (1000 * 60 * 60 * 24)
      );
      
      return diasSemLancamento > (p.alerta_sem_lancamento_dias || 10);
    });

    return { pontosAtivos, totalFornecido, alertas: pontosComAlerta.length, eventosCount: eventosUltimos30.length };
  }, [pontosSuplementacao, eventosSuplementacao]);

  const dadosGraficos = useMemo(() => {
    const movimentacoesMes = [];
    for (let i = 5; i >= 0; i--) {
      const mes = subMonths(new Date(), i);
      const inicioMes = new Date(mes.getFullYear(), mes.getMonth(), 1);
      const fimMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0);
      
      const entradas = movimentacoes.filter(m => 
        m.tipo_movimentacao === 'Entrada' && 
        new Date(m.data_movimentacao) >= inicioMes && 
        new Date(m.data_movimentacao) <= fimMes
      ).length;
      
      const saidas = movimentacoes.filter(m => 
        m.tipo_movimentacao === 'Saída' && 
        new Date(m.data_movimentacao) >= inicioMes && 
        new Date(m.data_movimentacao) <= fimMes
      ).length;
      
      movimentacoesMes.push({ mes: format(mes, 'MMM/yy'), entradas, saidas });
    }

    const categorias = {};
    produtos.forEach(p => {
      const cat = p.categoria || 'Sem categoria';
      if (!categorias[cat]) categorias[cat] = 0;
      categorias[cat] += p.estoque_atual || 0;
    });
    const estoquePorCategoria = Object.entries(categorias).map(([name, value]) => ({ name, value }));

    return { movimentacoesMes, estoquePorCategoria };
  }, [movimentacoes, produtos]);

  const toggleGrafico = (graficoId) => {
    setGraficosVisiveis(prev => {
      const novos = prev.includes(graficoId) ? prev.filter(id => id !== graficoId) : [...prev, graficoId];
      localStorage.setItem('graficos_dashboard', JSON.stringify(novos));
      return novos;
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-3">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-xs text-slate-600">Visão geral do sistema</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowConfigGraficos(true)} className="h-8 text-xs">
            Configurar Gráficos
          </Button>
        </div>
      </div>

      {dadosSuplementacao.pontosAtivos > 0 && (
        <Card className="shadow-sm border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-900">Suplementação (30 dias)</CardTitle>
              <Link to={createPageUrl("DashboardSuplementacao")}>
                <Button variant="ghost" size="sm" className="h-7 text-xs">Ver detalhes</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <MapPin className="w-4 h-4 text-primary" />
                </div>
                <div className="text-lg font-bold text-slate-900">{dadosSuplementacao.pontosAtivos}</div>
                <div className="text-xs text-slate-600">Pontos</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <Package className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-lg font-bold text-slate-900">{dadosSuplementacao.totalFornecido.toFixed(0)} kg</div>
                <div className="text-xs text-slate-600">Fornecido</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <Package className="w-4 h-4 text-purple-600" />
                </div>
                <div className="text-lg font-bold text-slate-900">{dadosSuplementacao.eventosCount}</div>
                <div className="text-xs text-slate-600">Lançamentos</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-lg font-bold text-amber-600">{dadosSuplementacao.alertas}</div>
                <div className="text-xs text-slate-600">Alertas</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {graficosVisiveis.includes('movimentacoes_mes') && (
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-900">Movimentações (6 Meses)</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-2">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dadosGraficos.movimentacoesMes}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="entradas" fill="#2899f5" name="Entradas" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="saidas" fill="#ef4444" name="Saídas" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {graficosVisiveis.includes('estoque_categoria') && (
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-900">Estoque por Categoria</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-2">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={dadosGraficos.estoquePorCategoria}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={70}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {dadosGraficos.estoquePorCategoria.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CORES[index % CORES.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={showConfigGraficos} onOpenChange={setShowConfigGraficos}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Configurar Gráficos</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2 p-1.5 hover:bg-slate-50 rounded">
              <Checkbox checked={graficosVisiveis.includes('movimentacoes_mes')} onCheckedChange={() => toggleGrafico('movimentacoes_mes')} />
              <label className="cursor-pointer flex-1 text-xs" onClick={() => toggleGrafico('movimentacoes_mes')}>
                Movimentações de Estoque
              </label>
            </div>
            <div className="flex items-center space-x-2 p-1.5 hover:bg-slate-50 rounded">
              <Checkbox checked={graficosVisiveis.includes('estoque_categoria')} onCheckedChange={() => toggleGrafico('estoque_categoria')} />
              <label className="cursor-pointer flex-1 text-xs" onClick={() => toggleGrafico('estoque_categoria')}>
                Estoque por Categoria
              </label>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}