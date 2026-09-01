import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer, Settings, DollarSign, FileText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
// CartoesResumo imported but not used in the provided outline's render section
// import CartoesResumo from "../components/shared/CartoesResumo"; 

const formatarMoeda = (valor) => {
  if (!valor && valor !== 0) return "R$ 0,00";
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const COLUNAS_ANALITICO = [
  { id: 'numero', label: 'Nº', default: true },
  { id: 'tipo', label: 'Tipo', default: true },
  { id: 'emissao', label: 'Emissão', default: true },
  { id: 'vencimento', label: 'Vencimento', default: true },
  { id: 'fornecedor', label: 'Fornecedor/Cliente', default: true },
  { id: 'documento', label: 'Documento', default: true },
  { id: 'valor_total', label: 'Valor Total', default: true },
  { id: 'valor_pago', label: 'Pago', default: true },
  { id: 'saldo', label: 'Saldo', default: true },
  { id: 'status', label: 'Status', default: true },
  { id: 'centro_custo', label: 'Centro Custo', default: false },
  { id: 'plano_contas', label: 'Plano de Contas', default: false },
  ];

const COLUNAS_SINTETICO = [
  { id: 'agrupamento', label: 'Agrupamento', default: true },
  { id: 'quantidade', label: 'Qtd Lançamentos', default: true },
  { id: 'valor_total', label: 'Valor Total', default: true },
  { id: 'valor_pago', label: 'Total Pago', default: true },
  { id: 'saldo', label: 'Saldo', default: true },
];

export default function RelatorioFinanceiro() {
  const [tipoRelatorio, setTipoRelatorio] = useState("analitico");
  const [orientacao, setOrientacao] = useState("paisagem");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [statusFiltro, setStatusFiltro] = useState([]);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [agrupamento, setAgrupamento] = useState("status");
  const [showConfig, setShowConfig] = useState(false); // New state for dialog

  const [colunasVisiveis, setColunasVisiveis] = useState(() => {
    return tipoRelatorio === 'analitico' 
      ? COLUNAS_ANALITICO.filter(c => c.default).map(c => c.id)
      : COLUNAS_SINTETICO.filter(c => c.default).map(c => c.id);
  });

  React.useEffect(() => {
    const colunas = tipoRelatorio === 'analitico' ? COLUNAS_ANALITICO : COLUNAS_SINTETICO;
    setColunasVisiveis(colunas.filter(c => c.default).map(c => c.id));
  }, [tipoRelatorio]);

  const empresaSelecionadaId = localStorage.getItem('empresa_selecionada_id');

  const { data: lancamentos = [] } = useQuery({
    queryKey: ['lancamentos_relatorio', empresaSelecionadaId],
    queryFn: async () => {
      const all = await base44.entities.LancamentoFinanceiro.list('-data_emissao');
      return all.filter(l => l.empresa_id === empresaSelecionadaId);
    },
    enabled: !!empresaSelecionadaId,
  });

  const { data: empresaAtual } = useQuery({
    queryKey: ['empresa-atual-relatorio', empresaSelecionadaId],
    queryFn: async () => {
      if (!empresaSelecionadaId) return null;
      const empresas = await base44.entities.Empresa.list();
      return empresas.find(e => e.id === empresaSelecionadaId) || null;
    },
    enabled: !!empresaSelecionadaId,
  });

  const lancamentosFiltrados = useMemo(() => {
    return lancamentos.filter(l => {
      if (tipoFiltro !== 'todos' && l.tipo !== tipoFiltro) return false;
      if (statusFiltro.length > 0 && !statusFiltro.includes(l.status)) return false;
      
      if (dataInicio) {
        const dataVenc = new Date(l.data_vencimento);
        const dataIni = new Date(dataInicio);
        if (dataVenc < dataIni) return false;
      }
      
      if (dataFim) {
        const dataVenc = new Date(l.data_vencimento);
        const dataF = new Date(dataFim);
        if (dataVenc > dataF) return false;
      }
      
      return true;
    });
  }, [lancamentos, tipoFiltro, statusFiltro, dataInicio, dataFim]);

  const dadosRelatorio = useMemo(() => {
    if (tipoRelatorio === 'sintetico') {
      const grupos = {};
      
      lancamentosFiltrados.forEach(l => {
        let chave;
        switch (agrupamento) {
          case 'status': chave = l.status || 'Sem status'; break;
          case 'fornecedor': chave = l.fornecedor_nome || l.cliente_nome || 'Sem identificação'; break;
          case 'centro_custo': chave = (l.rateio_centros_custo || []).map(r => r.centro_custo_nome).filter(Boolean).join(', ') || 'Sem centro de custo'; break;
          case 'grupo': chave = (l.rateio_grupos || []).map(r => r.grupo_financeiro_nome).filter(Boolean).join(', ') || 'Sem grupo'; break;
          default: chave = 'Sem classificação';
        }
        
        if (!grupos[chave]) {
          grupos[chave] = {
            agrupamento: chave,
            quantidade: 0,
            valor_total: 0,
            valor_pago: 0,
            saldo: 0
          };
        }
        
        grupos[chave].quantidade++;
        grupos[chave].valor_total += l.valor_total || 0;
        grupos[chave].valor_pago += l.valor_pago || 0;
        grupos[chave].saldo += (l.valor_total || 0) - (l.valor_pago || 0);
      });
      
      return Object.values(grupos);
    }
    
    return lancamentosFiltrados;
  }, [lancamentosFiltrados, tipoRelatorio, agrupamento]);

  const toggleColuna = (colunaId) => {
    setColunasVisiveis(prev => 
      prev.includes(colunaId) ? prev.filter(id => id !== colunaId) : [...prev, colunaId]
    );
  };

  const toggleStatus = (status) => {
    setStatusFiltro(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const limparFiltros = () => {
    setTipoFiltro('todos');
    setStatusFiltro([]);
    setDataInicio('');
    setDataFim('');
    toast.info("Filtros limpos!");
  };

  const imprimir = () => window.print();

  const totais = useMemo(() => {
    return {
      total: lancamentosFiltrados.reduce((s, l) => s + (l.valor_total || 0), 0),
      pago: lancamentosFiltrados.reduce((s, l) => s + (l.valor_pago || 0), 0),
      saldo: lancamentosFiltrados.reduce((s, l) => s + ((l.valor_total || 0) - (l.valor_pago || 0)), 0),
    };
  }, [lancamentosFiltrados]);

  const colunasDisponiveis = tipoRelatorio === 'analitico' ? COLUNAS_ANALITICO : COLUNAS_SINTETICO;

  return (
    <div className="absolute inset-0 overflow-y-auto p-4 md:p-6 space-y-2">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Relatório Financeiro</h1>
          <p className="text-xs text-slate-600">Análise financeira</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowConfig(true)} className="h-8 gap-1 text-xs">
            <Settings className="w-3.5 h-3.5" />
            Config
          </Button>
          <Button onClick={imprimir} size="sm" className="h-8 gap-1 text-xs bg-emerald-600 hover:bg-emerald-700">
            <Printer className="w-3.5 h-3.5" />
            Imprimir
          </Button>
        </div>
      </div>

      <Dialog open={showConfig} onOpenChange={setShowConfig}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle className="text-green-900">Filtros e Configurações</DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Relatório</Label>
                <Select value={tipoRelatorio} onValueChange={setTipoRelatorio}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="analitico">Analítico (Detalhado)</SelectItem>
                    <SelectItem value="sintetico">Sintético (Agrupado)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Orientação</Label>
                <Select value={orientacao} onValueChange={setOrientacao}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retrato">Retrato</SelectItem>
                    <SelectItem value="paisagem">Paisagem</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="Pagar">Contas a Pagar</SelectItem>
                    <SelectItem value="Receber">Contas a Receber</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {tipoRelatorio === 'sintetico' && (
                <div className="space-y-2">
                  <Label>Agrupar Por</Label>
                  <Select value={agrupamento} onValueChange={setAgrupamento}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="status">Status</SelectItem>
                      <SelectItem value="fornecedor">Fornecedor/Cliente</SelectItem>
                      <SelectItem value="centro_custo">Centro de Custo</SelectItem>
                      <SelectItem value="grupo">Grupo Financeiro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-3 flex-wrap">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline">Status {statusFiltro.length > 0 && `(${statusFiltro.length})`}</Button>
                </PopoverTrigger>
                <PopoverContent className="w-64">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm mb-2">Status</h4>
                    {['Aberto', 'Parcial', 'Pago', 'Recebido', 'Cancelado'].map(s => (
                      <div key={s} className="flex items-center space-x-2">
                        <Checkbox checked={statusFiltro.includes(s)} onCheckedChange={() => toggleStatus(s)} />
                        <label className="text-sm cursor-pointer">{s}</label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Settings className="w-4 h-4" />
                    Colunas
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 max-h-96 overflow-y-auto">
                  <DropdownMenuLabel>Colunas Visíveis</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {colunasDisponiveis.map((coluna) => (
                    <DropdownMenuCheckboxItem
                      key={coluna.id}
                      checked={colunasVisiveis.includes(coluna.id)}
                      onCheckedChange={() => toggleColuna(coluna.id)}
                    >
                      {coluna.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="outline" onClick={limparFiltros}>Limpar Filtros</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className={`bg-white print:shadow-none ${orientacao === 'paisagem' ? 'print:landscape' : ''}`}>
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            @page {
              size: ${orientacao === 'paisagem' ? 'A4 landscape' : 'A4 portrait'};
              margin: 1.5cm 1cm 2cm 1cm;
            }
            body * { visibility: hidden; }
            .print-area, .print-area * { visibility: visible; }
            .print-area { position: absolute; left: 0; top: 0; width: 100%; }
            header, nav, .no-print { display: none !important; }
          }
        `}} />

        <div className="print-area p-8 print:p-0">
          <div className="border-b-2 border-black pb-1 mb-2">
            <div className="flex items-center justify-between gap-3">
              {empresaAtual?.logotipo_url ? (
                <img src={empresaAtual.logotipo_url} alt={empresaAtual.apelido || "Logo"} className="h-24 w-24 object-contain" />
              ) : (
                <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/690cd380760c45b456c6ef81/7f0d28c9d_Imagem1.jpg" alt="Logo" className="h-24 w-24 object-contain" />
              )}
              <div className="flex-1 text-center">
                <h1 className="text-base font-bold leading-tight uppercase">{empresaAtual?.nome || 'Empresa'}</h1>
                {empresaAtual?.apelido && <p className="text-xs leading-tight">{empresaAtual.apelido}</p>}
                {empresaAtual?.endereco && (
                  <p className="text-xs leading-tight">
                    {empresaAtual.endereco}{empresaAtual?.cidade && `, ${empresaAtual.cidade}-${empresaAtual.estado}`}
                  </p>
                )}
              </div>
            </div>
            <div>
              <h2 className="text-base font-bold">Relatório Financeiro - {tipoRelatorio === 'analitico' ? 'ANALÍTICO' : 'SINTÉTICO'}</h2>
              {(dataInicio || dataFim) && (
                <p className="text-xs text-gray-600">
                  Período: {dataInicio ? format(new Date(dataInicio), 'dd/MM/yyyy') : 'Início'} a {dataFim ? format(new Date(dataFim), 'dd/MM/yyyy') : 'Hoje'}
                </p>
              )}
            </div>
          </div>

          {tipoRelatorio === 'analitico' ? (
            <Table>
              <TableHeader>
                <TableRow className="border-black">
                  {colunasVisiveis.includes('numero') && <TableHead className="border border-black text-xs font-bold py-1">Nº</TableHead>}
                  {colunasVisiveis.includes('tipo') && <TableHead className="border border-black text-xs font-bold py-1">Tipo</TableHead>}
                  {colunasVisiveis.includes('emissao') && <TableHead className="border border-black text-xs font-bold py-1">Emissão</TableHead>}
                  {colunasVisiveis.includes('vencimento') && <TableHead className="border border-black text-xs font-bold py-1">Vencimento</TableHead>}
                  {colunasVisiveis.includes('fornecedor') && <TableHead className="border border-black text-xs font-bold py-1">Fornec./Cliente</TableHead>}
                  {colunasVisiveis.includes('documento') && <TableHead className="border border-black text-xs font-bold py-1">Doc.</TableHead>}
                  {colunasVisiveis.includes('valor_total') && <TableHead className="border border-black text-xs font-bold text-right py-1">Valor</TableHead>}
                  {colunasVisiveis.includes('valor_pago') && <TableHead className="border border-black text-xs font-bold text-right py-1">Pago</TableHead>}
                  {colunasVisiveis.includes('saldo') && <TableHead className="border border-black text-xs font-bold text-right py-1">Saldo</TableHead>}
                  {colunasVisiveis.includes('status') && <TableHead className="border border-black text-xs font-bold py-1">Status</TableHead>}
                  {colunasVisiveis.includes('centro_custo') && <TableHead className="border border-black text-xs font-bold py-1">C. Custo</TableHead>}
                  {colunasVisiveis.includes('plano_contas') && <TableHead className="border border-black text-xs font-bold py-1">Plano Contas</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {dadosRelatorio.map((l) => (
                  <TableRow key={l.id}>
                    {colunasVisiveis.includes('numero') && <TableCell className="border border-gray-300 text-xs py-1">{l.numero_lancamento}</TableCell>}
                    {colunasVisiveis.includes('tipo') && <TableCell className="border border-gray-300 text-xs py-1">{l.tipo}</TableCell>}
                    {colunasVisiveis.includes('emissao') && <TableCell className="border border-gray-300 text-xs py-1">{format(new Date(l.data_emissao), 'dd/MM/yyyy')}</TableCell>}
                    {colunasVisiveis.includes('vencimento') && <TableCell className="border border-gray-300 text-xs py-1">{format(new Date(l.data_vencimento), 'dd/MM/yyyy')}</TableCell>}
                    {colunasVisiveis.includes('fornecedor') && <TableCell className="border border-gray-300 text-xs py-1">{l.fornecedor_nome || l.cliente_nome || '-'}</TableCell>}
                    {colunasVisiveis.includes('documento') && <TableCell className="border border-gray-300 text-xs py-1">{l.numero_documento || '-'}</TableCell>}
                    {colunasVisiveis.includes('valor_total') && <TableCell className="border border-gray-300 text-xs text-right py-1">{formatarMoeda(l.valor_total)}</TableCell>}
                    {colunasVisiveis.includes('valor_pago') && <TableCell className="border border-gray-300 text-xs text-right py-1">{formatarMoeda(l.valor_pago || 0)}</TableCell>}
                    {colunasVisiveis.includes('saldo') && <TableCell className="border border-gray-300 text-xs text-right py-1 font-semibold">{formatarMoeda((l.valor_total || 0) - (l.valor_pago || 0))}</TableCell>}
                    {colunasVisiveis.includes('status') && <TableCell className="border border-gray-300 text-xs py-1">{l.status}</TableCell>}
                    {colunasVisiveis.includes('centro_custo') && <TableCell className="border border-gray-300 text-xs py-1">{(l.rateio_centros_custo || []).map(r => r.centro_custo_nome).filter(Boolean).join(', ') || '-'}</TableCell>}
                    {colunasVisiveis.includes('plano_contas') && <TableCell className="border border-gray-300 text-xs py-1">{l.plano_contas_nome || '-'}</TableCell>}
                  </TableRow>
                ))}
                <TableRow className="bg-gray-100 font-bold">
                  <TableCell colSpan={colunasVisiveis.filter(cId => cId !== 'valor_total' && cId !== 'valor_pago' && cId !== 'saldo').length} className="border border-black text-xs py-1">
                    TOTAL ({lancamentosFiltrados.length} lançamentos)
                  </TableCell>
                  {colunasVisiveis.includes('valor_total') && <TableCell className="border border-black text-xs text-right py-1">{formatarMoeda(totais.total)}</TableCell>}
                  {colunasVisiveis.includes('valor_pago') && <TableCell className="border border-black text-xs text-right py-1">{formatarMoeda(totais.pago)}</TableCell>}
                  {colunasVisiveis.includes('saldo') && <TableCell className="border border-black text-xs text-right py-1">{formatarMoeda(totais.saldo)}</TableCell>}
                </TableRow>
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-black">
                  {colunasVisiveis.includes('agrupamento') && <TableHead className="border border-black text-xs font-bold py-1">Agrupamento</TableHead>}
                  {colunasVisiveis.includes('quantidade') && <TableHead className="border border-black text-xs font-bold text-right py-1">Qtd</TableHead>}
                  {colunasVisiveis.includes('valor_total') && <TableHead className="border border-black text-xs font-bold text-right py-1">Valor Total</TableHead>}
                  {colunasVisiveis.includes('valor_pago') && <TableHead className="border border-black text-xs font-bold text-right py-1">Total Pago</TableHead>}
                  {colunasVisiveis.includes('saldo') && <TableHead className="border border-black text-xs font-bold text-right py-1">Saldo</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {dadosRelatorio.map((g, idx) => (
                  <TableRow key={idx}>
                    {colunasVisiveis.includes('agrupamento') && <TableCell className="border border-gray-300 text-xs py-1 font-semibold">{g.agrupamento}</TableCell>}
                    {colunasVisiveis.includes('quantidade') && <TableCell className="border border-gray-300 text-xs text-right py-1">{g.quantidade}</TableCell>}
                    {colunasVisiveis.includes('valor_total') && <TableCell className="border border-gray-300 text-xs text-right py-1">{formatarMoeda(g.valor_total)}</TableCell>}
                    {colunasVisiveis.includes('valor_pago') && <TableCell className="border border-gray-300 text-xs text-right py-1">{formatarMoeda(g.valor_pago)}</TableCell>}
                    {colunasVisiveis.includes('saldo') && <TableCell className="border border-gray-300 text-xs text-right py-1 font-semibold">{formatarMoeda(g.saldo)}</TableCell>}
                  </TableRow>
                ))}
                <TableRow className="bg-gray-100 font-bold">
                  {/* Need to ensure correct colSpan for synthetic report totals */}
                  <TableCell colSpan={colunasVisiveis.filter(cId => cId === 'agrupamento').length} className="border border-black text-xs py-1">TOTAL GERAL</TableCell>
                  {colunasVisiveis.includes('quantidade') && <TableCell className="border border-black text-xs text-right py-1">{lancamentosFiltrados.length}</TableCell>}
                  {colunasVisiveis.includes('valor_total') && <TableCell className="border border-black text-xs text-right py-1">{formatarMoeda(totais.total)}</TableCell>}
                  {colunasVisiveis.includes('valor_pago') && <TableCell className="border border-black text-xs text-right py-1">{formatarMoeda(totais.pago)}</TableCell>}
                  {colunasVisiveis.includes('saldo') && <TableCell className="border border-black text-xs text-right py-1">{formatarMoeda(totais.saldo)}</TableCell>}
                </TableRow>
              </TableBody>
            </Table>
          )}

          <div className="mt-6 pt-2 border-t border-gray-300 text-center text-xs text-gray-500">
            <p>Impresso em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
          </div>
        </div>
      </div>
    </div>
  );
}