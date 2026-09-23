import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, Loader2, CheckCircle, AlertCircle, Package, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { extrairDadosNFe } from "@/lib/xmlNFeParser";
import { processarUmaNFe } from "@/services/importacaoNFeMassaService";

const formatarMoeda = (v) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ImportacaoXMLMassa() {
  const queryClient = useQueryClient();
  const empresaSelecionadaId = localStorage.getItem("empresa_selecionada_id");
  const fileInputRef = useRef(null);

  const [arquivos, setArquivos] = useState([]); // { file, nome }
  const [notas, setNotas] = useState([]); // { dados, nomeArquivo, erro }
  const [processando, setProcessando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [progresso, setProgresso] = useState({ current: 0, total: 0 });
  const [resultados, setResultados] = useState([]);

  const { data: user } = useQuery({
    queryKey: ["auth-me"],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60 * 1000
  });

  const handleSelecionarArquivos = (e) => {
    const files = Array.from(e.target.files || []);
    const xmls = files.filter((f) => f.name.toLowerCase().endsWith(".xml"));
    if (xmls.length === 0) {
      toast.error("Selecione arquivos XML");
      return;
    }
    setArquivos((prev) => [...prev, ...xmls.map((f) => ({ file: f, nome: f.name }))]);
    setNotas([]);
    setResultados([]);
    e.target.value = "";
  };

  const handleRemoverArquivo = (idx) => {
    setArquivos((prev) => prev.filter((_, i) => i !== idx));
  };

  // Etapa 1: ler e parsear todos os XMLs (só extrai dados, não grava nada)
  const handleProcessarXMLs = async () => {
    if (arquivos.length === 0) {
      toast.error("Selecione ao menos um arquivo XML");
      return;
    }
    setProcessando(true);
    setNotas([]);
    const notasParseadas = [];

    for (const arq of arquivos) {
      try {
        const { file_url } = await base44.integrations.Core.UploadPublicFile({ file: arq.file });
        const response = await fetch(file_url);
        const xmlText = await response.text();
        const dados = extrairDadosNFe(xmlText);
        notasParseadas.push({ dados, nomeArquivo: arq.nome, erro: null });
      } catch (error) {
        notasParseadas.push({ dados: null, nomeArquivo: arq.nome, erro: error.message || "Erro ao processar XML" });
      }
    }

    setNotas(notasParseadas);
    setProcessando(false);
    const ok = notasParseadas.filter((n) => !n.erro).length;
    const erro = notasParseadas.length - ok;
    if (ok > 0) toast.success(`${ok} NF-e processada(s)`);
    if (erro > 0) toast.error(`${erro} arquivo(s) com erro`);
  };

  // Etapa 2: importar tudo — cadastra fornecedor, produtos, forma pgto, financeiro e estoque automaticamente
  const handleImportarTudo = async () => {
    const notasValidas = notas.filter((n) => !n.erro && n.dados);
    if (notasValidas.length === 0) {
      toast.error("Nenhuma NF-e válida para importar");
      return;
    }

    setImportando(true);
    setResultados([]);
    setProgresso({ current: 0, total: notasValidas.length });

    // Caches compartilhados entre todas as NF-e (evita recriar o mesmo fornecedor/produto)
    const caches = {
      fornecedores: [],
      formasPagamento: [],
      contasFinanceiras: [],
      locaisEstoque: [],
      produtos: []
    };

    const res = [];
    for (let i = 0; i < notasValidas.length; i++) {
      const { dados, nomeArquivo } = notasValidas[i];
      try {
        const summary = await processarUmaNFe(dados, {
          empresaId: empresaSelecionadaId,
          user,
          caches
        });
        res.push({ ...summary, nomeArquivo, status: "ok" });
      } catch (error) {
        console.error("Erro ao importar NF-e", nomeArquivo, error);
        res.push({
          numero: dados.numero,
          serie: dados.serie,
          fornecedor: dados.razao_social_emitente || "-",
          nomeArquivo,
          status: "erro",
          mensagem: error.message || "Erro ao importar"
        });
      }
      setProgresso({ current: i + 1, total: notasValidas.length });
    }

    setResultados(res);
    setImportando(false);

    queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
    queryClient.invalidateQueries({ queryKey: ["produtos"] });
    queryClient.invalidateQueries({ queryKey: ["estoque_lote_nota_movimentacao"] });
    queryClient.invalidateQueries({ queryKey: ["lancamentos_financeiros"] });
    queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
    queryClient.invalidateQueries({ queryKey: ["formas_pagamento"] });

    const okCount = res.filter((r) => r.status === "ok").length;
    if (okCount > 0) toast.success(`${okCount} NF-e importada(s) com sucesso!`);
    if (res.length - okCount > 0) toast.error(`${res.length - okCount} NF-e com erro`);
  };

  const progressPct = progresso.total > 0 ? Math.round((progresso.current / progresso.total) * 100) : 0;
  const notasValidas = notas.filter((n) => !n.erro && n.dados);
  const valorTotalNotas = notasValidas.reduce((s, n) => s + (n.dados.valor_total || 0), 0);

  return (
    <div className="p-3 md:p-4 space-y-3 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/MovimentacoesEstoque" className="md:hidden">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="font-bold text-slate-800 text-lg">Importação de NF-e em Massa</h1>
            <p className="text-xs text-slate-500">
              Puxa todos os dados da nota (fornecedor, produtos, forma de pagamento e parcelas) e cadastra automaticamente.
            </p>
          </div>
        </div>
      </div>

      <Card className="border-emerald-200 bg-emerald-50">
        <CardContent className="p-3 text-xs text-emerald-900 space-y-1">
          <div className="font-semibold flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" />
            Como funciona
          </div>
          <p>1. Selecione um ou mais arquivos XML de NF-e.</p>
          <p>2. O sistema lê cada nota e extrai fornecedor, produtos, forma de pagamento e parcelas.</p>
          <p>3. Ao importar, cadastra automaticamente o que não existir (fornecedor, produto, forma de pagamento) e lança no estoque + financeiro.</p>
        </CardContent>
      </Card>

      {/* Upload */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Upload className="w-4 h-4 text-emerald-600" />
            Arquivos XML
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:border-emerald-400 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml"
              multiple
              onChange={handleSelecionarArquivos}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={processando || importando}
              className="h-8 text-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              Selecionar arquivos XML
            </Button>
            <p className="text-[11px] text-slate-500 mt-2">Você pode selecionar vários arquivos de uma vez</p>
          </div>

          {arquivos.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">{arquivos.length} arquivo(s) selecionado(s)</span>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setArquivos([]); setNotas([]); setResultados([]); }}
                    disabled={processando || importando}
                    className="h-7 text-xs"
                  >
                    Limpar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleProcessarXMLs}
                    disabled={processando || importando}
                    className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                  >
                    {processando ? <><Loader2 className="w-3 h-3 animate-spin" /> Processando...</> : <><FileText className="w-3 h-3" /> Processar XMLs</>}
                  </Button>
                </div>
              </div>
              <div className="max-h-32 overflow-y-auto border rounded">
                {arquivos.map((arq, idx) => (
                  <div key={idx} className="flex items-center justify-between px-2 py-1 text-xs border-b last:border-0">
                    <span className="truncate flex items-center gap-1.5">
                      <FileText className="w-3 h-3 text-slate-400" />
                      {arq.nome}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRemoverArquivo(idx)}
                      disabled={processando || importando}
                      className="h-5 w-5 text-red-500"
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pré-visualização das notas parseadas */}
      {notas.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                Notas processadas ({notasValidas.length} válidas)
              </CardTitle>
              {notasValidas.length > 0 && (
                <Button
                  size="sm"
                  onClick={handleImportarTudo}
                  disabled={importando}
                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                >
                  {importando ? <><Loader2 className="w-3 h-3 animate-spin" /> Importando...</> : <><CheckCircle className="w-3 h-3" /> Importar Tudo</>}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {importando && (
              <div className="space-y-1">
                <Progress value={progressPct} className="h-2" />
                <p className="text-xs text-center text-slate-600">
                  Importando {progresso.current} de {progresso.total}...
                </p>
              </div>
            )}
            <div className="overflow-x-auto border rounded">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">NF-e</TableHead>
                    <TableHead className="text-xs">Fornecedor</TableHead>
                    <TableHead className="text-xs text-center">Itens</TableHead>
                    <TableHead className="text-xs">Forma Pgto</TableHead>
                    <TableHead className="text-xs text-center">Parc.</TableHead>
                    <TableHead className="text-xs text-right">Valor Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notas.map((n, idx) => (
                    <TableRow key={idx}>
                      {n.erro ? (
                        <>
                          <TableCell><AlertCircle className="w-3.5 h-3.5 text-red-500" /></TableCell>
                          <TableCell className="text-xs text-red-600" colSpan={6}>
                            {n.nomeArquivo}: {n.erro}
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell><CheckCircle className="w-3.5 h-3.5 text-emerald-600" /></TableCell>
                          <TableCell className="text-xs font-mono">{n.dados.numero}/{n.dados.serie}</TableCell>
                          <TableCell className="text-xs">{n.dados.razao_social_emitente || "-"}</TableCell>
                          <TableCell className="text-xs text-center">{n.dados.itens.length}</TableCell>
                          <TableCell className="text-xs">{n.dados.forma_pagamento_nome || "-"}</TableCell>
                          <TableCell className="text-xs text-center">{n.dados.parcelas.length || 1}</TableCell>
                          <TableCell className="text-xs text-right font-mono">{formatarMoeda(n.dados.valor_total)}</TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                  <TableRow className="bg-slate-100 font-semibold">
                    <TableCell colSpan={6} className="text-xs">TOTAL</TableCell>
                    <TableCell className="text-xs text-right font-mono">{formatarMoeda(valorTotalNotas)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resultados da importação */}
      {resultados.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-600" />
              Resultado da importação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto border rounded">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">NF-e</TableHead>
                    <TableHead className="text-xs">Fornecedor</TableHead>
                    <TableHead className="text-xs text-center">Itens</TableHead>
                    <TableHead className="text-xs">Forma Pgto</TableHead>
                    <TableHead className="text-xs text-center">Parc.</TableHead>
                    <TableHead className="text-xs text-right">Valor</TableHead>
                    <TableHead className="text-xs">Mensagem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultados.map((r, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        {r.status === "ok"
                          ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          : <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{r.numero}/{r.serie}</TableCell>
                      <TableCell className="text-xs">{r.fornecedor || "-"}</TableCell>
                      <TableCell className="text-xs text-center">{r.itens || "-"}</TableCell>
                      <TableCell className="text-xs">{r.forma_pagamento || "-"}</TableCell>
                      <TableCell className="text-xs text-center">{r.parcelas || "-"}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{r.valor_total != null ? formatarMoeda(r.valor_total) : "-"}</TableCell>
                      <TableCell className="text-xs">
                        {r.status === "ok"
                          ? <span className="text-emerald-700">Importada com sucesso</span>
                          : <span className="text-red-600">{r.mensagem}</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <Link to="/MovimentacoesEstoque">
                <Button variant="outline" size="sm" className="h-8 text-xs">Ver Movimentações</Button>
              </Link>
              <Link to="/LancamentoFinanceiro">
                <Button variant="outline" size="sm" className="h-8 text-xs">Ver Financeiro</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}