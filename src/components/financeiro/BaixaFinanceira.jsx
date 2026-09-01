import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, Save, X, AlertCircle, Edit, Trash2, Paperclip, FileText } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calcularStatusLancamento } from "@/lib/financeiroStatus";

const FORMAS_PAGAMENTO_PADRAO = [
  'Dinheiro',
  'PIX',
  'Cartão de Crédito',
  'Cartão de Débito',
  'Boleto Bancário',
  'Transferência Bancária',
  'Cheque',
  'Crédito Loja',
  'Vale Alimentação',
  'Vale Refeição',
  'Depósito Bancário',
  'Outros'
];

const formatarNumero = (num) => {
  if (!num && num !== 0) return '0,00';
  const numero = typeof num === 'number' ? num : parseFloat(String(num).replace(/\./g, '').replace(',', '.'));
  if (isNaN(numero)) return '0,00';
  return numero.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const parseNumero = (str) => {
  if (!str) return 0;
  return parseFloat(String(str).replace(/\./g, '').replace(',', '.')) || 0;
};

const formatarMoeda = (valor) => {
  if (!valor && valor !== 0) return "R$ 0,00";
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const parseMoeda = (str) => {
  if (!str) return 0;
  return parseFloat(String(str).replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
};

const formatarDataHora = (dataString) => {
  if (!dataString) return '-';
  try {
    const date = new Date(dataString);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleString('pt-BR');
  } catch {
    return '-';
  }
};

export default function BaixaFinanceira({ lancamento, onClose, onSuccess, dadosLote }) {
  const saldoInicial = lancamento ? (lancamento.valor_total || 0) - (lancamento.valor_pago || 0) : 0;
  
  const [formData, setFormData] = useState(() => {
    if (dadosLote) {
      return {
        data_baixa: dadosLote.data_baixa || new Date().toISOString().split('T')[0],
        valor_baixa: formatarMoeda(saldoInicial),
        valor_juros: "R$ 0,00",
        valor_multa: "R$ 0,00",
        valor_desconto: "R$ 0,00",
        forma_pagamento_id: dadosLote.forma_pagamento_id || "",
        numero_comprovante: "",
        observacoes: dadosLote.observacoes || "",
        anexos: [],
        proxima_previsao: ""
      };
    }
    
    return {
      data_baixa: new Date().toISOString().split('T')[0],
      valor_baixa: formatarMoeda(saldoInicial),
      valor_juros: "R$ 0,00",
      valor_multa: "R$ 0,00",
      valor_desconto: "R$ 0,00",
      forma_pagamento_id: "",
      numero_comprovante: "",
      observacoes: "",
      anexos: [],
      proxima_previsao: ""
    };
  });

  const [editandoBaixa, setEditandoBaixa] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [user, setUser] = useState(null);
  const empresaSelecionadaId = localStorage.getItem('empresa_selecionada_id');
  const queryClient = useQueryClient();

  React.useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const { data: baixasAnteriores = [], refetch: refetchBaixas } = useQuery({
    queryKey: ['baixas_anteriores', lancamento.id],
    queryFn: async () => {
      const all = await base44.entities.BaixaFinanceira.list('-data_baixa');
      return all.filter(b => b.lancamento_id === lancamento.id);
    },
  });

  const getNextBaixaNumber = async () => {
    const all = await base44.entities.BaixaFinanceira.list();
    const filtered = all.filter(b => b.empresa_id === empresaSelecionadaId);
    const maxNum = filtered.reduce((max, b) => Math.max(max, parseInt(b.numero_baixa) || 0), 0);
    return maxNum + 1;
  };

  const baixaMutation = useMutation({
    mutationFn: async (data) => {
      const numero = await getNextBaixaNumber();
      
      const baixa = {
        empresa_id: empresaSelecionadaId,
        numero_baixa: String(numero),
        lancamento_id: lancamento.id,
        data_baixa: data.data_baixa,
        valor_baixa: parseMoeda(data.valor_baixa),
        valor_juros: parseMoeda(data.valor_juros),
        valor_multa: parseMoeda(data.valor_multa),
        valor_desconto: parseMoeda(data.valor_desconto),
        forma_pagamento_id: data.forma_pagamento_id || undefined,
        forma_pagamento_nome: data.forma_pagamento_id,
        numero_comprovante: data.numero_comprovante?.toUpperCase() || undefined,
        observacoes: data.observacoes?.toUpperCase() || undefined,
        usuario_responsavel: user?.email,
        anexos: data.anexos || []
      };

      const baixaCriada = await base44.entities.BaixaFinanceira.create(baixa);

      const totalPago = (lancamento.valor_pago || 0) + parseMoeda(data.valor_baixa);
      const novoStatus = calcularStatusLancamento(lancamento.tipo, lancamento.valor_total, totalPago);

      const updateData = {
        valor_pago: totalPago,
        status: novoStatus
      };

      // Se baixa parcial e tem próxima previsão, atualizar vencimento
      const saldoRestante = (lancamento.valor_total || 0) - totalPago;
      if (saldoRestante > 0.01 && data.proxima_previsao) {
        updateData.data_vencimento = data.proxima_previsao;
      }

      await base44.entities.LancamentoFinanceiro.update(lancamento.id, updateData);

      return baixaCriada;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lancamentos_financeiros'] });
      queryClient.invalidateQueries({ queryKey: ['baixas_financeiro'] });
      refetchBaixas();
      setFormData({
        data_baixa: new Date().toISOString().split('T')[0],
        valor_baixa: "R$ 0,00",
        valor_juros: "R$ 0,00",
        valor_multa: "R$ 0,00",
        valor_desconto: "R$ 0,00",
        forma_pagamento_id: "",
        numero_comprovante: "",
        observacoes: "",
        anexos: [],
        proxima_previsao: ""
      });
      toast.success('Baixa registrada com sucesso!');
      if (onSuccess) onSuccess();
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao registrar baixa.');
    }
  });

  const updateBaixaMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      await base44.entities.BaixaFinanceira.update(id, {
        data_baixa: data.data_baixa,
        valor_baixa: parseMoeda(data.valor_baixa),
        valor_juros: parseMoeda(data.valor_juros || 0),
        valor_multa: parseMoeda(data.valor_multa || 0),
        valor_desconto: parseMoeda(data.valor_desconto || 0),
        forma_pagamento_id: data.forma_pagamento_id || undefined,
        forma_pagamento_nome: data.forma_pagamento_id,
        numero_comprovante: data.numero_comprovante?.toUpperCase() || undefined,
        observacoes: data.observacoes?.toUpperCase() || undefined,
        anexos: data.anexos || []
      });

      const allBaixas = await base44.entities.BaixaFinanceira.list();
      const baixasDoLancamento = allBaixas.filter(b => b.lancamento_id === lancamento.id);
      const totalPago = baixasDoLancamento.reduce((sum, b) => sum + (b.valor_baixa || 0), 0);
      const novoStatus = calcularStatusLancamento(lancamento.tipo, lancamento.valor_total, totalPago);

      await base44.entities.LancamentoFinanceiro.update(lancamento.id, {
        valor_pago: totalPago,
        status: novoStatus
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lancamentos_financeiros'] });
      queryClient.invalidateQueries({ queryKey: ['baixas_financeiro'] });
      refetchBaixas();
      setEditandoBaixa(null);
      toast.success('Baixa atualizada com sucesso!');
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao atualizar baixa.');
    }
  });

  const deleteBaixaMutation = useMutation({
    mutationFn: async (baixaId) => {
      await base44.entities.BaixaFinanceira.delete(baixaId);

      const allBaixas = await base44.entities.BaixaFinanceira.list();
      const baixasRestantes = allBaixas.filter(b => b.lancamento_id === lancamento.id);
      const totalPago = baixasRestantes.reduce((sum, b) => sum + (b.valor_baixa || 0), 0);
      const novoStatus = calcularStatusLancamento(lancamento.tipo, lancamento.valor_total, totalPago);

      await base44.entities.LancamentoFinanceiro.update(lancamento.id, {
        valor_pago: totalPago,
        status: novoStatus
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lancamentos_financeiros'] });
      queryClient.invalidateQueries({ queryKey: ['baixas_financeiro'] });
      refetchBaixas();
      toast.success('Baixa excluída com sucesso!');
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao excluir baixa.');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    const valorBaixa = parseMoeda(formData.valor_baixa);
    const saldoDisponivel = (lancamento.valor_total || 0) - (lancamento.valor_pago || 0);

    if (valorBaixa <= 0) {
      toast.error('Valor da baixa deve ser maior que zero!');
      return;
    }

    if (valorBaixa > saldoDisponivel) {
      toast.error(`Valor da baixa não pode ser maior que o saldo (${formatarMoeda(saldoDisponivel)})!`);
      return;
    }

    // Verificar se é baixa parcial
    const saldoAposBaixa = saldoDisponivel - valorBaixa;
    const eBaixaParcial = saldoAposBaixa > 0.01;

    // Se for baixa parcial e não tem próxima previsão, perguntar
    if (eBaixaParcial && !formData.proxima_previsao) {
      toast.error('Por favor, informe a próxima previsão de pagamento para baixa parcial!');
      return;
    }

    const confirmMsg = dadosLote?.baixa_automatica_lote 
      ? `Confirma a baixa de ${formatarMoeda(valorBaixa)}?`
      : `Confirma a baixa de ${formatarMoeda(valorBaixa)} para este lançamento?${eBaixaParcial ? `\n\nRestará um saldo de ${formatarMoeda(saldoAposBaixa)} e a data de vencimento do lançamento será atualizada para ${new Date(formData.proxima_previsao).toLocaleDateString('pt-BR')}.` : ''}`;

    if (window.confirm(confirmMsg)) {
      baixaMutation.mutate(formData);
    }
  };

  const handleEditarBaixa = (baixa) => {
    setEditandoBaixa({
      id: baixa.id,
      data_baixa: baixa.data_baixa,
      valor_baixa: formatarMoeda(baixa.valor_baixa),
      valor_juros: formatarMoeda(baixa.valor_juros || 0),
      valor_multa: formatarMoeda(baixa.valor_multa || 0),
      valor_desconto: formatarMoeda(baixa.valor_desconto || 0),
      forma_pagamento_id: baixa.forma_pagamento_id || "",
      numero_comprovante: baixa.numero_comprovante || "",
      observacoes: baixa.observacoes || "",
      anexos: baixa.anexos || []
    });
  };

  const handleSalvarEdicao = () => {
    if (parseMoeda(editandoBaixa.valor_baixa) <= 0) {
      toast.error('Valor da baixa deve ser maior que zero!');
      return;
    }

    updateBaixaMutation.mutate({ id: editandoBaixa.id, data: editandoBaixa });
  };

  const handleExcluirBaixa = (baixaId) => {
    if (window.confirm('⚠️ Confirma a exclusão desta baixa?')) {
      deleteBaixaMutation.mutate(baixaId);
    }
  };

  const handleUploadAnexo = async (e, tipo = 'nova') => {
    const file = e.target.files[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('Arquivo muito grande! Máximo 10MB');
      return;
    }

    setUploadingFile(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      const anexo = {
        nome: file.name,
        url: file_url,
        tipo: file.type,
        tamanho: file.size
      };

      if (tipo === 'nova') {
        setFormData(prev => ({
          ...prev,
          anexos: [...prev.anexos, anexo]
        }));
      } else {
        setEditandoBaixa(prev => ({
          ...prev,
          anexos: [...prev.anexos, anexo]
        }));
      }
      
      toast.success('✅ Arquivo anexado!');
    } catch (error) {
      toast.error('Erro ao fazer upload');
    } finally {
      e.target.value = '';
      setUploadingFile(false);
    }
  };

  const handleRemoverAnexo = (index, tipo = 'nova') => {
    if (tipo === 'nova') {
      setFormData(prev => ({
        ...prev,
        anexos: prev.anexos.filter((_, i) => i !== index)
      }));
    } else {
      setEditandoBaixa(prev => ({
        ...prev,
        anexos: prev.anexos.filter((_, i) => i !== index)
      }));
    }
    toast.success('Anexo removido!');
  };

  const totalBaixa = parseMoeda(formData.valor_baixa) + parseMoeda(formData.valor_juros) + parseMoeda(formData.valor_multa) - parseMoeda(formData.valor_desconto);
  const totalBaixaEdit = editandoBaixa ? parseMoeda(editandoBaixa.valor_baixa) + parseMoeda(editandoBaixa.valor_juros) + parseMoeda(editandoBaixa.valor_multa) - parseMoeda(editandoBaixa.valor_desconto) : 0;

  // Calcular se a baixa atual será parcial
  const valorBaixaAtual = parseMoeda(formData.valor_baixa);
  const saldoAposBaixaAtual = saldoInicial - valorBaixaAtual;
  const isBaixaParcial = saldoAposBaixaAtual > 0.01 && valorBaixaAtual > 0;

  if (!lancamento) return null;

  return (
    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
      <Card className="shadow-sm border-slate-300 bg-white">
        <CardHeader className="flex flex-col space-y-1.5 p-6 bg-slate-50 border-b py-1 px-1">
          <CardTitle className="text-sm font-semibold text-slate-900 px-1">
            Baixas - Lançamento #{lancamento.numero_lancamento}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-1 space-y-1">
          <Alert className="border-slate-300 py-2">
            <AlertCircle className="h-3.5 w-3.5" />
            <AlertDescription>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div><strong>Nº:</strong> {formatarNumero(parseInt(lancamento.numero_lancamento || 0))}</div>
                <div><strong>Tipo:</strong> {lancamento.tipo}</div>
                <div><strong>Total:</strong> {formatarMoeda(lancamento.valor_total || 0)}</div>
                <div><strong>Saldo:</strong> <span className="font-semibold">{formatarMoeda((lancamento.valor_total || 0) - (lancamento.valor_pago || 0))}</span></div>
              </div>
            </AlertDescription>
          </Alert>

          {baixasAnteriores.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Histórico</Label>
              <div className="border rounded overflow-auto max-h-48">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs">Data</TableHead>
                      <TableHead className="text-xs text-right">Valor</TableHead>
                      <TableHead className="text-xs">Forma</TableHead>
                      <TableHead className="text-xs text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {baixasAnteriores.map(b => (
                      <TableRow key={b.id}>
                        <TableCell className="text-xs">{new Date(b.data_baixa).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell className="text-xs font-semibold text-right">{formatarMoeda(b.valor_baixa)}</TableCell>
                        <TableCell className="text-xs">{b.forma_pagamento_nome || '-'}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex gap-0.5 justify-center">
                            <Button size="sm" variant="ghost" onClick={() => handleEditarBaixa(b)} className="h-6 w-6 p-0 text-slate-600">
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleExcluirBaixa(b.id)} className="h-6 w-6 p-0 text-red-600">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {editandoBaixa && (
            <Card className="bg-slate-50 border-slate-300">
              <CardHeader className="py-1.5 px-2">
                <CardTitle className="text-xs font-semibold">Editar Baixa</CardTitle>
              </CardHeader>
              <CardContent className="p-2 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Data *</Label>
                    <Input type="date" value={editandoBaixa.data_baixa} onChange={(e) => setEditandoBaixa({ ...editandoBaixa, data_baixa: e.target.value })} required className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Forma Pgto</Label>
                    <Select value={editandoBaixa.forma_pagamento_id} onValueChange={(v) => setEditandoBaixa({ ...editandoBaixa, forma_pagamento_id: v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {FORMAS_PAGAMENTO_PADRAO.map(forma => (
                          <SelectItem key={forma} value={forma} className="text-xs">{forma}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Valor *</Label>
                    <Input value={editandoBaixa.valor_baixa} onChange={(e) => setEditandoBaixa({ ...editandoBaixa, valor_baixa: e.target.value })} placeholder="R$ 0,00" required className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Juros</Label>
                    <Input value={editandoBaixa.valor_juros} onChange={(e) => setEditandoBaixa({ ...editandoBaixa, valor_juros: e.target.value })} placeholder="R$ 0,00" className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Multa</Label>
                    <Input value={editandoBaixa.valor_multa} onChange={(e) => setEditandoBaixa({ ...editandoBaixa, valor_multa: e.target.value })} placeholder="R$ 0,00" className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Desc.</Label>
                    <Input value={editandoBaixa.valor_desconto} onChange={(e) => setEditandoBaixa({ ...editandoBaixa, valor_desconto: e.target.value })} placeholder="R$ 0,00" className="h-8 text-xs" />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Comprovante</Label>
                  <Input value={editandoBaixa.numero_comprovante} onChange={(e) => setEditandoBaixa({ ...editandoBaixa, numero_comprovante: e.target.value })} placeholder="NÚMERO" className="uppercase h-8 text-xs" style={{ textTransform: 'uppercase' }} />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Observações</Label>
                  <Textarea value={editandoBaixa.observacoes} onChange={(e) => setEditandoBaixa({ ...editandoBaixa, observacoes: e.target.value })} placeholder="OBSERVAÇÕES..." className="uppercase text-xs" style={{ textTransform: 'uppercase' }} rows={2} />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-2">
                    <Paperclip className="w-3 h-3" />
                    Anexar Documentos
                  </Label>
                  <Input
                    type="file"
                    onChange={(e) => handleUploadAnexo(e, 'editar')}
                    disabled={uploadingFile}
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="h-8 text-xs"
                  />
                  
                  {editandoBaixa.anexos?.length > 0 && (
                    <div className="space-y-1">
                      {editandoBaixa.anexos.map((anexo, index) => (
                        <div key={index} className="flex items-center justify-between p-1.5 bg-white rounded border text-xs">
                          <div className="flex items-center gap-1.5">
                            <FileText className="w-3 h-3 text-slate-400" />
                            <a href={anexo.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">{anexo.nome}</a>
                            <span className="text-slate-500">({(anexo.tamanho / 1024).toFixed(0)} KB)</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoverAnexo(index, 'editar')}
                            className="h-5 w-5 text-red-600"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Card className="bg-white border-slate-300">
                  <CardContent className="p-2">
                    <div className="text-xs">
                      <span>Total:</span>
                      <span className="ml-2 font-semibold">{formatarMoeda(totalBaixaEdit)}</span>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button type="button" variant="outline" onClick={() => setEditandoBaixa(null)} className="h-7 text-xs">
                    Cancelar
                  </Button>
                  <Button onClick={handleSalvarEdicao} className="bg-slate-700 hover:bg-slate-800 h-7 text-xs" disabled={updateBaixaMutation.isPending}>
                    Salvar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Data *</Label>
                <Input type="date" value={formData.data_baixa} onChange={(e) => setFormData({ ...formData, data_baixa: e.target.value })} required className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Forma Pgto</Label>
                <Select value={formData.forma_pagamento_id} onValueChange={(v) => setFormData({ ...formData, forma_pagamento_id: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {FORMAS_PAGAMENTO_PADRAO.map(forma => (
                      <SelectItem key={forma} value={forma} className="text-xs">{forma}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Valor *</Label>
                <Input value={formData.valor_baixa} onChange={(e) => setFormData({ ...formData, valor_baixa: e.target.value })} placeholder="R$ 0,00" required className="h-8 text-xs font-semibold" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Juros</Label>
                <Input value={formData.valor_juros} onChange={(e) => setFormData({ ...formData, valor_juros: e.target.value })} placeholder="R$ 0,00" className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Multa</Label>
                <Input value={formData.valor_multa} onChange={(e) => setFormData({ ...formData, valor_multa: e.target.value })} placeholder="R$ 0,00" className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Desc.</Label>
                <Input value={formData.valor_desconto} onChange={(e) => setFormData({ ...formData, valor_desconto: e.target.value })} placeholder="R$ 0,00" className="h-8 text-xs" />
              </div>
            </div>

            {isBaixaParcial && (
              <div className="space-y-1 bg-orange-50 border border-orange-200 rounded p-2">
                <Label className="text-xs font-semibold text-orange-800 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Baixa Parcial - Próxima Previsão de Pagamento *
                </Label>
                <Input 
                  type="date" 
                  value={formData.proxima_previsao} 
                  onChange={(e) => setFormData({ ...formData, proxima_previsao: e.target.value })} 
                  required 
                  className="h-8 text-xs bg-white" 
                />
                <p className="text-[10px] text-orange-700">
                  Restará um saldo de <strong>{formatarMoeda(saldoAposBaixaAtual)}</strong>
                </p>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Comprovante</Label>
              <Input value={formData.numero_comprovante} onChange={(e) => setFormData({ ...formData, numero_comprovante: e.target.value })} placeholder="NÚMERO" className="uppercase h-8 text-xs" style={{ textTransform: 'uppercase' }} />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Observações</Label>
              <Textarea value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} placeholder="OBSERVAÇÕES..." className="uppercase text-xs" style={{ textTransform: 'uppercase' }} rows={2} />
            </div>

            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-2">
                <Paperclip className="w-3 h-3" />
                Anexar Documentos
              </Label>
              <Input
                type="file"
                onChange={(e) => handleUploadAnexo(e, 'nova')}
                disabled={uploadingFile}
                accept=".pdf,.jpg,.jpeg,.png"
                className="h-8 text-xs"
              />
              
              {formData.anexos.length > 0 && (
                <div className="space-y-1">
                  {formData.anexos.map((anexo, index) => (
                    <div key={index} className="flex items-center justify-between p-1.5 bg-white rounded border text-xs">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3 h-3 text-slate-400" />
                        <span className="font-medium">{anexo.nome}</span>
                        <span className="text-slate-500">({(anexo.tamanho / 1024).toFixed(0)} KB)</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoverAnexo(index, 'nova')}
                        className="h-5 w-5 text-red-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Card className="bg-slate-50 border-slate-300">
              <CardContent className="p-2">
                <div className="space-y-0.5 text-xs">
                  <div className="flex justify-between"><span>Valor:</span><span className="font-mono">{formatarMoeda(parseMoeda(formData.valor_baixa))}</span></div>
                  <div className="flex justify-between"><span>+ Juros:</span><span className="font-mono">{formatarMoeda(parseMoeda(formData.valor_juros))}</span></div>
                  <div className="flex justify-between"><span>+ Multa:</span><span className="font-mono">{formatarMoeda(parseMoeda(formData.valor_multa))}</span></div>
                  <div className="flex justify-between text-red-600"><span>- Desc.:</span><span className="font-mono">{formatarMoeda(parseMoeda(formData.valor_desconto))}</span></div>
                  <div className="border-t pt-1 flex justify-between font-semibold"><span>TOTAL:</span><span>{formatarMoeda(totalBaixa)}</span></div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={onClose} className="h-8 text-xs">Fechar</Button>
              <Button type="submit" className="bg-slate-700 hover:bg-slate-800 h-8 text-xs" disabled={baixaMutation.isPending}>Confirmar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}