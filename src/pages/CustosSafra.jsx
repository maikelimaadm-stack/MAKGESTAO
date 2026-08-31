import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, TrendingUp, DollarSign, Package, Users, Calendar, Layers, Download, Upload, FileSpreadsheet, Loader2, AlertCircle, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import TabelaCustos from "../components/custos/TabelaCustos";
import FormularioCusto from "../components/custos/FormularioCusto";
import LancarEntrega from "../components/custos/LancarEntrega";

const getNextSystemNumber = async () => {
  try {
    const [pesagens, fornecedores, produtos, custos] = await Promise.all([
      base44.entities.Pesagem.list(),
      base44.entities.Fornecedor.list(),
      base44.entities.Produto.list(),
      base44.entities.CustoSafra.list()
    ]);

    const numeros = [
      ...pesagens.map(p => parseInt(p.numero_registro) || 0),
      ...fornecedores.map(f => parseInt(f.numero_cadastro) || 0),
      ...produtos.map(p => parseInt(p.numero_produto) || 0),
      ...custos.map(c => parseInt(c.numero_lancamento) || 0)
    ].filter(n => n > 0 && n < 1000000000);

    return numeros.length > 0 ? Math.max(...numeros) + 1 : 1;
  } catch (error) {
    console.error('Erro:', error);
    return 1;
  }
};

