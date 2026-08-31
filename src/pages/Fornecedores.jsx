import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Users, Building2, UserCircle, Download, Upload, FileSpreadsheet, Loader2, AlertCircle, X, Settings } from "lucide-react";
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

import FormularioFornecedor from "../components/fornecedores/FormularioFornecedor";
import TabelaFornecedores from "../components/fornecedores/TabelaFornecedores";
import FichaFornecedor from "../components/fornecedores/FichaFornecedor";

// Função global para obter próximo número único do sistema
async function getNextSystemNumber() {
  try {
    const [pesagens, fornecedores, produtos] = await Promise.all([
      base44.entities.Pesagem.list(),
      base44.entities.Fornecedor.list(),
      base44.entities.Produto.list()
    ]);

    const numeros = [
      ...pesagens.map(p => parseInt(p.numero_registro, 10)).filter(n => !isNaN(n) && n > 0 && n < 1000000000),
      ...fornecedores.map(f => parseInt(f.numero_cadastro, 10)).filter(n => !isNaN(n) && n > 0 && n < 1000000000),
      ...produtos.map(p => parseInt(p.numero_produto, 10)).filter(n => !isNaN(n) && n > 0 && n < 1000000000)
    ];

    const positiveNumbers = numeros.filter(n => n > 0);
    const nextNumber = positiveNumbers.length > 0 ? Math.max(...positiveNumbers) + 1 : 1;
    
    console.log('📊 Próximo número gerado:', nextNumber, '(baseado em', positiveNumbers.length, 'registros)');
    return nextNumber;
  } catch (error) {
    console.error("Erro:", error); // Changed from original detailed message as per outline
    // Em caso de erro, retornar 1 ao invés de timestamp
    return 1;
  }
}

