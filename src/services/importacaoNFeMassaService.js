// Serviço de importação automática de NF-e em massa.
// Puxa TODOS os dados da nota (fornecedor, produtos, forma de pagamento, parcelas)
// e cadastra automaticamente o que não existe — sem o usuário precisar preencher nada.
// Cria: Fornecedor, Produto, FormaPagamento, ContaFinanceira (quando faltam),
// LancamentoFinanceiro (Pagar com parcelas), MovimentacaoEstoque (Entrada) e EstoqueLoteNota.

import { base44 } from "@/api/base44Client";

const soDigitos = (v) => (v || '').replace(/\D/g, '');

const proximoNumero = (lista, campo) => {
  return String(lista.reduce((max, r) => Math.max(max, parseInt(r[campo], 10) || 0), 0) + 1);
};

// Resolve ou cria o fornecedor a partir dos dados do emitente da NF-e.
async function resolverOuCriarFornecedor(dadosNFe, empresaId, fornecedoresCache) {
  const docEmitente = soDigitos(dadosNFe.cnpj_emitente || dadosNFe.cpf_emitente);
  const existente = fornecedoresCache.find(
    (f) => soDigitos(f.cnpj) === docEmitente || soDigitos(f.cpf) === docEmitente
  );
  if (existente) return existente;

  const isJuridica = !!dadosNFe.cnpj_emitente;
  const enderecoCompleto = dadosNFe.bairro_emitente
    ? `${dadosNFe.endereco_emitente}, ${dadosNFe.bairro_emitente}`
    : dadosNFe.endereco_emitente;

  const all = await base44.entities.Fornecedor.list();
  const novo = await base44.entities.Fornecedor.create({
    empresa_id: empresaId,
    numero_cadastro: proximoNumero(all, 'numero_cadastro'),
    tipo_pessoa: isJuridica ? 'Jurídica' : 'Física',
    nome: (dadosNFe.razao_social_emitente || 'FORNECEDOR SEM NOME').toUpperCase(),
    cnpj: isJuridica ? soDigitos(dadosNFe.cnpj_emitente) : '',
    cpf: !isJuridica ? soDigitos(dadosNFe.cpf_emitente) : '',
    inscricao_estadual: (dadosNFe.inscricao_estadual_emitente || '').toUpperCase(),
    telefone: dadosNFe.telefone_emitente || '',
    email: (dadosNFe.email_emitente || '').toLowerCase(),
    endereco: (enderecoCompleto || '').toUpperCase(),
    estado: dadosNFe.estado_emitente || '',
    cidade: (dadosNFe.cidade_emitente || '').toUpperCase(),
    cep: soDigitos(dadosNFe.cep_emitente),
    codigo_ibge: dadosNFe.codigo_ibge_emitente || '',
    tipos: ['Fornecedor'],
    ativo: true
  });
  fornecedoresCache.push(novo);
  return novo;
}

// Resolve ou cria o produto a partir do item da NF-e (match por código/nome).
async function resolverOuCriarProduto(item, empresaId, produtosCache) {
  const codigoUpper = (item.codigo || '').toUpperCase();
  const descricaoLower = (item.descricao || '').toLowerCase();

  const existente = produtosCache.find(
    (p) =>
      (p.codigo_interno && p.codigo_interno.toUpperCase() === codigoUpper) ||
      (p.codigo_barras && p.codigo_barras === item.codigo) ||
      (p.nome_produto && p.nome_produto.toLowerCase() === descricaoLower)
  );
  if (existente) return existente;

  const all = await base44.entities.Produto.list();
  const novo = await base44.entities.Produto.create({
    empresa_id: empresaId,
    numero_produto: proximoNumero(all, 'numero_produto'),
    nome_produto: (item.descricao || 'PRODUTO SEM NOME').toUpperCase(),
    codigo_interno: codigoUpper,
    codigo_barras: '',
    ncm: item.ncm || '',
    unidade_medida: (item.unidade || 'UN').toUpperCase(),
    categoria: '',
    preco_custo: item.quantidade > 0 ? item.valor_total / item.quantidade : 0,
    estoque_atual: 0,
    ativo: true
  });
  produtosCache.push(novo);
  return novo;
}

// Resolve ou cria a forma de pagamento a partir do tPag da NF-e.
async function resolverOuCriarFormaPagamento(dadosNFe, empresaId, formasCache) {
  const nome = dadosNFe.forma_pagamento_nome || 'Outros';
  const categoria = dadosNFe.forma_pagamento_categoria || 'Outros';

  const existente = formasCache.find(
    (f) => f.empresa_id === empresaId && f.nome === nome
  );
  if (existente) return existente;

  const all = await base44.entities.FormaPagamento.list();
  const novo = await base44.entities.FormaPagamento.create({
    empresa_id: empresaId,
    numero_forma: proximoNumero(all, 'numero_forma'),
    nome,
    tipo: 'Saida',
    categoria,
    permite_parcelamento: (dadosNFe.parcelas || []).length > 1,
    ativo: true
  });
  formasCache.push(novo);
  return novo;
}

