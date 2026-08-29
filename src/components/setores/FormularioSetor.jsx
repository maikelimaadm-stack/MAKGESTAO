import React, { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const TIPOS_SETOR = ["Próprio", "Arrendado", "Parceria", "Terceiros"];
const ESTADOS_BR = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
const SELECT_EMPTY = "__VAZIO__";
const UPPERCASE_FIELDS = ["nome", "sigla", "responsavel", "endereco", "cidade", "observacoes"];
const REQUIRED_FIELDS = ["nome", "sigla", "endereco", "cidade", "estado"];

export default function FormularioSetor({ initialData, isEditing, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(initialData);
  const [invalidFields, setInvalidFields] = useState([]);

const FL = ({ label, required, error, children, dataField }) => (
  <div data-field={dataField}>
    <label className="text-[12px] text-[var(--mg-text-2)] pl-1 leading-none">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    <div className={`rounded-md border ${error ? 'border-red-500 bg-red-50' : 'border-[var(--mg-border)]'} focus-within:border-[var(--mg-accent)] transition-colors`}>
      {children}
    </div>
  </div>
);





  const handleChange = (field, value) => {
    const nextValue = UPPERCASE_FIELDS.includes(field) && typeof value === "string" ?
    value.toUpperCase() :
    value;
    setFormData((prev) => ({ ...prev, [field]: nextValue }));
    setInvalidFields((prev) => prev.filter((item) => item !== field));
  };

  const isEmptyValue = (value) => {
    if (typeof value === "string") return value.trim() === "";
    return value === undefined || value === null || value === "";
  };

  const getFieldClassName = (field, baseClass = "") => {
    return `${baseClass} ${invalidFields.includes(field) ? "border-red-500 bg-red-50 focus-visible:ring-red-500" : ""}`.trim();
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const missingFields = REQUIRED_FIELDS.filter((field) => isEmptyValue(formData?.[field]));

    if (missingFields.length > 0) {
      setInvalidFields(missingFields);
      toast.error("PREENCHA OS CAMPOS OBRIGATÓRIOS.");
      return;
    }

    onSubmit(formData);
  };

  return (
    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
    <Card className="shadow-sm border-[var(--mg-border)]">
      <CardHeader className="flex flex-col space-y-1.5 p-6 bg-[var(--mg-gray-fill)] border-b py-1 px-1">
        <CardTitle className="text-sm font-semibold text-[var(--mg-text-1)]">
          {isEditing ? "Editar Setor / Fazenda" : "Novo Setor / Fazenda"}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-1 pt-1">
<form onSubmit={handleSubmit} className="space-y-0.5">
  <div className="grid grid-cols-1 lg:grid-cols-4 gap-1">
    <FL label="Nome do Setor/Fazenda" required error={invalidFields.includes('nome')} dataField="nome">
      <Input value={formData.nome} onChange={(e) => handleChange("nome", e.target.value)} placeholder="NOME DO SETOR / FAZENDA" className="h-7 text-xs uppercase border-0 shadow-none focus-visible:ring-0 bg-transparent" style={{ textTransform: "uppercase" }} />
    </FL>
    <FL label="Sigla" required error={invalidFields.includes('sigla')} dataField="sigla">
      <Input value={formData.sigla} onChange={(e) => handleChange("sigla", e.target.value)} placeholder="SIGLA" className="h-7 text-xs uppercase border-0 shadow-none focus-visible:ring-0 bg-transparent" style={{ textTransform: "uppercase" }} maxLength={10} />
    </FL>
    <FL label="Tipo" required error={invalidFields.includes('tipo')} dataField="tipo">
      <Select value={formData.tipo} onValueChange={(value) => handleChange("tipo", value)}>
        <SelectTrigger className="h-7 text-xs border-0 shadow-none focus:ring-0 bg-transparent"><SelectValue placeholder="Selecione" /></SelectTrigger>
        <SelectContent>{TIPOS_SETOR.map((tipo) => <SelectItem key={tipo} value={tipo} className="text-xs">{tipo}</SelectItem>)}</SelectContent>
      </Select>
    </FL>
    <FL label="Responsável">
      <Input value={formData.responsavel} onChange={(e) => handleChange("responsavel", e.target.value)} placeholder="RESPONSÁVEL" className="h-7 text-xs uppercase border-0 shadow-none focus-visible:ring-0 bg-transparent" style={{ textTransform: "uppercase" }} />
    </FL>
    <FL label="Telefone">
      <Input value={formData.telefone} onChange={(e) => handleChange("telefone", e.target.value)} placeholder="(00) 00000-0000" className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent" />
    </FL>
    <FL label="Área Total (ha)">
      <Input type="number" step="0.01" value={formData.area_total} onChange={(e) => handleChange("area_total", e.target.value)} placeholder="0,00" className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent" />
    </FL>
    <FL label="Capacidade (animais)">
      <Input type="number" value={formData.capacidade_animais} onChange={(e) => handleChange("capacidade_animais", e.target.value)} placeholder="0" className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 bg-transparent" />
    </FL>
    <FL label="Endereço" required error={invalidFields.includes('endereco')} dataField="endereco">
      <Input value={formData.endereco} onChange={(e) => handleChange("endereco", e.target.value)} placeholder="ENDEREÇO COMPLETO" className="h-7 text-xs uppercase border-0 shadow-none focus-visible:ring-0 bg-transparent" style={{ textTransform: "uppercase" }} />
    </FL>
    <FL label="Cidade" required error={invalidFields.includes('cidade')} dataField="cidade">
      <Input value={formData.cidade} onChange={(e) => handleChange("cidade", e.target.value)} placeholder="CIDADE" className="h-7 text-xs uppercase border-0 shadow-none focus-visible:ring-0 bg-transparent" style={{ textTransform: "uppercase" }} />
    </FL>
    <FL label="Estado" required error={invalidFields.includes('estado')} dataField="estado">
      <Select value={formData.estado || SELECT_EMPTY} onValueChange={(value) => handleChange("estado", value === SELECT_EMPTY ? "" : value)}>
        <SelectTrigger className="h-7 text-xs border-0 shadow-none focus:ring-0 bg-transparent"><SelectValue placeholder="SELECIONE" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={SELECT_EMPTY} className="text-xs">SELECIONE</SelectItem>
          {ESTADOS_BR.map((uf) => <SelectItem key={uf} value={uf} className="text-xs">{uf}</SelectItem>)}
        </SelectContent>
      </Select>
    </FL>
    <div className="flex items-center gap-2 pt-4">
      <Switch checked={formData.ativo} onCheckedChange={(value) => handleChange("ativo", value)} />
      <label className="text-[12px] text-[var(--mg-text-2)]">Setor Ativo</label>
    </div>
  </div>

  <FL label="Observações">
    <Textarea value={formData.observacoes} onChange={(e) => handleChange("observacoes", e.target.value)} placeholder="OBSERVAÇÕES GERAIS..." className="text-xs uppercase border-0 shadow-none focus-visible:ring-0 bg-transparent" style={{ textTransform: "uppercase" }} rows={2} />
  </FL>

  <div className="flex flex-col-reverse lg:flex-row justify-end gap-1 pt-1 border-t">
    <Button type="button" variant="outline" onClick={onCancel} className="h-7 px-2 text-xs">Cancelar</Button>
    <Button type="submit" className="h-7 bg-[var(--mg-accent)] hover:bg-[var(--mg-accent-dark)] text-white px-3 text-xs">{ isEditing ? "Atualizar" : "Salvar"}</Button>
  </div>
</form>
      </CardContent>
    </Card>
    </motion.div>);

}