export default function CustosSafra() {
  const [showSafraDialog, setShowSafraDialog] = useState(false);
  const [safraAtiva, setSafraAtiva] = useState(null);
  const [showCustoForm, setShowCustoForm] = useState(false);
  const [editingCusto, setEditingCusto] = useState(null);
  const [custoParaEntrega, setCustoParaEntrega] = useState(null);
  const [showImportProgress, setShowImportProgress] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, errors: 0 });
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [importErrors, setImportErrors] = useState([]);
  const [validRecordsToImport, setValidRecordsToImport] = useState([]);

  const queryClient = useQueryClient();
  const empresaSelecionadaId = localStorage.getItem('empresa_selecionada_id');

  const { data: safras = [] } = useQuery({
    queryKey: ['safras', empresaSelecionadaId],
    queryFn: async () => {
      const all = await base44.entities.Safra.list('-created_date');
      return all.filter(s => s.empresa_id === empresaSelecionadaId);
    },
    enabled: !!empresaSelecionadaId,
  });

  React.useEffect(() => {
    if (!safraAtiva && safras.length > 0) {
      const safraEmAndamento = safras.find(s => s.status === 'Em Andamento') || safras[0];
      setSafraAtiva(safraEmAndamento);
    }
  }, [safras, safraAtiva]);

  const { data: custos = [] } = useQuery({
    queryKey: ['custos_safra', safraAtiva?.id],
    queryFn: async () => {
      if (!safraAtiva) return [];
      const all = await base44.entities.CustoSafra.list('-created_date');
      return all.filter(c => c.safra_id === safraAtiva.id);
    },
    enabled: !!safraAtiva,
  });

  React.useEffect(() => {
    const numerarCustosExistentes = async () => {
      if (!empresaSelecionadaId || !safraAtiva) return;
      const custosSemNumero = custos.filter(c => !c.numero_lancamento || c.numero_lancamento === '');
      if (custosSemNumero.length > 0) {
        for (const custo of custosSemNumero) {
          try {
            const proximoNumero = await getNextSystemNumber();
            await base44.entities.CustoSafra.update(custo.id, { numero_lancamento: String(proximoNumero) });
          } catch (error) {
            console.error('Erro:', error);
          }
        }
        queryClient.invalidateQueries({ queryKey: ['custos_safra'] });
      }
    };

    if (custos && custos.length > 0) numerarCustosExistentes();
  }, [custos, queryClient, empresaSelecionadaId, safraAtiva]);

  const { data: fornecedores = [] } = useQuery({
    queryKey: ['fornecedores', empresaSelecionadaId],
    queryFn: async () => {
      const all = await base44.entities.Fornecedor.list();
      return all.filter(f => f.empresa_id === empresaSelecionadaId);
    },
    enabled: !!empresaSelecionadaId,
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos', empresaSelecionadaId],
    queryFn: async () => {
      const all = await base44.entities.Produto.list();
      return all.filter(p => p.empresa_id === empresaSelecionadaId);
    },
    enabled: !!empresaSelecionadaId,
  });

  const createCustoMutation = useMutation({
    mutationFn: (data) => base44.entities.CustoSafra.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custos_safra'] });
      setShowCustoForm(false);
      setEditingCusto(null);
      toast.success('Lançado!');
    },
  });

  const updateCustoMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CustoSafra.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custos_safra'] });
      setShowCustoForm(false);
      setEditingCusto(null);
      toast.success('Atualizado!');
    },
  });

  const deleteCustoMutation = useMutation({
    mutationFn: (id) => base44.entities.CustoSafra.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custos_safra'] });
      toast.success('Excluído!');
    },
  });

  const handleCustoSubmit = async (formData) => {
    const fornecedor = fornecedores.find(f => f.id === formData.fornecedor_id);
    const produto = produtos.find(p => p.id === formData.produto_id);
    const quantidade = parseFloat(formData.quantidade);
    const valorUnitario = parseFloat(formData.valor_unitario);

    const data = {
      empresa_id: empresaSelecionadaId,
      safra_id: safraAtiva.id,
      fornecedor_id: formData.fornecedor_id,
      fornecedor_nome: fornecedor?.nome,
      produto_id: formData.produto_id,
      produto_nome: produto?.nome_produto,
      quantidade: quantidade,
      unidade_medida: produto?.unidade_medida,
      valor_unitario: valorUnitario,
      valor_total: quantidade * valorUnitario,
      prazo_entrega: formData.prazo_entrega || undefined,
      data_entrega: formData.data_entrega || undefined,
      status_entrega: formData.status_entrega,
      forma_pagamento: formData.forma_pagamento,
      observacoes: formData.observacoes,
      quantidade_entregue: 0,
    };

    if (!editingCusto) {
      const proximoNumero = await getNextSystemNumber();
      data.numero_lancamento = String(proximoNumero);
    }

    if (editingCusto) {
      updateCustoMutation.mutate({ id: editingCusto.id, data });
    } else {
      createCustoMutation.mutate(data);
    }
  };

  const handleDeleteCusto = async (id, skipConfirm = false) => {
    if (skipConfirm || window.confirm('Excluir lançamento?')) {
      deleteCustoMutation.mutate(id);
    }
  };

  const handlePrintCusto = (custo) => {
    console.log('Imprimir:', custo);
  };

  const handleLancarEntrega = (custo) => {
    setCustoParaEntrega(custo);
  };

  const handleExport = () => {
    if (!safraAtiva) {
      toast.error('Selecione safra!');
      return;
    }

    const csvRows = [];
    const headers = ['Fornecedor', 'Produto', 'Quantidade', 'Valor Unitário', 'Valor Total', 'Prazo', 'Data Entrega', 'Status', 'Forma Pagamento', 'Obs'];
    csvRows.push(headers.join(';'));

    custos.forEach(c => {
      const row = [
        c.fornecedor_nome || '',
        c.produto_nome || '',
        c.quantidade || 0,
        c.valor_unitario || 0,
        c.valor_total || 0,
        c.prazo_entrega || '',
        c.data_entrega || '',
        c.status_entrega || 'Pendente',
        c.forma_pagamento || '',
        c.observacoes || ''
      ];
      csvRows.push(row.map(item => typeof item === 'string' && item.includes(';') ? `"${item}"` : item).join(';'));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob(['\ufeff' + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `custos_safra_${safraAtiva.ano_inicio}-${safraAtiva.ano_fim}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    toast.success('Exportado!');
  };

  const downloadTemplate = () => {
    const csvRows = [];
    const headers = ['Fornecedor', 'Produto', 'Quantidade', 'Valor Unitário', 'Prazo', 'Status', 'Forma Pgto', 'Obs'];
    csvRows.push(headers.join(';'));
    
    const example = ['FORNECEDOR', 'PRODUTO', '100', '50.00', '2025-12-31', 'Pendente', 'À VISTA', 'OBS'];
    csvRows.push(example.join(';'));

    const csvString = csvRows.join('\n');
    const blob = new Blob(['\ufeff' + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'modelo_custos.csv';
    link.click();
  };

  const downloadErrosImportacao = () => {
    const csvRows = [];
    const headers = ['Linha', 'Erro', 'Fornecedor', 'Produto', 'Qtd', 'Vlr Unit', 'Prazo', 'Status', 'Forma', 'Obs'];
    csvRows.push(headers.join(';'));

    importErrors.forEach(erro => {
      const row = [erro.linha, erro.erro, ...erro.dados.split(';')];
      csvRows.push(row.join(';'));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob(['\ufeff' + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `erros_custos_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const executarImportacao = async (validRecords) => {
    setShowImportProgress(true);
    setImportProgress({ current: 0, total: validRecords.length, errors: 0 });

    let imported = 0;
    let actualErrors = 0;

    for (const record of validRecords) {
      try {
        await base44.entities.CustoSafra.create(record);
        imported++;
        setImportProgress(prev => ({ ...prev, current: prev.current + 1 }));
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        actualErrors++;
        setImportProgress(prev => ({ ...prev, errors: prev.errors + 1 }));
      }
    }

    await queryClient.invalidateQueries({ queryKey: ['custos_safra'] });
    setImportProgress({ current: validRecords.length, total: validRecords.length, errors: actualErrors });

    setTimeout(() => {
      setShowImportProgress(false);
      toast.success(actualErrors > 0 ? `${imported} importados! ${actualErrors} erro(s).` : `${imported} importados!`);
    }, 1000);
  };

  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!safraAtiva) {
      toast.error('Selecione safra!');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length <= 1) {
          toast.error('Arquivo vazio!');
          return;
        }

        let proximoNumero = await getNextSystemNumber();
        const validRecords = [];
        const errors = [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(';');
          
          if (values.length < 4) {
            errors.push({ linha: i + 1, erro: 'Colunas insuficientes', dados: lines[i] });
            continue;
          }

          try {
            const fornecedorNome = values[0]?.trim()?.toUpperCase();
            const produtoNome = values[1]?.trim()?.toUpperCase();
            const quantidade = parseFloat(values[2]?.replace(',', '.'));
            const valorUnitario = parseFloat(values[3]?.replace(',', '.'));

            if (!fornecedorNome || !produtoNome || isNaN(quantidade) || isNaN(valorUnitario)) {
              throw new Error("Campos obrigatórios faltando");
            }

            const fornecedor = fornecedores.find(f => f.nome?.toUpperCase() === fornecedorNome);
            const produto = produtos.find(p => p.nome_produto?.toUpperCase() === produtoNome);

            if (!fornecedor) throw new Error(`Fornecedor não encontrado: ${fornecedorNome}`);
            if (!produto) throw new Error(`Produto não encontrado: ${produtoNome}`);

            validRecords.push({
              empresa_id: empresaSelecionadaId,
              safra_id: safraAtiva.id,
              numero_lancamento: String(proximoNumero),
              fornecedor_id: fornecedor.id,
              fornecedor_nome: fornecedor.nome,
              produto_id: produto.id,
              produto_nome: produto.nome_produto,
              quantidade,
              unidade_medida: produto.unidade_medida,
              valor_unitario: valorUnitario,
              valor_total: quantidade * valorUnitario,
              prazo_entrega: values[4]?.trim() || undefined,
              status_entrega: values[5]?.trim() || 'Pendente',
              forma_pagamento: values[6]?.trim()?.toUpperCase() || undefined,
              observacoes: values[7]?.trim()?.toUpperCase() || undefined,
              quantidade_entregue: 0
            });
            proximoNumero++;
          } catch (err) {
            errors.push({ linha: i + 1, erro: err.message || 'Erro', dados: lines[i] });
          }
        }

        if (errors.length > 0) {
          setImportErrors(errors);
          setValidRecordsToImport(validRecords);
          setShowErrorDialog(true);
          return;
        }

        if (validRecords.length === 0) {
          toast.error('Nenhum registro válido!');
          return;
        }

        await executarImportacao(validRecords);
      } catch (error) {
        toast.error('Erro ao importar!');
      }
    };
    reader.readAsText(file, 'UTF-8');
    event.target.value = '';
  };

  const formatarNumero = (numero) => {
    if (!numero && numero !== 0) return "0,00";
    return numero.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const formatarMoeda = (valor) => {
    if (!valor && valor !== 0) return "R$ 0,00";
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const progressPercentage = importProgress.total > 0 ? Math.round((importProgress.current / importProgress.total) * 100) : 0;

  const totalGeralSafra = custos.reduce((sum, c) => sum + (c.valor_total || 0), 0);
  const custosPorFornecedor = custos.reduce((acc, c) => {
    if (!acc[c.fornecedor_nome]) acc[c.fornecedor_nome] = 0;
    acc[c.fornecedor_nome] += c.valor_total || 0;
    return acc;
  }, {});

  if (!safraAtiva && safras.length === 0) {
    return (
      <div className="p-4 md:p-6">
        <Card className="shadow-sm">
          <CardContent className="p-12 text-center">
            <Layers className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-700 mb-2">Nenhuma Safra</h2>
            <p className="text-xs text-slate-500 mb-6">Cadastre uma safra primeiro</p>
            <Button onClick={() => setShowSafraDialog(true)} size="sm" className="h-8 gap-1 text-xs">
              <Plus className="w-3.5 h-3.5" />
              Cadastrar Safra
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-2">
      {!showCustoForm && safraAtiva && (
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Custos de Safra</h1>
              <p className="text-xs text-slate-600">Safra: {safraAtiva.ano_inicio}/{safraAtiva.ano_fim}</p>
            </div>
            <div className="flex gap-2">
              <Select value={safraAtiva?.id || ''} onValueChange={(value) => {
                setSafraAtiva(safras.find(s => s.id === value));
                setShowCustoForm(false);
                setEditingCusto(null);
              }}>
                <SelectTrigger className="h-8 text-xs w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {safras.map((safra) => (
                    <SelectItem key={safra.id} value={safra.id} className="text-xs">{safra.ano_inicio}/{safra.ano_fim}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => setShowSafraDialog(true)} className="h-8 text-xs">
                Safra
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mb-2">
            <Card className="shadow-sm border-l-4 border-l-emerald-500">
              <CardContent className="p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-medium text-slate-600 mb-0.5 truncate leading-tight">Total da Safra</p>
                    <p className="text-lg font-bold text-emerald-700 truncate leading-tight">{formatarMoeda(totalGeralSafra)}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate leading-tight">Valor investido</p>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="shadow-sm border-l-4 border-l-blue-500">
              <CardContent className="p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-medium text-slate-600 mb-0.5 truncate leading-tight">Fornecedores</p>
                    <p className="text-lg font-bold text-blue-700 truncate leading-tight">{Object.keys(custosPorFornecedor).length}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate leading-tight">Ativos</p>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-l-4 border-l-violet-500">
              <CardContent className="p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-medium text-slate-600 mb-0.5 truncate leading-tight">Lançamentos</p>
                    <p className="text-lg font-bold text-violet-700 truncate leading-tight">{custos.length}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate leading-tight">Custos</p>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                    <Package className="w-3.5 h-3.5 text-violet-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleExport} variant="outline" size="sm" className="h-8 text-xs">
              Exportar
            </Button>
            <div>
              <input type="file" accept=".csv" onChange={handleImport} className="hidden" id="import-custos" />
              <Button onClick={() => document.getElementById('import-custos').click()} variant="outline" size="sm" className="h-8 text-xs" disabled={showImportProgress}>
                Importar
              </Button>
            </div>
            <Button onClick={downloadTemplate} variant="outline" size="sm" className="h-8 text-xs">
              Modelo
            </Button>
            <Button onClick={() => { setEditingCusto(null); setShowCustoForm(true); }} size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 ml-auto">
              Novo Lançamento
            </Button>
          </div>
        </>
      )}

      <AnimatePresence>
        {showCustoForm && safraAtiva && (
          <FormularioCusto
            onSubmit={handleCustoSubmit}
            onCancel={() => { setShowCustoForm(false); setEditingCusto(null); }}
            initialData={editingCusto}
            isEditing={!!editingCusto}
            fornecedores={fornecedores}
            produtos={produtos}
          />
        )}
      </AnimatePresence>

      {!showCustoForm && safraAtiva && (
        <TabelaCustos
          custos={custos}
          fornecedores={fornecedores}
          onEdit={(custo) => { setEditingCusto(custo); setShowCustoForm(true); }}
          onDelete={handleDeleteCusto}
          onPrint={handlePrintCusto}
          onLancarEntrega={handleLancarEntrega}
          isLoading={false}
        />
      )}

      <LancarEntrega custo={custoParaEntrega} open={!!custoParaEntrega} onClose={() => setCustoParaEntrega(null)} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['custos_safra'] }); setCustoParaEntrega(null); }} />

      <Dialog open={showSafraDialog} onOpenChange={setShowSafraDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Layers className="w-4 h-4 text-emerald-600" />
              Gerenciar Safras
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {safras.map((safra) => (
              <Card key={safra.id} className="shadow-sm">
                <CardContent className="p-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold text-sm text-slate-900">{safra.ano_inicio}/{safra.ano_fim}</p>
                      <p className="text-xs text-slate-600">{safra.descricao}</p>
                    </div>
                    <Button size="sm" variant={safraAtiva?.id === safra.id ? "default" : "outline"} onClick={() => { setSafraAtiva(safra); setShowSafraDialog(false); }} className="h-7 text-xs">
                      {safraAtiva?.id === safra.id ? 'Ativa' : 'Selecionar'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm text-orange-700">
              <AlertCircle className="w-4 h-4" />
              Erros na Importação
            </DialogTitle>
            <DialogDescription className="text-xs">
              {importErrors.length} erro(s). {validRecordsToImport.length > 0 && `${validRecordsToImport.length} válido(s).`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto border rounded">
            <Table>
              <TableHeader className="sticky top-0 bg-white">
                <TableRow>
                  <TableHead className="w-16 text-xs">Linha</TableHead>
                  <TableHead className="text-xs">Erro</TableHead>
                  <TableHead className="text-xs">Dados</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importErrors.map((erro, idx) => (
                  <TableRow key={idx} className="text-xs">
                    <TableCell className="font-bold text-orange-700">{erro.linha}</TableCell>
                    <TableCell className="text-red-600">{erro.erro}</TableCell>
                    <TableCell className="font-mono text-slate-600">{erro.dados}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-between pt-3 border-t">
            <Button variant="outline" onClick={downloadErrosImportacao} size="sm" className="h-8 gap-1 text-xs text-orange-700">
              <Download className="w-3.5 h-3.5" />
              Baixar Erros
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setShowErrorDialog(false); setImportErrors([]); setValidRecordsToImport([]); }} size="sm" className="h-8 gap-1 text-xs">
                <X className="w-3.5 h-3.5" />
                Cancelar
              </Button>
              {validRecordsToImport.length > 0 && (
                <Button onClick={() => { setShowErrorDialog(false); executarImportacao(validRecordsToImport); }} size="sm" className="h-8 gap-1 text-xs bg-orange-600">
                  <Upload className="w-3.5 h-3.5" />
                  Importar {validRecordsToImport.length}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showImportProgress} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              Importando
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span>Progresso</span>
                <span className="font-semibold">{importProgress.current}/{importProgress.total}</span>
              </div>
              <Progress value={progressPercentage} className="h-1.5" />
              <p className="text-center text-xs font-semibold text-emerald-600">{progressPercentage}%</p>
            </div>
            {importProgress.errors > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded p-2">
                <p className="text-xs text-orange-800">⚠️ {importProgress.errors} erro(s)</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}