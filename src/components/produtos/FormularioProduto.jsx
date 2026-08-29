import React, { useRef, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { sugerirPercentualPV } from "../suplementacao/suplementacaoRules";
import AutocompleteGenerico from "@/components/financeiro/AutocompleteGenerico";
import { formatarMoedaInput, parseMoedaInput } from "@/components/financeiro/moedaUtils";

const INPUT_CLS = "h-7 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent";
const SELECT_CLS = "h-7 text-xs border-0 shadow-none focus:ring-0 bg-transparent";
const AC_INPUT_CLS = "border-0 shadow-none focus-visible:ring-0 bg-transparent h-7";

const FL = ({ label, required, error, children }) => (
  <div>
    <label className="text-[12px] text-[var(--mg-text-2)] pl-1 leading-none">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    <div className={`rounded-md border ${error ? 'border-red-500 bg-red-50' : 'border-[var(--mg-border)]'} focus-within:border-[var(--mg-accent)] transition-colors`}>
      {children}
    </div>
  </div>
);

const parseNumero = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  return parseMoedaInput(val);
};

export default function FormularioProduto({ onSubmit, onCancel, initialData, isEditing }) {
  const empresaId = localStorage.getItem('empresa_selecionada_id');

  const [formData, setFormData] = useState(() => {
    const defaults = {
      nome_produto: "", tipo_uso: "", codigo_interno: "", codigo_barras: "",
      categoria: "", marca: "", descricao: "", unidade_medida: "",
      preco_custo: "", preco_venda: "", estoque_minimo: "",
      local_estoque: "", tipo_consumo: "",
      percentual_consumo_pv: "", consumo_minimo_pv: "", consumo_maximo_pv: "",
      unidade_principal_estoque: "KG", peso_por_saco_kg: "",
      observacoes: "", ativo: true,
    };
    if (initialData) return { ...defaults, ...initialData, ativo: initialData.ativo !== false };
    return defaults;
  });

  const [invalidFields, setInvalidFields] = useState([]);
  const nomeProdutoRef = useRef(null);
  const codigoInternoRef = useRef(null);
  const pesoSacoRef = useRef(null);

  const { data: unidades = [] } = useQuery({
    queryKey: ['unidades'],
    queryFn: () => base44.entities.UnidadeMedida.list(),
    initialData: [],
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias'],
    queryFn: () => base44.entities.Categoria.list(),
    initialData: [],
  });

  const { data: locais = [] } = useQuery({
    queryKey: ['locais'],
    queryFn: () => base44.entities.LocalEstoque.list(),
    initialData: [],
  });

  const { data: marcas = [] } = useQuery({
    queryKey: ['marcas_form', empresaId],
    queryFn: async () => {
      const all = await base44.entities.Marca.list();
      return all.filter(m => m.empresa_id === empresaId && m.ativo !== false);
    },
    enabled: !!empresaId,
    initialData: [],
  });

  // Categorias com hierarquia: mostra apenas subcategorias (que têm pai), exibindo "PAI > FILHO"
  const categoriasItems = useMemo(() => {
    const ativas = categorias.filter(c => c.ativo !== false);
    // Categorias raiz (sem pai) - NÃO permitem lançamento
    // Subcategorias (com pai) - permitem lançamento, exibidas como "Grupo > Subcategoria"
    const items = [];
    ativas.forEach(cat => {
      if (cat.categoria_pai_id) {
        const pai = ativas.find(p => p.id === cat.categoria_pai_id);
        items.push({
          id: cat.nome,
          nome: pai ? `${pai.nome} > ${cat.nome}` : cat.nome,
          nome_busca: `${pai?.nome || ''} ${cat.nome}`,
        });
      } else {
        // Verificar se tem filhos - se não tem, permite como item avulso
        const temFilhos = ativas.some(c => c.categoria_pai_id === cat.id);
        if (!temFilhos) {
          items.push({ id: cat.nome, nome: cat.nome, nome_busca: cat.nome });
        }
      }
    });
    return items;
  }, [categorias]);

  const unidadesItems = useMemo(() => {
    return unidades.filter(u => u.ativo !== false).map(u => ({ id: u.sigla, nome: `${u.sigla} - ${u.descricao}`, sigla: u.sigla, descricao: u.descricao }));
  }, [unidades]);

  const locaisItems = useMemo(() => {
    return locais.filter(l => l.ativo !== false).map(l => ({ id: l.nome, nome: l.nome }));
  }, [locais]);

  const marcasItems = useMemo(() => {
    return marcas.map(m => ({ id: m.nome, nome: m.nome }));
  }, [marcas]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setInvalidFields(prev => prev.filter(f => f !== field));
  };

  // Valor monetário helpers
  const precoCustoNum = useMemo(() => parseNumero(formData.preco_custo), [formData.preco_custo]);
  const precoVendaNum = useMemo(() => parseNumero(formData.preco_venda), [formData.preco_venda]);
  const estoqueMinNum = useMemo(() => parseNumero(formData.estoque_minimo), [formData.estoque_minimo]);
  const percentualPVNum = useMemo(() => parseNumero(formData.percentual_consumo_pv), [formData.percentual_consumo_pv]);
  const consumoMinPVNum = useMemo(() => parseNumero(formData.consumo_minimo_pv), [formData.consumo_minimo_pv]);
  const consumoMaxPVNum = useMemo(() => parseNumero(formData.consumo_maximo_pv), [formData.consumo_maximo_pv]);
  const pesoSacoNum = useMemo(() => parseNumero(formData.peso_por_saco_kg), [formData.peso_por_saco_kg]);

  // Encontrar ID para autocomplete baseado no valor string
  const findItemId = (items, value) => {
    if (!value) return '';
    const item = items.find(i => i.id === value || i.nome === value);
    return item?.id || '';
  };

  const scrollToField = (element) => {
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => element.focus?.(), 250);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const missingFields = [];
    if (!formData.nome_produto?.trim()) missingFields.push('nome_produto');
    if (!formData.codigo_interno?.trim()) missingFields.push('codigo_interno');
    if (!formData.unidade_medida?.trim()) missingFields.push('unidade_medida');
    if (!formData.categoria?.trim()) missingFields.push('categoria');
    if (!formData.local_estoque?.trim()) missingFields.push('local_estoque');
    if (formData.unidade_principal_estoque === "SACO" && !pesoSacoNum) missingFields.push('peso_por_saco_kg');

    if (missingFields.length > 0) {
      setInvalidFields(missingFields);
      toast.error('Preencha os campos obrigatórios!');
      if (missingFields[0] === 'nome_produto') scrollToField(nomeProdutoRef.current);
      if (missingFields[0] === 'codigo_interno') scrollToField(codigoInternoRef.current);
      if (missingFields[0] === 'peso_por_saco_kg') scrollToField(pesoSacoRef.current);
      return;
    }

    const data = {
      nome_produto: formData.nome_produto?.toUpperCase(),
      tipo_uso: formData.tipo_uso || undefined,
      codigo_interno: formData.codigo_interno?.toUpperCase(),
      codigo_barras: formData.codigo_barras || undefined,
      categoria: formData.categoria?.toUpperCase() || undefined,
      marca: formData.marca?.toUpperCase() || undefined,
      descricao: formData.descricao?.toUpperCase() || undefined,
      unidade_medida: formData.unidade_medida?.toUpperCase(),
      preco_custo: precoCustoNum,
      preco_venda: precoVendaNum,
      estoque_minimo: estoqueMinNum,
      local_estoque: formData.local_estoque?.toUpperCase() || undefined,
      tipo_consumo: formData.tipo_consumo || undefined,
      percentual_consumo_pv: percentualPVNum || undefined,
      consumo_minimo_pv: consumoMinPVNum || undefined,
      consumo_maximo_pv: consumoMaxPVNum || undefined,
      unidade_principal_estoque: formData.unidade_principal_estoque || "KG",
      peso_por_saco_kg: formData.unidade_principal_estoque === "SACO" ? pesoSacoNum || undefined : undefined,
      observacoes: formData.observacoes?.toUpperCase() || undefined,
      ativo: formData.ativo,
    };
    if (!isEditing) data.estoque_atual = 0;
    onSubmit(data);
  };

  return (
    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
      <Card className="shadow-sm border-[var(--mg-border)]">
        <CardHeader className="flex flex-col space-y-1.5 p-6 bg-[var(--mg-gray-fill)] border-b py-1 px-1">
          <CardTitle className="text-sm font-semibold text-[var(--mg-text-1)]">
            {isEditing ? 'Editar Produto' : 'Novo Produto'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-1" style={{ maxHeight: 'calc(100vh - 150px)', overflowY: 'auto', scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}>
          <form onSubmit={handleSubmit} className="space-y-0.5">
            {/* LINHA 1: Nome | Tipo de Uso | Código | Cód Barras */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-1">
              <FL label="Nome do Produto" required error={invalidFields.includes('nome_produto')}>
                <Input ref={nomeProdutoRef} value={formData.nome_produto} onChange={(e) => handleChange('nome_produto', e.target.value)} placeholder="NOME DO PRODUTO" className={`${INPUT_CLS} uppercase`} style={{ textTransform: 'uppercase' }} />
              </FL>
              <FL label="Tipo de Uso">
                <Select value={formData.tipo_uso || ""} onValueChange={(value) => handleChange('tipo_uso', value)}>
                  <SelectTrigger className={SELECT_CLS}><SelectValue placeholder="SELECIONE" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Administrativo" className="text-xs">ADMINISTRATIVO</SelectItem>
                    <SelectItem value="Infraestrutura" className="text-xs">INFRAESTRUTURA</SelectItem>
                    <SelectItem value="Investimento" className="text-xs">INVESTIMENTO</SelectItem>
                    <SelectItem value="Lavoura" className="text-xs">LAVOURA</SelectItem>
                    <SelectItem value="Manutenção" className="text-xs">MANUTENÇÃO</SelectItem>
                    <SelectItem value="Máquinas" className="text-xs">MÁQUINAS</SelectItem>
                    <SelectItem value="Nutrição Animal" className="text-xs">NUTRIÇÃO ANIMAL</SelectItem>
                    <SelectItem value="Operacional" className="text-xs">OPERACIONAL</SelectItem>
                    <SelectItem value="Outros" className="text-xs">OUTROS</SelectItem>
                    <SelectItem value="Produção Animal" className="text-xs">PRODUÇÃO ANIMAL</SelectItem>
                  </SelectContent>
                </Select>
              </FL>
              <FL label="Código Interno" required error={invalidFields.includes('codigo_interno')}>
                <Input ref={codigoInternoRef} value={formData.codigo_interno} onChange={(e) => handleChange('codigo_interno', e.target.value)} placeholder="CÓDIGO INTERNO" className={`${INPUT_CLS} uppercase`} style={{ textTransform: 'uppercase' }} />
              </FL>
              <FL label="Código de Barras">
                <Input value={formData.codigo_barras} onChange={(e) => handleChange('codigo_barras', e.target.value)} placeholder="7891234567890" className={INPUT_CLS} />
              </FL>
            </div>

            {/* LINHA 2: Categoria | Unidade | Local | Marca */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-1">
              <FL label="Categoria" required error={invalidFields.includes('categoria')}>
                <AutocompleteGenerico
                  items={categoriasItems}
                  value={findItemId(categoriasItems, formData.categoria)}
                  onChange={(id) => handleChange('categoria', id || '')}
                  placeholder="BUSCAR CATEGORIA..."
                  displayField="nome"
                  searchFields={["nome", "nome_busca"]}
                  className="w-full"
                  inputClassName={AC_INPUT_CLS}
                />
              </FL>
              <FL label="Unidade de Medida" required error={invalidFields.includes('unidade_medida')}>
                <AutocompleteGenerico
                  items={unidadesItems}
                  value={findItemId(unidadesItems, formData.unidade_medida)}
                  onChange={(id) => handleChange('unidade_medida', id || '')}
                  placeholder="BUSCAR UNIDADE..."
                  displayField="nome"
                  searchFields={["sigla", "descricao", "nome"]}
                  renderItem={(u) => <div className="text-xs text-[var(--mg-text-1)]">{u.sigla} - {u.descricao}</div>}
                  className="w-full"
                  inputClassName={AC_INPUT_CLS}
                />
              </FL>
              <FL label="Local de Estoque" required error={invalidFields.includes('local_estoque')}>
                <AutocompleteGenerico
                  items={locaisItems}
                  value={findItemId(locaisItems, formData.local_estoque)}
                  onChange={(id) => handleChange('local_estoque', id || '')}
                  placeholder="BUSCAR LOCAL..."
                  displayField="nome"
                  searchFields={["nome"]}
                  className="w-full"
                  inputClassName={AC_INPUT_CLS}
                />
              </FL>
              <FL label="Marca">
                <AutocompleteGenerico
                  items={marcasItems}
                  value={findItemId(marcasItems, formData.marca)}
                  onChange={(id) => handleChange('marca', id || '')}
                  placeholder="BUSCAR MARCA..."
                  displayField="nome"
                  searchFields={["nome"]}
                  className="w-full"
                  inputClassName={AC_INPUT_CLS}
                />
              </FL>
            </div>

            {/* LINHA 3: Preço Custo | Preço Venda | Estoque Mínimo */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-1">
              <FL label="Preço de Custo">
                <Input value={formatarMoedaInput(precoCustoNum)} onChange={(e) => handleChange('preco_custo', e.target.value)} placeholder="0,00" className={`${INPUT_CLS} text-right font-mono`} />
              </FL>
              <FL label="Preço de Venda">
                <Input value={formatarMoedaInput(precoVendaNum)} onChange={(e) => handleChange('preco_venda', e.target.value)} placeholder="0,00" className={`${INPUT_CLS} text-right font-mono`} />
              </FL>
              <FL label="Estoque Mínimo">
                <Input value={formatarMoedaInput(estoqueMinNum)} onChange={(e) => handleChange('estoque_minimo', e.target.value)} placeholder="0,00" className={`${INPUT_CLS} text-right font-mono`} />
              </FL>
            </div>

            {/* Descrição */}
            <FL label="Descrição">
              <Textarea value={formData.descricao} onChange={(e) => handleChange('descricao', e.target.value)} placeholder="DESCRIÇÃO DETALHADA DO PRODUTO..." className="text-xs uppercase border-0 shadow-none focus-visible:ring-0 bg-transparent" style={{ textTransform: 'uppercase' }} rows={2} />
            </FL>

            {/* Seção de Suplementação - aparece quando tipo_uso = Nutrição Animal */}
            {formData.tipo_uso === "Nutrição Animal" && (
              <div className="border border-indigo-200 bg-indigo-50/50 rounded-lg p-1 space-y-0.5">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-1">
                  <span className="font-semibold text-xs text-[var(--mg-text-1)]">Configuração de Suplementação</span>
                  {!formData.percentual_consumo_pv && formData.nome_produto && (
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs border-indigo-300 text-indigo-700"
                      onClick={() => {
                        const sugestao = sugerirPercentualPV(formData.nome_produto);
                        if (sugestao) {
                          setFormData(prev => ({ ...prev, percentual_consumo_pv: sugestao.percentual_consumo_pv, consumo_minimo_pv: sugestao.consumo_minimo_pv, consumo_maximo_pv: sugestao.consumo_maximo_pv, tipo_consumo: sugestao.tipo_consumo }));
                          toast.success(`Valores sugeridos para "${sugestao.label}" aplicados.`);
                        } else { toast.info("Não há sugestão para este produto. Preencha manualmente."); }
                      }}>
                      Sugerir valores
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-1">
                  <FL label="Tipo de consumo">
                    <Select value={formData.tipo_consumo || ""} onValueChange={(value) => handleChange('tipo_consumo', value)}>
                      <SelectTrigger className={SELECT_CLS}><SelectValue placeholder="SELECIONE" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CONSUMO_DIARIO" className="text-xs">CONSUMO DIÁRIO</SelectItem>
                        <SelectItem value="CONSUMO_LIVRE" className="text-xs">CONSUMO LIVRE</SelectItem>
                      </SelectContent>
                    </Select>
                  </FL>
                  <FL label="%PV consumo padrão">
                    <Input value={formatarMoedaInput(percentualPVNum)} onChange={(e) => handleChange('percentual_consumo_pv', e.target.value)} placeholder="0,00" className={`${INPUT_CLS} text-right font-mono`} />
                  </FL>
                  <FL label="%PV mínimo">
                    <Input value={formatarMoedaInput(consumoMinPVNum)} onChange={(e) => handleChange('consumo_minimo_pv', e.target.value)} placeholder="0,00" className={`${INPUT_CLS} text-right font-mono`} />
                  </FL>
                  <FL label="%PV máximo">
                    <Input value={formatarMoedaInput(consumoMaxPVNum)} onChange={(e) => handleChange('consumo_maximo_pv', e.target.value)} placeholder="0,00" className={`${INPUT_CLS} text-right font-mono`} />
                  </FL>
                </div>
                <div className="text-[10px] text-indigo-700 bg-indigo-100 rounded px-2 py-1">
                  Fórmula: consumo esperado (kg/dia) = peso vivo médio × (%PV ÷ 100) × nº cabeças. Ex: 450kg × 0.3% = 1,35 kg/cab/dia
                </div>
              </div>
            )}

            {/* Seção de Unidade de Estoque */}
            <div className="border border-[var(--mg-border)] bg-[var(--mg-gray-fill)] rounded-lg p-1 space-y-0.5">
              <span className="font-semibold text-xs text-[var(--mg-text-1)]">Unidade de Estoque</span>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-1">
                <FL label="Unidade principal de estoque">
                  <Select value={formData.unidade_principal_estoque || "KG"} onValueChange={(value) => handleChange('unidade_principal_estoque', value)}>
                    <SelectTrigger className={SELECT_CLS}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KG" className="text-xs">QUILOGRAMAS (KG)</SelectItem>
                      <SelectItem value="SACO" className="text-xs">SACOS</SelectItem>
                    </SelectContent>
                  </Select>
                </FL>
                {formData.unidade_principal_estoque === "SACO" && (
                  <FL label="Peso por saco (kg)" required error={invalidFields.includes('peso_por_saco_kg')}>
                    <Input ref={pesoSacoRef} value={formatarMoedaInput(pesoSacoNum)} onChange={(e) => handleChange('peso_por_saco_kg', e.target.value)} placeholder="0,00" className={`${INPUT_CLS} text-right font-mono`} />
                  </FL>
                )}
              </div>
            </div>

            {/* Observações */}
            <FL label="Observações">
              <Textarea value={formData.observacoes} onChange={(e) => handleChange('observacoes', e.target.value)} placeholder="OBSERVAÇÕES GERAIS..." className="text-xs uppercase border-0 shadow-none focus-visible:ring-0 bg-transparent" style={{ textTransform: 'uppercase' }} rows={2} />
            </FL>

            {/* Ativo */}
            <div className="flex flex-wrap gap-6 py-1 px-1">
              <div className="flex items-center gap-2">
                <Checkbox id="prod_ativo" checked={formData.ativo} onCheckedChange={(v) => handleChange("ativo", v)} />
                <label htmlFor="prod_ativo" className="text-xs text-[var(--mg-text-1)] cursor-pointer">Ativo</label>
              </div>
            </div>

            {/* Botões */}
            <div className="flex flex-col-reverse lg:flex-row justify-end gap-1 pt-1 border-t">
              <Button type="button" variant="outline" onClick={onCancel} size="sm" className="h-7 text-xs px-3">Cancelar</Button>
              <Button type="submit" size="sm" className="h-7 text-xs px-3 bg-[var(--mg-accent)] hover:bg-[var(--mg-accent-dark)] text-white">
                {isEditing ? 'Atualizar' : 'Salvar'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}