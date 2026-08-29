import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Settings, Download, Upload, FileSpreadsheet, Loader2, AlertCircle, X, Plus } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";


import FormularioProduto from "../components/produtos/FormularioProduto";
import TabelaProdutos from "../components/produtos/TabelaProdutos";
import FichaProduto from "../components/produtos/FichaProduto";

// Função global para obter próximo número único do sistema
const getNextSystemNumber = async () => {
  try {
    const [pesagens, fornecedores, produtos] = await Promise.all([
      base44.entities.Pesagem.list(),
      base44.entities.Fornecedor.list(),
      base44.entities.Produto.list()
    ]);

    const numeros = [
      ...pesagens.map(p => parseInt(p.numero_registro) || 0),
      ...fornecedores.map(f => parseInt(f.numero_cadastro) || 0),
      ...produtos.map(p => parseInt(p.numero_produto) || 0)
    ].filter(n => n > 0 && n < 1000000000); // Filtrar timestamps acidentais

    return numeros.length > 0 ? Math.max(...numeros) + 1 : 1;
  } catch (error) {
    console.error('Erro:', error);
    // Em caso de erro, retornar 1 ao invés de timestamp
    return 1;
  }
};

export default function Produtos() {
  const [showForm, setShowForm] = useState(false);
  const [editingProduto, setEditingProduto] = useState(null);
  const [fichaProduto, setFichaProduto] = useState(null);
  const [showImportProgress, setShowImportProgress] = useState(false);
  const [showConfigColunas, setShowConfigColunas] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, errors: 0 });

  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [importErrors, setImportErrors] = useState([]);
  const [validRecordsToImport, setValidRecordsToImport] = useState([]);

  const queryClient = useQueryClient();

  // Pegar empresa selecionada
  const empresaSelecionadaId = localStorage.getItem('empresa_selecionada_id');

  const { data: produtos, isLoading, refetch } = useQuery({
    queryKey: ['produtos', empresaSelecionadaId],
    queryFn: async () => {
      const allProdutos = await base44.entities.Produto.list('-created_date');
      // Filtrar apenas produtos da empresa selecionada
      return allProdutos.filter(p => p.empresa_id === empresaSelecionadaId);
    },
    initialData: [],
    enabled: !!empresaSelecionadaId,
  });

  // Numerar produtos existentes automaticamente
  React.useEffect(() => {
    const numerarProdutosExistentes = async () => {
      if (!empresaSelecionadaId) return; // Ensure we have a selected company

      const produtosSemNumero = produtos.filter(p => !p.numero_produto || p.numero_produto === '');
      
      if (produtosSemNumero.length > 0) {
        for (const produto of produtosSemNumero) {
          try {
            const proximoNumero = await getNextSystemNumber();
            await base44.entities.Produto.update(produto.id, {
              numero_produto: String(proximoNumero)
            });
          } catch (error) {
            console.error(`Erro:`, error);
          }
        }
        
        queryClient.invalidateQueries({ queryKey: ['produtos', empresaSelecionadaId] });
      }
    };

    if (!isLoading && produtos && produtos.length > 0 && empresaSelecionadaId) {
      numerarProdutosExistentes();
    }
  }, [produtos, queryClient, isLoading, empresaSelecionadaId]);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Validar se já existe produto com mesmo nome E mesma empresa
      const existente = produtos.find(p => 
        p.nome_produto.toUpperCase().trim() === data.nome_produto.toUpperCase().trim() && 
        p.empresa_id === empresaSelecionadaId &&
        (!editingProduto || p.id !== editingProduto.id)
      );
      
      if (existente) {
        throw new Error('Já existe produto com este nome!');
      }
      
      return base44.entities.Produto.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos', empresaSelecionadaId] });
      setShowForm(false);
      setEditingProduto(null);
      toast.success('Produto cadastrado!');
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao salvar.');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, oldData }) => {
      // Validar se já existe produto com mesmo nome E mesma empresa
      const existente = produtos.find(p => 
        p.nome_produto.toUpperCase().trim() === data.nome_produto.toUpperCase().trim() && 
        p.empresa_id === empresaSelecionadaId &&
        p.id !== id
      );
      
      if (existente) {
        throw new Error('Já existe produto com este nome!');
      }
      
      const updated = await base44.entities.Produto.update(id, data);
      await base44.functions.invoke('syncEntityReferences', {
        event: { type: 'update', entity_name: 'Produto' },
        data: updated,
        old_data: oldData,
      });
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos', empresaSelecionadaId] });
      setShowForm(false);
      setEditingProduto(null);
      toast.success('Produto atualizado!');
    },
    onError: (error) => {
      toast.error(error.message || 'Erro.');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const produto = produtos.find((item) => item.id === id);

      const abrirBloqueio = (description) => {
        window.dispatchEvent(new CustomEvent('base44:delete-dialog', {
          detail: {
            title: 'Não é possível excluir',
            description,
          },
        }));
      };

      const todasMovimentacoes = await base44.entities.MovimentacaoEstoque.list();
      const movimentacoesRelacionadas = todasMovimentacoes.filter((m) => m.produto_id === id);
      if (movimentacoesRelacionadas.length > 0) {
        abrirBloqueio(`O produto ${produto?.nome_produto || ''} já possui ${movimentacoesRelacionadas.length} registro(s) lançados em movimentações de estoque e não pode ser excluído.`);
        throw new Error('DELETE_BLOCKED');
      }

      const todosCustos = await base44.entities.CustoSafra.list();
      const custosRelacionados = todosCustos.filter((c) => c.produto_id === id);
      if (custosRelacionados.length > 0) {
        abrirBloqueio(`O produto ${produto?.nome_produto || ''} já possui ${custosRelacionados.length} registro(s) lançados em custos de safra e não pode ser excluído.`);
        throw new Error('DELETE_BLOCKED');
      }

      return base44.entities.Produto.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos', empresaSelecionadaId] });
      toast.success('Produto excluído!');
    },
    onError: (error) => {
      if (error.message === 'DELETE_BLOCKED') return;
      toast.error(error.message || 'Erro.');
    }
  });

  const handleSubmit = async (data) => {
    try {
      // Adicionar empresa_id aos dados
      data.empresa_id = empresaSelecionadaId;
      
      if (!editingProduto) {
        const proximoNumero = await getNextSystemNumber();
        data.numero_produto = String(proximoNumero);
      }
      
      if (editingProduto) {
        await updateMutation.mutateAsync({ id: editingProduto.id, data, oldData: editingProduto });
      } else {
        await createMutation.mutateAsync(data);
      }
    } catch (error) {
      console.error('Erro:', error);
      toast.error(error.message || 'Erro ao salvar produto.');
    }
  };

  const handleEdit = (produto) => {
    setEditingProduto(produto);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    try {
      await deleteMutation.mutateAsync(id);
    } catch (error) {
      console.error('Erro:', error);
    }
  };

  const handlePrint = (produto) => {
    setFichaProduto(produto);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingProduto(null);
  };

  const handleExport = () => {
    const csvRows = [];
    const headers = ['Nome', 'Código', 'Cód Barras', 'Categoria', 'Descrição', 'Unidade', 'Custo', 'Venda', 'Estoque', 'Mínimo', 'Obs'];
    csvRows.push(headers.join(';'));

    produtos.forEach(p => {
      const row = [
        p.nome_produto,
        p.codigo_interno || '',
        p.codigo_barras || '',
        p.categoria || '',
        p.descricao || '',
        p.unidade_medida,
        p.preco_custo || 0,
        p.preco_venda || 0,
        p.estoque_atual || 0,
        p.estoque_minimo || 0,
        p.observacoes || ''
      ];
      csvRows.push(row.map(item => typeof item === 'string' && item.includes(';') ? `"${item}"` : item).join(';'));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob(['\ufeff' + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `produtos_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    toast.success('Exportado!');
  };

  const downloadErrosImportacao = () => {
    const csvRows = [];
    const headers = ['Linha', 'Erro', 'Nome', 'Código', 'Cód Barras', 'Categoria', 'Descrição', 'UN', 'Custo', 'Venda', 'Estoque', 'Mínimo', 'Obs'];
    csvRows.push(headers.join(';'));

    importErrors.forEach(erro => {
      const row = [
        erro.linha,
        erro.erro,
        ...erro.dados.split(';')
      ];
      csvRows.push(row.map(item => typeof item === 'string' && item.includes(';') ? `"${item}"` : item).join(';'));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob(['\ufeff' + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `erros_produtos_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    toast.success('Planilha de erros baixada!');
  };

  const executarImportacao = async (validRecords) => {
    setShowImportProgress(true);
    setImportProgress({ current: 0, total: validRecords.length, errors: 0 });

    let imported = 0;
    let actualErrors = 0;

    for (const record of validRecords) {
      try {
        await base44.entities.Produto.create(record);
        imported++;
        setImportProgress(prev => ({ ...prev, current: prev.current + 1 }));
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        actualErrors++;
        setImportProgress(prev => ({ ...prev, errors: prev.errors + 1 }));
      }
    }

    await queryClient.invalidateQueries({ queryKey: ['produtos', empresaSelecionadaId] });
    
    setImportProgress({ current: validRecords.length, total: validRecords.length, errors: actualErrors });

    setTimeout(() => {
      setShowImportProgress(false);
      toast.success(actualErrors > 0 ? `${imported} importados! ${actualErrors} erro(s).` : `${imported} importados!`);
    }, 1000);
  };

  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

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
          
          if (values.length < 1) {
            errors.push({
              linha: i + 1,
              erro: 'Colunas insuficientes',
              dados: lines[i]
            });
            continue;
          }

          try {
            const produto = {
              empresa_id: empresaSelecionadaId, // Add empresa_id here for import
              numero_produto: String(proximoNumero),
              nome_produto: values[0]?.trim()?.toUpperCase(),
              codigo_interno: values[1]?.trim()?.toUpperCase() || undefined,
              codigo_barras: values[2]?.trim() || undefined,
              categoria: values[3]?.trim()?.toUpperCase() || undefined,
              descricao: values[4]?.trim()?.toUpperCase() || undefined,
              unidade_medida: values[5]?.trim()?.toUpperCase() || 'UN',
              preco_custo: parseFloat(values[6]?.replace(',', '.')) || 0,
              preco_venda: parseFloat(values[7]?.replace(',', '.')) || 0,
              estoque_atual: parseFloat(values[8]?.replace(',', '.')) || 0,
              estoque_minimo: parseFloat(values[9]?.replace(',', '.')) || 0,
              observacoes: values[10]?.trim()?.toUpperCase() || undefined
            };

            if (!produto.nome_produto) {
              throw new Error("Nome obrigatório");
            }

            validRecords.push(produto);
            proximoNumero++;
          } catch (err) {
            errors.push({
              linha: i + 1,
              erro: err.message || 'Erro',
              dados: lines[i]
            });
          }
        }

        // Se houver erros, mostrar diálogo
        if (errors.length > 0) {
          setImportErrors(errors);
          setValidRecordsToImport(validRecords);
          setShowErrorDialog(true);
          return;
        }

        // Se não houver erros, importar diretamente
        if (validRecords.length === 0) {
          toast.error('Nenhum registro válido!');
          return;
        }

        await executarImportacao(validRecords);

      } catch (error) {
        console.error('Erro ao importar:', error);
        toast.error('Erro ao importar!');
      }
    };
    reader.readAsText(file, 'UTF-8');
    event.target.value = '';
  };

  const confirmarImportacaoComErros = async () => {
    setShowErrorDialog(false);
    await executarImportacao(validRecordsToImport);
  };

  const cancelarImportacao = () => {
    setShowErrorDialog(false);
    setImportErrors([]);
    setValidRecordsToImport([]);
    toast.info('Importação cancelada.');
  };

  const downloadTemplate = () => {
    const csvRows = [];
    const headers = ['Nome', 'Código', 'Cód Barras', 'Categoria', 'Descrição', 'UN', 'Custo', 'Venda', 'Estoque', 'Mínimo', 'Obs'];
    csvRows.push(headers.join(';'));
    
    const example = ['PRODUTO EXEMPLO', '001', '7891234567890', 'CATEGORIA', 'DESCRIÇÃO', 'UN', '10,50', '15,00', '100', '10', 'OBS'];
    csvRows.push(example.map(item => typeof item === 'string' && item.includes(';') ? `"${item}"` : item).join(';'));

    const csvString = csvRows.join('\n');
    const blob = new Blob(['\ufeff' + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'modelo_produtos.csv';
    link.click();
  };

  const formatarNumero = (numero) => {
    if (!numero && numero !== 0) return "0,00";
    return numero.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const progressPercentage = importProgress.total > 0 
    ? Math.round((importProgress.current / importProgress.total) * 100) 
    : 0;

  return (
    <div className="p-1 md:p-1 space-y-1">
      {!showForm && (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 bg-white rounded px-1 py-1 shadow-sm border-b border-[var(--mg-border)]">
          <div>
            <h1 className="font-bold text-[var(--mg-text-1)]">Produtos</h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => refetch()} className="h-7 text-xs">Atualizar</Button>
            <Button onClick={handleExport} variant="outline" size="sm" className="h-7 text-xs"><Download className="w-3.5 h-3.5" /> Exportar</Button>
            <Button onClick={downloadTemplate} variant="outline" size="sm" className="h-7 text-xs"><FileSpreadsheet className="w-3.5 h-3.5" /> Modelo</Button>
            <label>
              <Button variant="outline" size="sm" className="h-7 text-xs cursor-pointer" asChild><span><Upload className="w-3.5 h-3.5" /> Importar</span></Button>
              <input type="file" accept=".csv" onChange={handleImport} className="hidden" disabled={showImportProgress} />
            </label>
            <Button variant="outline" size="icon" onClick={() => setShowConfigColunas(true)} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-[var(--mg-border)] bg-white shadow-sm hover:bg-[var(--mg-gray-fill)] hover:text-[var(--mg-text-1)] h-7 w-7"><Settings className="w-4 h-4" /></Button>
            <Button onClick={() => { setEditingProduto(null); setShowForm(true); }} size="sm" className="bg-[var(--mg-accent)] text-white px-3 text-xs font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow h-7 hover:bg-[var(--mg-accent-dark)]">Adicionar</Button>
          </div>
        </div>
      )}

      {/* Formulário */}
      <AnimatePresence>
        {showForm && (
          <FormularioProduto
            onSubmit={handleSubmit}
            onCancel={() => { setShowForm(false); setEditingProduto(null); }}
            initialData={editingProduto}
            isEditing={!!editingProduto}
          />
        )}
      </AnimatePresence>

      {/* Tabela */}
      {!showForm && (
        <TabelaProdutos
          produtos={produtos}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onPrint={handlePrint}
          isLoading={isLoading}
          showConfigColunas={showConfigColunas}
          setShowConfigColunas={setShowConfigColunas}
        />
      )}

      {/* Modal de Ficha */}
      <FichaProduto
        produto={fichaProduto}
        open={!!fichaProduto}
        onClose={() => setFichaProduto(null)}
      />

      {/* Modal de Erros de Validação */}
      <Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-700">
              <AlertCircle className="w-6 h-6" />
              Erros Encontrados na Importação
            </DialogTitle>
            <DialogDescription>
              Foram encontrados {importErrors.length} erro(s) no arquivo. 
              {validRecordsToImport.length > 0 && ` ${validRecordsToImport.length} registro(s) estão válidos e podem ser importados.`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto border rounded-lg">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow>
                  <TableHead className="w-20">Linha</TableHead>
                  <TableHead>Erro</TableHead>
                  <TableHead>Dados</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importErrors.map((erro, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-bold text-orange-700">
                      {erro.linha}
                    </TableCell>
                    <TableCell className="text-red-600">
                      {erro.erro}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-600">
                      {erro.dados}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 pt-4 border-t">
            {validRecordsToImport.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  💡 <strong>{validRecordsToImport.length} registro(s) válido(s)</strong> podem ser importados mesmo com os erros acima.
                </p>
              </div>
            )}
            
            <div className="flex justify-between items-center gap-3">
              <Button 
                variant="outline"
                onClick={downloadErrosImportacao}
                className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50"
              >
                <Download className="w-4 h-4" />
                Baixar Planilha de Erros
              </Button>

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={cancelarImportacao}
                  className="gap-2"
                >
                  <X className="w-4 h-4" />
                  Cancelar e Corrigir
                </Button>
                
                {validRecordsToImport.length > 0 && (
                  <Button 
                    onClick={confirmarImportacaoComErros}
                    className="bg-orange-600 hover:bg-orange-700 gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Importar {validRecordsToImport.length} Válido(s)
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Progresso de Importação */}
      <Dialog open={showImportProgress} onOpenChange={setShowImportProgress}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-green-600" />
              Importando Produtos
            </DialogTitle>
            <DialogDescription>
              Aguarde enquanto importamos os registros...
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Progresso</span>
                <span className="font-semibold text-slate-900">
                  {importProgress.current} de {importProgress.total}
                </span>
              </div>
              <Progress value={progressPercentage} className="h-3" />
              <p className="text-center text-sm font-medium text-green-600">
                {progressPercentage}%
              </p>
            </div>
            
            {importProgress.errors > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-sm text-orange-800">
                  ⚠️ {importProgress.errors} registro(s) com erro
                </p>
              </div>
            )}
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-700">
                💡 Dica: Registros são importados individualmente para garantir numeração única
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}