// Resolve ou cria uma conta financeira padrão (Caixa) para a empresa.
async function resolverOuCriarContaFinanceira(empresaId, contasCache) {
  const existente = contasCache.find((c) => c.empresa_id === empresaId && c.ativo !== false);
  if (existente) return existente;

  const all = await base44.entities.ContaFinanceira.list();
  const novo = await base44.entities.ContaFinanceira.create({
    empresa_id: empresaId,
    nome: 'Caixa Geral',
    tipo: 'Caixa',
    saldo_inicial: 0,
    saldo_atual: 0,
    ativo: true
  });
  contasCache.push(novo);
  return novo;
}

// Resolve ou cria um local de estoque padrão.
async function resolverOuCriarLocalEstoque(empresaId, locaisCache) {
  const existente = locaisCache[0];
  if (existente) return existente;

  const all = await base44.entities.LocalEstoque.list();
  const novo = await base44.entities.LocalEstoque.create({
    nome: 'GALPÃO PRINCIPAL',
    descricao: 'Local de estoque padrão criado pela importação de NF-e',
    ativo: true
  });
  locaisCache.push(novo);
  return novo;
}

const gerarGrupoIdMov = () => `MOV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const gerarGrupoIdFin = () => `GRP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function proximoNumeroLancamento(empresaId) {
  const all = await base44.entities.LancamentoFinanceiro.list();
  const filtered = all.filter((l) => l && l.empresa_id === empresaId);
  return String(filtered.reduce((max, l) => Math.max(max, parseInt(l.numero_lancamento, 10) || 0), 0) + 1);
}

// Cria as parcelas do lançamento financeiro (Pagar).
async function criarLancamentoFinanceiro(dadosNFe, fornecedor, formaPagamento, contaFinanceira, empresaId) {
  const parcelas = dadosNFe.parcelas && dadosNFe.parcelas.length > 0
    ? dadosNFe.parcelas
    : [{ data: dadosNFe.data_emissao, valor: dadosNFe.valor_total }];

  const totalParcelas = parcelas.length;
  const grupoId = totalParcelas > 1 ? gerarGrupoIdFin() : null;
  const valorTotalLancamento = parcelas.reduce((s, p) => s + (p.valor || 0), 0) || dadosNFe.valor_total;
  const numeroBase = parseInt(await proximoNumeroLancamento(empresaId), 10);
  const descricaoBase = `NF-e ${dadosNFe.numero}/${dadosNFe.serie} - ${fornecedor.nome}`;

  const payloads = parcelas.map((parcela, i) => ({
    empresa_id: empresaId,
    numero_lancamento: String(numeroBase + i),
    tipo: 'Pagar',
    descricao: totalParcelas > 1 ? `${descricaoBase} - PARCELA ${i + 1}/${totalParcelas}` : descricaoBase,
    status: dadosNFe.conta_paga ? 'Pago' : 'Aberto',
    valor_total: parcela.valor || dadosNFe.valor_total,
    valor_total_lancamento: valorTotalLancamento,
    valor_pago: dadosNFe.conta_paga ? (parcela.valor || dadosNFe.valor_total) : 0,
    data_emissao: dadosNFe.data_emissao,
    data_vencimento: parcela.data || dadosNFe.data_emissao,
    data_pagamento: dadosNFe.conta_paga ? dadosNFe.data_emissao : undefined,
    fornecedor_id: fornecedor.id,
    fornecedor_nome: fornecedor.nome,
    tipo_documento_nome: 'NF-e',
    numero_documento: dadosNFe.numero,
    conta_financeira_id: contaFinanceira.id,
    conta_financeira_nome: contaFinanceira.nome,
    forma_pagamento_id: formaPagamento.id,
    forma_pagamento_nome: formaPagamento.nome,
    parcelamento_grupo_id: grupoId,
    numero_parcela_seq: i + 1,
    total_parcelas_grupo: totalParcelas,
    is_registro_principal: i === 0,
    observacao: dadosNFe.observacoes_nfe || '',
    anexos_urls: []
  }));

  const criados = [];
  for (const p of payloads) {
    criados.push(await base44.entities.LancamentoFinanceiro.create(p));
  }
  return criados;
}

