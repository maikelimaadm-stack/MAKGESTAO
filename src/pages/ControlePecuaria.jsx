import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Users, MapPin, TrendingUp, AlertTriangle, Search, Filter, 
  ArrowRightLeft, Calendar, Package, Activity, CheckCircle, Clock,
  Scale, Syringe, Truck, Tractor
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, subDays } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const CORES = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function ControlePecuaria() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [filtroArea, setFiltroArea] = useState('todas');
  const [periodoMov, setPeriodoMov] = useState('30');

  const empresaSelecionadaId = localStorage.getItem('empresa_selecionada_id');

  const { data: lotes = [] } = useQuery({
    queryKey: ['lotes-controle', empresaSelecionadaId],
    queryFn: async () => {
      const all = await base44.entities.Lote.list();
      return all.filter(l => l.empresa_id === empresaSelecionadaId && l.status === 'Ativo');
    },
    enabled: !!empresaSelecionadaId,
  });

  const { data: areas = [] } = useQuery({
    queryKey: ['areas-controle', empresaSelecionadaId],
    queryFn: async () => {
      const all = await base44.entities.AreaPastagem.list();
      return all.filter(a => a.empresa_id === empresaSelecionadaId && a.ativo !== false);
    },
    enabled: !!empresaSelecionadaId,
  });

  const { data: movimentacoes = [] } = useQuery({
    queryKey: ['movimentacoes-pec', empresaSelecionadaId],
    queryFn: async () => {
      const all = await base44.entities.MovimentacaoPecuaria.list('-data_movimentacao');
      return all.filter(m => m.empresa_id === empresaSelecionadaId);
    },
    enabled: !!empresaSelecionadaId,
  });

  const { data: tarefas = [] } = useQuery({
    queryKey: ['tarefas-controle', empresaSelecionadaId],
    queryFn: async () => {
      const all = await base44.entities.TarefaMapa.list('-created_date');
      return all.filter(t => t.empresa_id === empresaSelecionadaId);
    },
    enabled: !!empresaSelecionadaId,
  });

  const { data: eventosSupl = [] } = useQuery({
    queryKey: ['eventos-supl-controle', empresaSelecionadaId],
    queryFn: async () => {
      const all = await base44.entities.SuplementacaoEvento.list('-data_lancamento');
      return all.filter(e => e.empresa_id === empresaSelecionadaId);
    },
    enabled: !!empresaSelecionadaId,
  });

  const { data: operacoes = [] } = useQuery({
    queryKey: ['operacoes-controle', empresaSelecionadaId],
    queryFn: async () => {
      const all = await base44.entities.OperacaoAgricola.list('-data_inicio');
      return all.filter(o => o.empresa_id === empresaSelecionadaId);
    },
    enabled: !!empresaSelecionadaId,
  });

  // Estatísticas gerais
  const stats = useMemo(() => {
    const totalCabecas = lotes.reduce((sum, l) => sum + (l.quantidade_cabecas || 0), 0);
    const categorias = [...new Set(lotes.map(l => l.categoria).filter(Boolean))];
    const areasOcupadas = [...new Set(lotes.map(l => l.area_atual_id).filter(Boolean))].length;
    
    const dataLimite = subDays(new Date(), parseInt(periodoMov));
    const movRecentes = movimentacoes.filter(m => new Date(m.data_movimentacao) >= dataLimite);
    
    const tarefasPendentes = tarefas.filter(t => t.status === 'Pendente').length;
    const tarefasUrgentes = tarefas.filter(t => t.prioridade === 'Urgente' && t.status !== 'Concluída').length;

    // Suplementação últimos 30 dias
    const dataSupl = subDays(new Date(), 30);
    const eventosRecentes = eventosSupl.filter(e => new Date(e.data_lancamento) >= dataSupl);
    const totalSuplKg = eventosRecentes.reduce((sum, e) => sum + (e.quantidade_total_kg || 0), 0);

    return {
      totalCabecas,
      totalLotes: lotes.length,
      categorias: categorias.length,
      areasOcupadas,
      totalAreas: areas.length,
      movRecentes: movRecentes.length,
      tarefasPendentes,
      tarefasUrgentes,
      totalSuplKg
    };
  }, [lotes, areas, movimentacoes, tarefas, eventosSupl, periodoMov]);

  // Lotes por categoria para gráfico
  const dadosCategoria = useMemo(() => {
    const porCategoria = {};
    lotes.forEach(l => {
      const cat = l.categoria || 'Sem categoria';
      if (!porCategoria[cat]) porCategoria[cat] = { cabecas: 0, lotes: 0 };
      porCategoria[cat].cabecas += l.quantidade_cabecas || 0;
      porCategoria[cat].lotes += 1;
    });
    return Object.entries(porCategoria).map(([nome, dados]) => ({
      nome,
      cabecas: dados.cabecas,
      lotes: dados.lotes
    })).sort((a, b) => b.cabecas - a.cabecas);
  }, [lotes]);

  // Filtrar lotes
  const lotesFiltrados = useMemo(() => {
    return lotes.filter(l => {
      if (searchTerm && !l.nome?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (filtroCategoria !== 'todas' && l.categoria !== filtroCategoria) return false;
      if (filtroArea !== 'todas' && l.area_atual_id !== filtroArea) return false;
      return true;
    });
  }, [lotes, searchTerm, filtroCategoria, filtroArea]);

  const categorias = [...new Set(lotes.map(l => l.categoria).filter(Boolean))].sort();

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Controle de Pecuária</h1>
          <p className="text-xs text-slate-600">Visão completa do rebanho e operações</p>
        </div>
        <div className="flex gap-2">
          <Link to={createPageUrl("MapaGeral")}>
            <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700">
              Ver no Mapa
            </Button>
          </Link>
          <Link to={createPageUrl("CadastroLotes")}>
            <Button variant="outline" size="sm" className="h-8 text-xs">
              Gerenciar Lotes
            </Button>
          </Link>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Total Cabeças</div>
                <div className="text-xl font-bold text-slate-900">{stats.totalCabecas.toLocaleString()}</div>
              </div>
              <Users className="w-6 h-6 text-slate-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Lotes Ativos</div>
                <div className="text-xl font-bold text-slate-900">{stats.totalLotes}</div>
              </div>
              <Package className="w-6 h-6 text-slate-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Áreas Ocupadas</div>
                <div className="text-xl font-bold text-slate-900">{stats.areasOcupadas}/{stats.totalAreas}</div>
              </div>
              <MapPin className="w-6 h-6 text-slate-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Movimentações</div>
                <div className="text-xl font-bold text-slate-900">{stats.movRecentes}</div>
                <div className="text-[9px] text-slate-400">últimos {periodoMov} dias</div>
              </div>
              <ArrowRightLeft className="w-6 h-6 text-slate-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Tarefas Pendentes</div>
                <div className="text-xl font-bold text-slate-900">{stats.tarefasPendentes}</div>
                {stats.tarefasUrgentes > 0 && (
                  <div className="text-[9px] text-slate-600">{stats.tarefasUrgentes} urgente(s)</div>
                )}
              </div>
              <Clock className="w-6 h-6 text-slate-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Suplementação</div>
                <div className="text-xl font-bold text-slate-900">{(stats.totalSuplKg / 1000).toFixed(1)}t</div>
                <div className="text-[9px] text-slate-400">últimos 30 dias</div>
              </div>
              <Scale className="w-6 h-6 text-slate-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="rebanho" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-5 h-8">
          <TabsTrigger value="rebanho" className="text-xs h-7">Rebanho</TabsTrigger>
          <TabsTrigger value="movimentacoes" className="text-xs h-7">Movimentações</TabsTrigger>
          <TabsTrigger value="operacoes" className="text-xs h-7">Operações</TabsTrigger>
          <TabsTrigger value="tarefas" className="text-xs h-7">Tarefas</TabsTrigger>
          <TabsTrigger value="graficos" className="text-xs h-7">Gráficos</TabsTrigger>
        </TabsList>

        <TabsContent value="rebanho" className="space-y-3 mt-3">
          {/* Filtros */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar lote..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas" className="text-xs">Todas Categorias</SelectItem>
                {categorias.map(cat => (
                  <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroArea} onValueChange={setFiltroArea}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue placeholder="Área" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas" className="text-xs">Todas Áreas</SelectItem>
                {areas.map(area => (
                  <SelectItem key={area.id} value={area.id} className="text-xs">{area.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lista de Lotes */}
          <div className="grid gap-2">
            {lotesFiltrados.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum lote encontrado</p>
              </div>
            ) : (
              lotesFiltrados.map(lote => (
                <Card key={lote.id} className="shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm text-slate-900">{lote.nome}</span>
                          <Badge variant="outline" className="text-[10px]">{lote.categoria}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {lote.quantidade_cabecas} cab
                          </span>
                          {lote.peso_medio_kg && (
                            <span className="flex items-center gap-1">
                              <Scale className="w-3 h-3" />
                              {lote.peso_medio_kg} kg
                            </span>
                          )}
                          {lote.area_atual_nome && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {lote.area_atual_nome}
                            </span>
                          )}
                        </div>
                      </div>
                      <Link to={createPageUrl("MapaGeral")}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs">
                          Ver no Mapa
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="movimentacoes" className="space-y-3 mt-3">
          <div className="flex items-center gap-2 mb-3">
            <Select value={periodoMov} onValueChange={setPeriodoMov}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7" className="text-xs">Últimos 7 dias</SelectItem>
                <SelectItem value="30" className="text-xs">Últimos 30 dias</SelectItem>
                <SelectItem value="90" className="text-xs">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
            <Link to={createPageUrl("HistoricoMovimentacoesPecuaria")}>
              <Button variant="outline" size="sm" className="h-8 text-xs">Ver Histórico Completo</Button>
            </Link>
          </div>

          <div className="space-y-2">
            {movimentacoes.slice(0, 20).map(mov => (
              <Card key={mov.id} className="shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px]">{mov.tipo}</Badge>
                        <span className="text-xs text-slate-500">
                          {format(new Date(mov.data_movimentacao), 'dd/MM/yyyy HH:mm')}
                        </span>
                      </div>
                      <div className="text-sm text-slate-700">
                        {mov.lote && <span className="font-medium">{mov.lote}</span>}
                        {mov.quantidade_animais && <span> • {mov.quantidade_animais} animais</span>}
                      </div>
                      {mov.area_origem_nome && mov.area_destino_nome && (
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {mov.area_origem_nome} → {mov.area_destino_nome}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="operacoes" className="space-y-3 mt-3">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-slate-600">
              {operacoes.filter(o => o.status === 'Em Andamento').length} em andamento • {operacoes.filter(o => o.status === 'Planejada').length} planejada(s)
            </div>
            <Link to={createPageUrl("OperacoesAgricolas")}>
              <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700">
                Ver Todas
              </Button>
            </Link>
          </div>

          <div className="space-y-2">
            {operacoes.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Tractor className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma operação registrada</p>
              </div>
            ) : (
              operacoes.slice(0, 20).map(op => (
                <Card key={op.id} className="shadow-sm border-slate-200">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm text-slate-900">{op.tipo_operacao}</span>
                          <Badge className="text-[10px] bg-slate-100 text-slate-700">
                            {op.status}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                          {op.area_nome && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {op.area_nome}
                            </span>
                          )}
                          {op.maquina_nome && (
                            <span className="flex items-center gap-1">
                              <Tractor className="w-3 h-3" />
                              {op.maquina_nome}
                            </span>
                          )}
                          {op.data_inicio && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(op.data_inicio), 'dd/MM/yyyy')}
                            </span>
                          )}
                          {op.hectares_trabalhados && (
                            <span>{op.hectares_trabalhados} ha</span>
                          )}
                          {op.custo_total && (
                            <span className="font-medium text-slate-700">
                              R$ {op.custo_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="tarefas" className="space-y-3 mt-3">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-slate-600">
              {stats.tarefasPendentes} pendente(s) • {stats.tarefasUrgentes} urgente(s)
            </div>
            <Link to={createPageUrl("MapaGeral")}>
              <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700">
                Gerenciar no Mapa
              </Button>
            </Link>
          </div>

          <div className="space-y-2">
            {tarefas.filter(t => t.status !== 'Concluída').slice(0, 15).map(tarefa => (
              <Card key={tarefa.id} className="shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-slate-900">{tarefa.titulo}</span>
                        <Badge className="text-[10px] bg-slate-100 text-slate-700">
                          {tarefa.prioridade}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                        <Badge variant="outline" className="text-[10px]">{tarefa.tipo}</Badge>
                        {tarefa.data_prevista && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(tarefa.data_prevista), 'dd/MM')}
                          </span>
                        )}
                        {tarefa.area_nome && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {tarefa.area_nome}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="graficos" className="space-y-4 mt-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Rebanho por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={dadosCategoria} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="nome" type="category" tick={{ fontSize: 10 }} width={100} />
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                    <Bar dataKey="cabecas" fill="#10b981" name="Cabeças" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Distribuição por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={dadosCategoria}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ nome, percent }) => `${nome} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="cabecas"
                    >
                      {dadosCategoria.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CORES[index % CORES.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}