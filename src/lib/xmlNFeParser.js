// Parser nativo de XML de NF-e (modelo 55) usando DOMParser.
// Extrai todos os dados da nota: emitente (fornecedor), itens (produtos),
// valores totais, forma de pagamento e parcelas (duplicatas).
// Sem dependências externas.

export const MAPA_TPag_PARA_CATEGORIA = {
  '01': 'Dinheiro',
  '02': 'Cheque',
  '03': 'CartaoCredito',
  '04': 'CartaoDebito',
  '05': 'Outros',
  '10': 'Outros',
  '11': 'Outros',
  '12': 'Outros',
  '13': 'Outros',
  '15': 'Boleto',
  '16': 'Boleto',
  '17': 'PIX',
  '18': 'Transferencia',
  '19': 'Deposito',
  '90': 'Outros',
  '99': 'Outros'
};

export const MAPA_TPag_PARA_NOME = {
  '01': 'Dinheiro',
  '02': 'Cheque',
  '03': 'Cartão de Crédito',
  '04': 'Cartão de Débito',
  '05': 'Crédito Loja',
  '10': 'Vale Alimentação',
  '11': 'Vale Refeição',
  '12': 'Vale Presente',
  '13': 'Vale Combustível',
  '15': 'Boleto Bancário',
  '16': 'Boleto Bancário',
  '17': 'PIX',
  '18': 'Transferência Bancária',
  '19': 'Depósito Bancário',
  '90': 'Sem Pagamento',
  '99': 'Outros'
};