// Processa UMA NF-e: resolve/cria tudo e lança estoque + financeiro.
// Retorna um resumo do que foi feito.
export async function processarUmaNFe(dadosNFe, ctx) {
  const { empresaId, user, caches } = ctx;

  const fornecedor = await resolverOuCriarFornecedor(dadosNFe, empresaId, caches.fornecedores);
  const formaPagamento = await resolverOuCriarFormaPagamento(dadosNFe, empresaId, caches.formasPagamento);
  const contaFinanceira = await resolverOuCriarContaFinanceira(empresaId, caches.contasFinanceiras);
  const localEstoque = await resolverOuCriarLocalEstoque(empresaId, caches.locaisEstoque);

  // Financeiro (parcelas)
  const lancamentosFinanceiros = await criarLancamentoFinanceiro(
    dadosNFe, fornecedor, formaPagamento, contaFinanceira, empresaId
  );
  const lancamentoOrigemId = lancamentosFinanceiros[0]?.id;

  // Estoque: uma movimentação Entrada por item + lote de nota
  const grupoId = dadosNFe.itens.length > 1 ? gerarGrupoIdMov() : null;
  const todasMovsRecentes = await base44.entities.MovimentacaoEstoque.list('-created_date', 200);
  let seqNum = todasMovsRecentes.reduce((max, m) => {
    const n = parseInt(m.numero_movimentacao, 10);
    return !isNaN(n) && n > max ? n : max;
  }, 0);

  const itensResumo = [];
  for (let idx = 0; idx < dadosNFe.itens.length; idx++) {
    const item = dadosNFe.itens[idx];
    const produto = await resolverOuCriarProduto(item, empresaId, caches.produtos);

    const prodDbArr = await base44.entities.Produto.filter({ id: produto.id });
    const estoqueAntes = prodDbArr.length > 0 ? prodDbArr[0].estoque_atual || 0 : produto.estoque_atual || 0;
    const estoqueDepois = estoqueAntes + item.quantidade;

    seqNum++;
    const movimentacaoCriada = await base44.entities.MovimentacaoEstoque.create({
      empresa_id: empresaId,
      numero_movimentacao: String(seqNum),
      tipo_movimentacao: 'Entrada',
      tipo_detalhado: 'Compra',
      tipo_documento: 'NF-e',
      data_movimentacao: new Date().toISOString(),
      produto_id: produto.id,
      produto_nome: produto.nome_produto,
      produto_codigo: produto.codigo_interno || '',
      produto_categoria: produto.categoria || '',
      quantidade: item.quantidade,
      unidade_medida: item.unidade || produto.unidade_medida || 'UN',
      valor_unitario: item.valor_unitario,
      valor_total: item.valor_total,
      fornecedor_id: fornecedor.id,
      fornecedor_nome: fornecedor.nome,
      numero_documento: dadosNFe.numero,
      chave_documento: dadosNFe.chave,
      data_documento: dadosNFe.data_emissao,
      local_estoque_destino: localEstoque.nome,
      local_destino: localEstoque.nome,
      lancamento_origem_id: lancamentoOrigemId,
      saldo_antes: estoqueAntes,
      saldo_depois: estoqueDepois,
      motivo_movimentacao: `ENTRADA VIA NF-e ${dadosNFe.numero}`,
      observacoes: dadosNFe.observacoes_nfe || '',
      responsavel: user?.email || '',
      usuario_responsavel: user?.email || '',
      status: 'Ativa',
      origem_sistema: 'manual',
      movimentacao_grupo_id: grupoId,
      numero_movimentacao_seq: idx + 1,
      total_movimentacoes_grupo: dadosNFe.itens.length,
      is_registro_principal: idx === 0
    });

    await base44.entities.EstoqueLoteNota.create({
      empresa_id: empresaId,
      produto_id: produto.id,
      produto_nome: produto.nome_produto,
      local_estoque_id: localEstoque.id,
      local_estoque_nome: localEstoque.nome,
      numero_documento: dadosNFe.numero,
      data_documento: dadosNFe.data_emissao,
      fornecedor_id: fornecedor.id,
      fornecedor_nome: fornecedor.nome,
      custo_unitario: item.valor_unitario || 0,
      quantidade_entrada: item.quantidade,
      quantidade_disponivel: item.quantidade,
      movimentacao_entrada_id: movimentacaoCriada.id,
      status: 'Disponivel'
    });

    await base44.entities.Produto.update(produto.id, { estoque_atual: estoqueDepois });

    itensResumo.push({
      produto: produto.nome_produto,
      quantidade: item.quantidade,
      valor_total: item.valor_total,
      criado: !prodDbArr.length || !prodDbArr[0].nome_produto ? false : true
    });
  }

  return {
    numero: dadosNFe.numero,
    serie: dadosNFe.serie,
    fornecedor: fornecedor.nome,
    forma_pagamento: formaPagamento.nome,
    parcelas: (dadosNFe.parcelas || []).length || 1,
    valor_total: dadosNFe.valor_total,
    itens: itensResumo.length,
    lancamento_financeiro_id: lancamentoOrigemId
  };
}