export default function Fornecedores() {
  const [showForm, setShowForm] = useState(false);
  const [editingFornecedor, setEditingFornecedor] = useState(null);
  const [fichaFornecedor, setFichaFornecedor] = useState(null);
  const [showImportProgress, setShowImportProgress] = useState(false);
  const [showConfigColunas, setShowConfigColunas] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, errors: 0 });

  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [importErrors, setImportErrors] = useState([]);
  const [validRecordsToImport, setValidRecordsToImport] = useState([]);

  const queryClient = useQueryClient();

  // Pegar empresa selecionada
  const empresaSelecionadaId = localStorage.getItem('empresa_selecionada_id');

  const { data: fornecedores, isLoading } = useQuery({
    queryKey: ['fornecedores', empresaSelecionadaId],
    queryFn: async () => {
      const allFornecedores = await base44.entities.Fornecedor.list('-created_date');
      // Filtrar apenas fornecedores da empresa selecionada
      return allFornecedores.filter(f => f.empresa_id === empresaSelecionadaId);
    },
    initialData: [],
    enabled: !!empresaSelecionadaId,
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Validar se já existe fornecedor com mesmo nome
      const existente = fornecedores.find(f => 
        f.nome.toUpperCase().trim() === data.nome.toUpperCase().trim() && 
        (!editingFornecedor || f.id !== editingFornecedor.id)
      );
      
      if (existente) {
        throw new Error('Já existe um fornecedor/cliente cadastrado com este nome.');
      }
      
      return base44.entities.Fornecedor.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
      setShowForm(false);
      setEditingFornecedor(null);
      toast.success('Fornecedor/Cliente cadastrado com sucesso!');
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao salvar. Tente novamente.');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      // Validar se já existe fornecedor com mesmo nome
      const existente = fornecedores.find(f => 
        f.nome.toUpperCase().trim() === data.nome.toUpperCase().trim() && 
        f.id !== id
      );
      
      if (existente) {
        throw new Error('Já existe um fornecedor/cliente cadastrado com este nome.');
      }
      
      return base44.entities.Fornecedor.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
      setShowForm(false);
      setEditingFornecedor(null);
      toast.success('Fornecedor/Cliente atualizado com sucesso!');
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao atualizar. Tente novamente.');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      // Verificar se existem custos de safra relacionados
      const todosCustos = await base44.entities.CustoSafra.list();
      const custosRelacionados = todosCustos.filter(c => c.fornecedor_id === id);
      
      if (custosRelacionados.length > 0) {
        throw new Error(`❌ EXCLUSÃO BLOQUEADA! Este fornecedor possui ${custosRelacionados.length} custo(s) de safra vinculado(s). Não é possível excluir.`);
      }

      // Verificar se existem movimentações relacionadas
      const todasMovimentacoes = await base44.entities.MovimentacaoEstoque.list();
      const movimentacoesRelacionadas = todasMovimentacoes.filter(m => m.fornecedor_id === id);
      
      if (movimentacoesRelacionadas.length > 0) {
        throw new Error(`❌ EXCLUSÃO BLOQUEADA! Este fornecedor possui ${movimentacoesRelacionadas.length} movimentação(ões) de estoque vinculada(s). Não é possível excluir.`);
      }

      // Verificar lançamentos financeiros
      const lancamentos = await base44.entities.LancamentoFinanceiro.list();
      const lancamentosRelacionados = lancamentos.filter(l => l.fornecedor_id === id);
      
      if (lancamentosRelacionados.length > 0) {
        throw new Error(`❌ EXCLUSÃO BLOQUEADA! Este fornecedor possui ${lancamentosRelacionados.length} lançamento(s) financeiro(s) vinculado(s). Não é possível excluir.`);
      }
      
      return base44.entities.Fornecedor.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
      toast.success('Fornecedor/Cliente excluído com sucesso!');
    },
    onError: (error) => {
      console.error("Erro ao excluir fornecedor:", error);
      toast.error(error.message || 'Erro ao excluir fornecedor/cliente. Tente novamente.');
    }
  });

  // Numerar cadastros existentes automaticamente
  useEffect(() => {
    const numerarCadastrosExistentes = async () => {
      const cadastrosSemNumero = fornecedores.filter(f => !f.numero_cadastro);
      
      if (cadastrosSemNumero.length > 0) {
        console.log(`[Fornecedores] Numerando ${cadastrosSemNumero.length} cadastros sem número...`);
        
        // Iterate and update each record sequentially to ensure unique numbering for each
        for (const fornecedor of cadastrosSemNumero) {
          try {
            const proximoNumero = await getNextSystemNumber();
            await base44.entities.Fornecedor.update(fornecedor.id, {
              ...fornecedor, // Spread existing data to ensure full object update
              numero_cadastro: String(proximoNumero)
            });
          } catch (error) {
            console.error(`Erro ao numerar cadastro ${fornecedor.id}:`, error);
          }
        }
        
        queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
        toast.success(`Fornecedores sem número cadastral foram numerados automaticamente.`);
      }
    };

    // Trigger numbering only if `fornecedores` array is loaded and not empty
    if (fornecedores && fornecedores.length > 0) {
      numerarCadastrosExistentes();
    }
  }, [fornecedores, queryClient]); // Dependencies: re-run if fornecedores data changes or queryClient instance changes

  const handleSubmit = async (data) => {
    // Adicionar empresa_id aos dados
    data.empresa_id = empresaSelecionadaId;
    
    // Gerar número único se for novo cadastro
    if (!editingFornecedor) {
      const proximoNumero = await getNextSystemNumber();
      data.numero_cadastro = String(proximoNumero);
    }
    
    if (editingFornecedor) {
      updateMutation.mutate({ id: editingFornecedor.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (fornecedor) => {
    setEditingFornecedor(fornecedor);
    setShowForm(true);
  };

  const handleDelete = async (id, skipConfirm = false) => {
    if (skipConfirm) {
      return deleteMutation.mutateAsync(id);
    }
    // Confirmação via dialog agora é feita no TabelaFornecedores
    return deleteMutation.mutateAsync(id);
  };

  const handlePrint = (fornecedor) => {
    setFichaFornecedor(fornecedor);
  };

  const handleNew = () => { // This function is no longer directly called from JSX in the new structure, but kept for completeness if other parts use it.
    setEditingFornecedor(null);
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingFornecedor(null);
  };

  const handleExport = () => {
    const csvRows = [];
    const headers = ['Tipo', 'Nome', 'CPF', 'RG', 'Data Nascimento', 'CNPJ', 'Razão Social', 'Inscrição Estadual', 'Responsável', 'Telefone', 'Email', 'Endereço', 'Cidade', 'Estado', 'CEP', 'Observações'];
    csvRows.push(headers.join(';'));

    fornecedores.forEach(f => {
      const row = [
        f.tipo_pessoa,
        f.nome,
        f.cpf || '',
        f.rg || '',
        f.data_nascimento || '',
        f.cnpj || '',
        f.razao_social || '',
        f.inscricao_estadual || '',
        f.nome_responsavel || '',
        f.telefone || '',
        f.email || '',
        f.endereco || '',
        f.cidade || '',
        f.estado || '',
        f.cep || '',
        f.observacoes || ''
      ];
      csvRows.push(row.join(';'));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob(['\ufeff' + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `fornecedores_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
    link.click();
    toast.success('Dados exportados com sucesso!');
  };

  const downloadErrosImportacao = () => {
    const csvRows = [];
    const headers = ['Linha', 'Erro', 'Tipo', 'Nome', 'CPF', 'RG', 'Data Nascimento', 'CNPJ', 'Razão Social', 'Inscrição Estadual', 'Responsável', 'Telefone', 'Email', 'Endereço', 'Cidade', 'Estado', 'CEP', 'Observações'];
    csvRows.push(headers.join(';'));

    importErrors.forEach(erro => {
      // Reconstitui a linha original dos dados para o CSV de erros
      const originalValues = erro.dados; // erro.dados já é a string 'valor1;valor2;...'
      const row = [
        erro.linha,
        erro.erro,
        ...originalValues.split(';') // Espalha os valores da linha original
      ];
      csvRows.push(row.join(';'));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob(['\ufeff' + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `erros_importacao_fornecedores_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
    link.click();
    toast.success('Planilha de erros baixada com sucesso!');
  };

  const executarImportacao = async (validRecords) => {
    setShowImportProgress(true);
    setImportProgress({ current: 0, total: validRecords.length, errors: 0 });

    let imported = 0;
    let actualErrors = 0;

    for (const record of validRecords) {
      try {
        await base44.entities.Fornecedor.create(record);
        imported++;
        setImportProgress(prev => ({ ...prev, current: prev.current + 1 }));
        await new Promise(resolve => setTimeout(resolve, 50)); // Small delay for UI update
      } catch (error) {
        console.error(`Erro ao criar registro:`, error);
        actualErrors++;
        setImportProgress(prev => ({ ...prev, errors: prev.errors + 1 }));
      }
    }

    await queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
    
    // Final update to ensure total and errors are reflected accurately after loop
    setImportProgress({ current: validRecords.length, total: validRecords.length, errors: actualErrors });

    setTimeout(() => {
      setShowImportProgress(false);
      if (actualErrors > 0) {
        toast.warning(`${imported} registros importados! ${actualErrors} com erro.`);
      } else {
        toast.success(`${imported} registros importados com sucesso!`);
      }
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
        
        if (lines.length <= 1) { // includes header line
          toast.error('O arquivo está vazio!');
          return;
        }

        // Buscar o maior número UMA VEZ antes do loop de parsing
        let proximoNumero = await getNextSystemNumber();

        const headers = lines[0].split(';');
        const headerMap = {
          'Tipo': 'tipo_pessoa',
          'Nome': 'nome',
          'CPF': 'cpf',
          'RG': 'rg',
          'Data Nascimento': 'data_nascimento',
          'CNPJ': 'cnpj',
          'Razão Social': 'razao_social',
          'Inscrição Estadual': 'inscricao_estadual',
          'Responsável': 'nome_responsavel',
          'Telefone': 'telefone',
          'Email': 'email',
          'Endereço': 'endereco',
          'Cidade': 'cidade',
          'Estado': 'estado',
          'CEP': 'cep',
          'Observações': 'observacoes',
        };

        const validRecords = [];
        const errors = [];

        for (let i = 1; i < lines.length; i++) { // Start from second line (data)
          const values = lines[i].split(';');
          
          let fornecedor = {};
          let hasErrorInRow = false;
          for (let j = 0; j < headers.length; j++) {
            const propName = headerMap[headers[j]?.trim()];
            if (propName && values[j]) {
              fornecedor[propName] = values[j]?.trim();
            }
          }

          try {
            if (!fornecedor.nome || !fornecedor.tipo_pessoa) {
              throw new Error("Nome e Tipo de Pessoa são obrigatórios");
            }
            
            fornecedor.numero_cadastro = String(proximoNumero);
            proximoNumero++; // Incrementar localmente para garantir unicidade sequencial
            fornecedor.empresa_id = empresaSelecionadaId; // Assign current company ID
            
            validRecords.push(fornecedor);
          } catch (err) {
            errors.push({
              linha: i + 1,
              erro: err.message || 'Erro desconhecido',
              dados: lines[i].trim() // Store the original line for error report
            });
            hasErrorInRow = true;
          }
        }

        // Se houver erros, mostrar diálogo de erros
        if (errors.length > 0) {
          setImportErrors(errors);
          setValidRecordsToImport(validRecords); // Still allow importing valid ones
          setShowErrorDialog(true);
          return; // Stop here, user decides next action
        }

        // Se não houver erros e existirem registros válidos, importar diretamente
        if (validRecords.length === 0) {
          toast.error('Nenhum registro válido encontrado no arquivo para importação.');
          return;
        }

        await executarImportacao(validRecords);

      } catch (error) {
        console.error('Erro geral ao importar:', error);
        toast.error('Erro ao importar. Verifique o arquivo.');
      }
    };
    reader.readAsText(file, 'UTF-8'); // Specify UTF-8 encoding
    event.target.value = ''; // Clear file input
  };

  const confirmarImportacaoComErros = async () => {
    setShowErrorDialog(false);
    if (validRecordsToImport.length > 0) {
      await executarImportacao(validRecordsToImport);
    } else {
      toast.info('Nenhum registro válido para importar.');
    }
  };

  const cancelarImportacao = () => {
    setShowErrorDialog(false);
    setImportErrors([]);
    setValidRecordsToImport([]);
    toast.info('Importação cancelada. Corrija os erros e tente novamente.');
  };

  const downloadTemplate = () => {
    const csvRows = [];
    const headers = ['Tipo', 'Nome', 'CPF', 'RG', 'Data Nascimento', 'CNPJ', 'Razão Social', 'Inscrição Estadual', 'Responsável', 'Telefone', 'Email', 'Endereço', 'Cidade', 'Estado', 'CEP', 'Observações'];
    csvRows.push(headers.join(';'));
    
    const example = ['Física', 'EXEMPLO FORNECEDOR', '000.000.000-00', '00.000.000-0', '01/01/1990', '', '', '', '', '(00) 00000-0000', 'exemplo@email.com', 'RUA EXEMPLO, 123', 'VILA BELA', 'MT', '00000-000', 'EXEMPLO DE FORNECEDOR'];
    csvRows.push(example.join(';'));

    const csvString = csvRows.join('\n');
    const blob = new Blob(['\ufeff' + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'modelo_fornecedores.csv';
    link.click();
  };

  const progressPercentage = importProgress.total > 0 
    ? Math.round((importProgress.current / importProgress.total) * 100) 
    : 0;

  return (
    <div className="p-1 md:p-1 space-y-1">
      {!showForm && <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 bg-white rounded px-1 py-1 shadow-sm border-b border-slate-200">
        <div>
          <h1 className="font-bold text-slate-800">Fornecedores/Clientes</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="icon" onClick={() => setShowConfigColunas(true)} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-7 w-7">
            <Settings className="w-4 h-4" />
          </Button>
          <Button onClick={handleExport} variant="outline" size="sm" className="h-7 text-xs px-3">
            Exportar
          </Button>
          <div>
            <input type="file" accept=".csv" onChange={handleImport} className="hidden" id="import-fornecedores" />
            <Button onClick={() => document.getElementById('import-fornecedores').click()} variant="outline" size="sm" className="h-7 text-xs px-3" disabled={showImportProgress || showErrorDialog}>
              Importar
            </Button>
          </div>
          <Button onClick={downloadTemplate} variant="outline" size="sm" className="h-7 text-xs px-3">
            Modelo
          </Button>
          <Button onClick={() => { setEditingFornecedor(null); setShowForm(true); }} size="sm" className="bg-lime-900 text-primary-foreground px-3 text-xs font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow h-7 hover:bg-emerald-600">
            Adicionar
          </Button>
        </div>
      </div>}

      <AnimatePresence mode="wait">
        {showForm ?
        <FormularioFornecedor
          key="form"
          onSubmit={handleSubmit}
          onCancel={() => { setShowForm(false); setEditingFornecedor(null); }}
          initialData={editingFornecedor}
          isEditing={!!editingFornecedor}
        /> :
        !showForm &&
        <TabelaFornecedores
          key="table"
          fornecedores={fornecedores}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onPrint={handlePrint}
          isLoading={isLoading}
          showConfigColunas={showConfigColunas}
          setShowConfigColunas={setShowConfigColunas}
        />
        }
      </AnimatePresence>



      <FichaFornecedor
        fornecedor={fichaFornecedor}
        open={!!fichaFornecedor}
        onClose={() => setFichaFornecedor(null)}
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
              Importando Fornecedores
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
                  ⚠️ {importProgress.errors} registro(s) com erro ao salvar.
                </p>
              </div>
            )}
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-700">
                💡 Dica: Registros são importados um a one para garantir numeração única.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}