export function extrairDadosNFe(xmlText) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");

  const getValor = (tag) => {
    const element = xmlDoc.getElementsByTagName(tag)[0];
    return element ? element.textContent : null;
  };

  const modelo = getValor('mod');
  if (modelo !== '55') throw new Error('Não é NF-e modelo 55');

  const numero = getValor('nNF');
  const serie = getValor('serie');
  const chave = getValor('chNFe') || xmlDoc.getElementsByTagName('infNFe')[0]?.getAttribute('Id')?.replace('NFe', '');
  const dataEmissao = getValor('dhEmi')?.split('T')[0] || getValor('dEmi');
  const cfop = getValor('CFOP');
  const natOp = getValor('natOp');

  const vProd = parseFloat(getValor('vProd')) || 0;
  const vFrete = parseFloat(getValor('vFrete')) || 0;
  const vSeg = parseFloat(getValor('vSeg')) || 0;
  const vOutro = parseFloat(getValor('vOutro')) || 0;
  const vDesc = parseFloat(getValor('vDesc')) || 0;
  const vIPI = parseFloat(getValor('vIPI')) || 0;
  const vICMS = parseFloat(getValor('vICMS')) || 0;
  const vPIS = parseFloat(getValor('vPIS')) || 0;
  const vCOFINS = parseFloat(getValor('vCOFINS')) || 0;
  const vBC = parseFloat(getValor('vBC')) || 0;
  const valorTotal = parseFloat(getValor('vNF')) || 0;

  const cnpjEmit = getValor('CNPJ');
  const cpfEmit = getValor('CPF');
  const razaoSocial = getValor('xNome') || getValor('xFant');
  const inscEstadual = getValor('IE');
  const telefone = getValor('fone');
  const email = getValor('email');
  const logradouro = getValor('xLgr');
  const numero_end = getValor('nro');
  const bairro = getValor('xBairro');
  const cidade = getValor('xMun');
  const estado = getValor('UF');
  const cep = getValor('CEP');
  const cMun = getValor('cMun');

  const enderecoCompleto = numero_end ? `${logradouro}, ${numero_end}` : logradouro;

  const infAdic = xmlDoc.getElementsByTagName('infAdic')[0];
  let observacoes = '';
  if (infAdic) {
    const infCpl = infAdic.getElementsByTagName('infCpl')[0];
    if (infCpl) observacoes = infCpl.textContent || '';
  }

  // Forma de pagamento (tPag) - NF-e 4.00 usa <pag><detPag><tPag>
  let tPag = getValor('tPag');
  if (!tPag) {
    const pagElement = xmlDoc.getElementsByTagName('pag')[0];
    if (pagElement) {
      const detPagElement = pagElement.getElementsByTagName('detPag')[0];
      if (detPagElement) tPag = detPagElement.getElementsByTagName('tPag')[0]?.textContent;
    }
  }

  let formaPagamentoNome = null;
  let formaPagamentoCategoria = null;
  if (tPag) {
    formaPagamentoNome = MAPA_TPag_PARA_NOME[tPag] || 'Outros';
    formaPagamentoCategoria = MAPA_TPag_PARA_CATEGORIA[tPag] || 'Outros';
  }

  // Parcelas (duplicatas) - <cobr><dup><dVenc><vDup>
  const parcelas = [];
  const dups = xmlDoc.getElementsByTagName('dup');
  for (let i = 0; i < dups.length; i++) {
    const dup = dups[i];
    const dVenc = dup.getElementsByTagName('dVenc')[0]?.textContent;
    const vDup = parseFloat(dup.getElementsByTagName('vDup')[0]?.textContent || 0);
    const nDup = dup.getElementsByTagName('nDup')[0]?.textContent || `P${i + 1}`;
    if (dVenc && vDup > 0) parcelas.push({ numero: nDup, data: dVenc, valor: vDup });
  }
  parcelas.sort((a, b) => new Date(a.data) - new Date(b.data));

  // Se não há parcelas e a forma de pagamento é à vista (não boleto/sem pagamento), considera pago
  let contaPaga = false;
  if (parcelas.length === 0 && tPag && !['15', '16', '90', '99'].includes(tPag)) contaPaga = true;

  // Itens (produtos)
  const itensNFe = [];
  let somaProdutosItens = 0;
  let somaDescontoItens = 0;

  const dets = xmlDoc.getElementsByTagName('det');
  for (let i = 0; i < dets.length; i++) {
    const det = dets[i];
    const getTagDet = (tag) => {
      const el = det.getElementsByTagName(tag)[0];
      return el ? el.textContent : null;
    };

    const vDescItem = parseFloat(getTagDet('vDesc')) || 0;
    const vProdItem = parseFloat(getTagDet('vProd')) || 0;

    somaProdutosItens += vProdItem;
    somaDescontoItens += vDescItem;

    itensNFe.push({
      codigo: getTagDet('cProd') || '',
      descricao: getTagDet('xProd') || '',
      ncm: getTagDet('NCM') || '',
      cfop: getTagDet('CFOP') || cfop || '',
      unidade: getTagDet('uCom') || 'UN',
      quantidade: parseFloat(getTagDet('qCom')) || 0,
      valor_unitario: parseFloat(getTagDet('vUnCom')) || 0,
      valor_total: vProdItem,
      desconto_item: vDescItem
    });
  }

  if (itensNFe.length === 0) throw new Error('NF-e sem produtos');

  return {
    modelo, numero, serie, chave, data_emissao: dataEmissao,
    cnpj_emitente: cnpjEmit, cpf_emitente: cpfEmit, razao_social_emitente: razaoSocial,
    inscricao_estadual_emitente: inscEstadual, telefone_emitente: telefone, email_emitente: email,
    endereco_emitente: enderecoCompleto, bairro_emitente: bairro, cidade_emitente: cidade,
    estado_emitente: estado, cep_emitente: cep, codigo_ibge_emitente: cMun, cfop,
    natureza_operacao: natOp,
    valor_produtos: vProd,
    valor_frete: vFrete,
    valor_seguro: vSeg,
    valor_outras_despesas: vOutro,
    valor_desconto_total: vDesc,
    valor_ipi: vIPI,
    valor_icms: vICMS,
    valor_pis: vPIS,
    valor_cofins: vCOFINS,
    base_calculo_icms: vBC,
    valor_total: valorTotal,
    soma_produtos_itens: somaProdutosItens,
    soma_desconto_itens: somaDescontoItens,
    forma_pagamento_nome: formaPagamentoNome,
    forma_pagamento_categoria: formaPagamentoCategoria,
    tPag: tPag || null,
    observacoes_nfe: observacoes,
    parcelas,
    conta_paga: contaPaga,
    itens: itensNFe
  };
}