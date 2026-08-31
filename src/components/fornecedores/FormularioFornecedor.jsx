import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import AutocompleteGenerico from "../financeiro/AutocompleteGenerico.jsx";

const FL = ({ label, required, error, children, dataField }) => (
  <div data-field={dataField}>
    <label className="text-[12px] text-slate-500 pl-1 leading-none">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    <div className={`rounded-md border ${error ? 'border-red-500 bg-red-50' : 'border-slate-300'} focus-within:border-emerald-500 transition-colors`}>
      {children}
    </div>
  </div>
);

const validarCPF = (cpf) => {
  cpf = cpf.replace(/\D/g, '');
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpf.charAt(i)) * (10 - i);
  let resto = 11 - (soma % 11);
  let digito1 = resto > 9 ? 0 : resto;
  if (parseInt(cpf.charAt(9)) !== digito1) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf.charAt(i)) * (11 - i);
  resto = 11 - (soma % 11);
  let digito2 = resto > 9 ? 0 : resto;
  return parseInt(cpf.charAt(10)) === digito2;
};

const validarCNPJ = (cnpj) => {
  cnpj = cnpj.replace(/\D/g, '');
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  let tamanho = cnpj.length - 2;
  let numeros = cnpj.substring(0, tamanho);
  let digitos = cnpj.substring(tamanho);
  let soma = 0, pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) { soma += numeros.charAt(tamanho - i) * pos--; if (pos < 2) pos = 9; }
  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado != digitos.charAt(0)) return false;
  tamanho += 1;
  numeros = cnpj.substring(0, tamanho);
  soma = 0; pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) { soma += numeros.charAt(tamanho - i) * pos--; if (pos < 2) pos = 9; }
  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  return resultado == digitos.charAt(1);
};

const SELECT_EMPTY = "__VAZIO__";

export default function FormularioFornecedor({ onSubmit, onCancel, initialData = null, isEditing = false }) {
  const [tipoPessoa, setTipoPessoa] = useState(initialData?.tipo_pessoa || "Física");
  const [formData, setFormData] = useState({
    tipo_pessoa: initialData?.tipo_pessoa || "Física",
    nome: initialData?.nome || "",
    cpf: initialData?.cpf || "",
    rg: initialData?.rg || "",
    data_nascimento: initialData?.data_nascimento || "",
    cnpj: initialData?.cnpj || "",
    razao_social: initialData?.razao_social || "",
    inscricao_estadual: initialData?.inscricao_estadual || "",
    nome_responsavel: initialData?.nome_responsavel || "",
    telefone: initialData?.telefone || "",
    email: initialData?.email || "",
    endereco: initialData?.endereco || "",
    cidade: initialData?.cidade || "",
    codigo_ibge: initialData?.codigo_ibge || "",
    estado: initialData?.estado || "",
    cep: initialData?.cep || "",
    observacoes: initialData?.observacoes || "",
    tipos: initialData?.tipos || ["Fornecedor"],
    ativo: initialData?.ativo !== false
  });

  const { data: cidades = [] } = useQuery({
    queryKey: ['cidades'],
    queryFn: () => base44.entities.Cidade.list('nome'),
    initialData: [],
  });

  const cidadesFiltradas = cidades.filter(c => c.estado === formData.estado);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.nome || formData.nome.trim() === '') { toast.error('❌ O campo Nome é obrigatório!'); return; }
    if (tipoPessoa === "Física" && formData.cpf) {
      const cpfLimpo = formData.cpf.replace(/\D/g, '');
      if (cpfLimpo.length > 0) {
        if (cpfLimpo.length !== 11) { toast.error('❌ CPF deve ter 11 dígitos!'); return; }
        if (!validarCPF(cpfLimpo)) { toast.error('❌ CPF inválido!'); return; }
      }
    }
    if (tipoPessoa === "Jurídica" && formData.cnpj) {
      const cnpjLimpo = formData.cnpj.replace(/\D/g, '');
      if (cnpjLimpo.length > 0) {
        if (cnpjLimpo.length !== 14) { toast.error('❌ CNPJ deve ter 14 dígitos!'); return; }
        if (!validarCNPJ(cnpjLimpo)) { toast.error('❌ CNPJ inválido!'); return; }
      }
    }
    if (formData.email && formData.email.trim() !== '') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) { toast.error('❌ E-mail inválido!'); return; }
    }
    onSubmit(formData);
  };

  const handleChange = (field, value) => {
    if (field === 'tipo_pessoa') setTipoPessoa(value);
    if (field === 'estado') { setFormData(prev => ({ ...prev, estado: value, cidade: "", codigo_ibge: "" })); return; }
    if (typeof value === 'string' && !['email', 'cep', 'cpf', 'cnpj', 'rg', 'inscricao_estadual', 'data_nascimento', 'telefone', 'codigo_ibge'].includes(field)) {
      value = value.toUpperCase();
    }
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isPF = tipoPessoa === "Física";

  return (
    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
      <Card className="shadow-sm border-slate-300">
        <CardHeader className="flex flex-col space-y-1.5 p-6 bg-slate-50 border-b py-1 px-1">
          <CardTitle className="text-sm font-semibold text-slate-700">
            {isEditing ? 'Editar Fornecedor/Cliente' : 'Novo Fornecedor/Cliente'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-1" style={{ maxHeight: 'calc(100vh - 150px)', overflowY: 'auto', scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}>
          <form onSubmit={handleSubmit} className="space-y-0.5">

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-1">
              <FL label="Tipo de Pessoa" required dataField="tipo_pessoa">
                <Select value={tipoPessoa} onValueChange={(v) => handleChange('tipo_pessoa', v)}>
                  <SelectTrigger className="h-7 text-xs border-0 shadow-none focus:ring-0 bg-transparent"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Física" className="text-xs">PESSOA FÍSICA</SelectItem>
                    <SelectItem value="Jurídica" className="text-xs">PESSOA JURÍDICA</SelectItem>
                  </SelectContent>
                </Select>
              </FL>
              <div className="lg:col-span-2">
                <FL label={isPF ? "Nome Completo" : "Nome Fantasia"} required dataField="nome">
                  <Input value={formData.nome} onChange={(e) => handleChange('nome', e.target.value)} placeholder={isPF ? "NOME COMPLETO" : "NOME FANTASIA"} className="h-7 text-xs uppercase border-0 shadow-none focus-visible:ring-0 bg-transparent" style={{ textTransform: 'uppercase' }} />
                </FL>
              </div>
            </div>

            {isPF && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-1">
                <FL label="CPF" dataField="cpf">
                  <Input value={formData.cpf} onChange={(e) => handleChange('cpf', e.target.value)} placeholder="000.000.000-00" maxLength={14} className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent" />
                </FL>
                <FL label="RG" dataField="rg">
                  <Input value={formData.rg} onChange={(e) => handleChange('rg', e.target.value)} placeholder="00.000.000-0" className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent" />
                </FL>
                <FL label="Data de Nascimento" dataField="data_nascimento">
                  <Input type="date" value={formData.data_nascimento} onChange={(e) => handleChange('data_nascimento', e.target.value)} className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent" />
                </FL>
              </div>
            )}

            {!isPF && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-1">
                  <FL label="Razão Social" dataField="razao_social">
                    <Input value={formData.razao_social} onChange={(e) => handleChange('razao_social', e.target.value)} placeholder="RAZÃO SOCIAL" className="h-7 text-xs uppercase border-0 shadow-none focus-visible:ring-0 bg-transparent" style={{ textTransform: 'uppercase' }} />
                  </FL>
                  <FL label="CNPJ" dataField="cnpj">
                    <Input value={formData.cnpj} onChange={(e) => handleChange('cnpj', e.target.value)} placeholder="00.000.000/0000-00" maxLength={18} className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent" />
                  </FL>
                  <FL label="Inscrição Estadual" dataField="inscricao_estadual">
                    <Input value={formData.inscricao_estadual} onChange={(e) => handleChange('inscricao_estadual', e.target.value)} placeholder="000.000.000.000" className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent" />
                  </FL>
                </div>
                <FL label="Nome do Responsável" dataField="nome_responsavel">
                  <Input value={formData.nome_responsavel} onChange={(e) => handleChange('nome_responsavel', e.target.value)} placeholder="NOME DO RESPONSÁVEL" className="h-7 text-xs uppercase border-0 shadow-none focus-visible:ring-0 bg-transparent" style={{ textTransform: 'uppercase' }} />
                </FL>
              </>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-1">
              <FL label="Telefone" dataField="telefone">
                <Input value={formData.telefone} onChange={(e) => handleChange('telefone', e.target.value)} placeholder="(00) 00000-0000" className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent" />
              </FL>
              <div className="lg:col-span-2">
                <FL label="E-mail" dataField="email">
                  <Input type="email" value={formData.email} onChange={(e) => handleChange('email', e.target.value)} placeholder="email@exemplo.com" className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent" />
                </FL>
              </div>
            </div>

            <FL label="Endereço" dataField="endereco">
              <Input value={formData.endereco} onChange={(e) => handleChange('endereco', e.target.value)} placeholder="RUA, NÚMERO, BAIRRO" className="h-7 text-xs uppercase border-0 shadow-none focus-visible:ring-0 bg-transparent" style={{ textTransform: 'uppercase' }} />
            </FL>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-1">
              <FL label="Estado" dataField="estado">
                <Select value={formData.estado || SELECT_EMPTY} onValueChange={(v) => handleChange('estado', v === SELECT_EMPTY ? "" : v)}>
                  <SelectTrigger className="h-7 text-xs border-0 shadow-none focus:ring-0 bg-transparent"><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SELECT_EMPTY} className="text-xs">SELECIONE</SelectItem>
                    {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                      <SelectItem key={uf} value={uf} className="text-xs">{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FL>
              <FL label="Cidade" dataField="cidade">
                <AutocompleteGenerico
                  items={cidadesFiltradas}
                  value={cidadesFiltradas.find(c => c.nome === formData.cidade)?.id || ""}
                  onChange={(id) => {
                    const cidade = cidadesFiltradas.find(c => c.id === id);
                    if (cidade) setFormData(prev => ({ ...prev, cidade: cidade.nome, codigo_ibge: cidade.codigo_ibge }));
                  }}
                  placeholder={formData.estado ? "DIGITE..." : "ESCOLHA ESTADO"}
                  displayField="nome"
                  searchFields={["nome", "codigo_ibge"]}
                  disabled={!formData.estado}
                  emptyMessage="Nenhuma cidade"
                  className="h-7 text-xs"
                  inputClassName="h-7 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent"
                />
              </FL>
              <FL label="CEP" dataField="cep">
                <Input value={formData.cep} onChange={(e) => handleChange('cep', e.target.value)} placeholder="00000-000" className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent" />
              </FL>
            </div>

            <FL label="Observações" dataField="observacoes">
              <Textarea value={formData.observacoes} onChange={(e) => handleChange('observacoes', e.target.value)} placeholder="OBSERVAÇÕES GERAIS..." className="text-xs uppercase border-0 shadow-none focus-visible:ring-0 bg-transparent" style={{ textTransform: 'uppercase' }} rows={2} />
            </FL>

            <div className="flex flex-wrap gap-6 py-1 px-1 border-t pt-1">
              <span className="text-[12px] text-slate-500 w-full">Classificação</span>
              {["Fornecedor", "Cliente", "Funcionario"].map(tipo => (
                <div key={tipo} className="flex items-center gap-2">
                  <Checkbox
                    id={`tipo_${tipo}`}
                    checked={(formData.tipos || []).includes(tipo)}
                    onCheckedChange={(checked) => {
                      setFormData(prev => ({
                        ...prev,
                        tipos: checked ? [...(prev.tipos || []), tipo] : (prev.tipos || []).filter(t => t !== tipo)
                      }));
                    }}
                  />
                  <label htmlFor={`tipo_${tipo}`} className="text-xs text-slate-700 cursor-pointer">{tipo === 'Funcionario' ? 'Funcionário' : tipo}</label>
                </div>
              ))}
              <div className="flex items-center gap-2 ml-4 pl-4 border-l border-slate-300">
                <Checkbox id="forn_ativo" checked={formData.ativo} onCheckedChange={(v) => setFormData(prev => ({ ...prev, ativo: v }))} />
                <label htmlFor="forn_ativo" className="text-xs text-slate-700 cursor-pointer">Ativo</label>
              </div>
            </div>

            <div className="flex flex-col-reverse lg:flex-row justify-end gap-1 pt-1 border-t">
              <Button type="button" variant="outline" onClick={onCancel} size="sm" className="h-7 text-xs px-3">
                Cancelar
              </Button>
              <Button type="submit" size="sm" className="h-7 text-xs px-3 bg-emerald-600 hover:bg-emerald-700 text-white">
                {isEditing ? 'Atualizar' : 'Salvar'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}