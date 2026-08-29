import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import AutocompleteGenerico from "@/components/financeiro/AutocompleteGenerico";
import ToggleSwitch from "@/components/common/ToggleSwitch";

function DefaultControl({ field, value, onChange, readOnly }) {
  const inputClass = "h-[22px] text-xs border-0 rounded-none shadow-none focus-visible:ring-0 bg-transparent px-1";

  if (field.type === "textarea") {
    return <Textarea value={value || ""} onChange={(e) => onChange(field.name, e.target.value)} readOnly={readOnly || field.readOnly} placeholder={field.placeholder} className="text-xs uppercase bg-transparent px-1" rows={field.rows || 2} />;
  }

  if (["select", "autocomplete", "relation"].includes(field.type)) {
    return (
      <AutocompleteGenerico
        items={field.options || []}
        value={value || ""}
        onChange={(nextValue) => onChange(field.name, nextValue || "")}
        placeholder={field.placeholder || "BUSCAR..."}
        displayField={field.displayField || "nome"}
        searchFields={field.searchFields || [field.displayField || "nome"]}
        disabled={readOnly || field.readOnly}
        readOnly={readOnly || field.readOnly}
        className="w-full"
        inputClassName="border-0 shadow-none focus-visible:ring-0 bg-transparent h-[22px] text-xs px-1"
      />
    );
  }

  if (field.type === "checkbox") {
    return (
      <div className="h-[22px] flex items-center px-1">
        <ToggleSwitch checked={!!value} onChange={(checked) => onChange(field.name, checked)} disabled={readOnly || field.readOnly} />
      </div>
    );
  }

  return <Input type={field.type === "datetime" ? "datetime-local" : field.type || "text"} value={value || ""} onChange={(e) => onChange(field.name, e.target.value)} readOnly={readOnly || field.readOnly} placeholder={field.placeholder} className={`${inputClass} ${field.uppercase ? "uppercase" : ""}`} />;
}

const isCustomField = (field) => field?.origem === "customizado" || String(field?.id || "").startsWith("custom:");
const CustomMarker = () => <span className="pointer-events-none absolute bottom-0 right-0 z-10 w-0 h-0 border-l-[7px] border-l-transparent border-b-[7px] border-b-[var(--mg-accent)]" />;
const normalizeConditionText = (value) => String(value ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
const getOptionValue = (option) => String(option?.id ?? option?.value ?? option?.label ?? option?.nome ?? "");
const getOptionLabel = (option) => String(option?.nome ?? option?.label ?? option?.value ?? option?.id ?? "");
const conditionMatches = (current, expected, sourceField) => {
  const expectedText = normalizeConditionText(expected);
  const currentValues = new Set([normalizeConditionText(current)]);
  (sourceField?.options || []).forEach((option) => {
    const optionValue = getOptionValue(option);
    const optionLabel = getOptionLabel(option);
    if (normalizeConditionText(optionValue) === normalizeConditionText(current) || normalizeConditionText(optionLabel) === normalizeConditionText(current)) {
      currentValues.add(normalizeConditionText(optionValue));
      currentValues.add(normalizeConditionText(optionLabel));
    }
  });
  return currentValues.has(expectedText);
};

function FieldFrame({ field, error, children, className = "" }) {
  return (
    <div data-field={field.dataField || field.name} className={`grid grid-cols-[190px_minmax(0,1fr)] items-center gap-1 ${field.wide ? "md:col-span-2" : ""}`}>
      <label className="text-[12px] text-[var(--mg-text-2)] text-right leading-none">
        {field.label}:{field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className={`relative ${field.wide ? "min-h-6" : "h-6"} ${field.medium ? "w-64 max-w-full" : field.compact ? "w-44 max-w-full" : "w-full"} border ${error ? "border-red-500 bg-red-50" : "border-[var(--mg-border)] bg-white"} focus-within:border-[var(--mg-accent)] transition-colors overflow-hidden ${className} [&_input]:h-[22px] [&_input]:border-0 [&_input]:rounded-none [&_input]:shadow-none [&_input]:focus-visible:ring-0 [&_button]:h-[22px] [&_button]:border-0 [&_button]:rounded-none [&_button]:shadow-none [&_textarea]:min-h-[48px] [&_textarea]:rounded-none [&_textarea]:border-0 [&_textarea]:shadow-none [&_textarea]:focus-visible:ring-0`}>
        {isCustomField(field) && <CustomMarker />}
        {children}
      </div>
    </div>
  );
}

export default function DynamicFormRenderer({ panels = [], fields = [], layout = {}, hiddenFieldIds = [], lockedFieldIds = [], requiredFieldIds = [], visibilityRules = {}, activePanelId, values = {}, errors = {}, onChange, readOnly = false, context = {}, fieldClassName = "" }) {
  const activePanel = panels.find((panel) => panel.id === activePanelId) || panels[0];
  const activeFieldIds = layout?.[activePanel?.id] || [];

  const visibleFields = activeFieldIds
    .map((fieldId) => fields.find((field) => field.id === fieldId))
    .filter(Boolean)
    .filter((field) => field.visible !== false && !hiddenFieldIds.includes(field.id))
    .filter((field) => {
      const rule = visibilityRules[field.id] || field.defaultVisibilityRule;
      if (rule?.always) return true;
      if (rule?.sourceFieldName) {
        const sourceField = fields.find((item) => item.id === rule.sourceFieldId);
        if (sourceField?.type !== "select" || !["manual", "native"].includes(sourceField?.optionsMode)) return true;
        const current = values[rule.sourceFieldName] ?? values.campos_personalizados?.[rule.sourceFieldName];
        return conditionMatches(current, rule.value, sourceField);
      }
      return typeof field.showWhen === "function" ? field.showWhen(values, context) : true;
    });

  if (!activePanel) return null;

  return (
    <div className="space-y-1">
      {visibleFields.length === 0 ? (
        <div className="ml-[191px] text-xs text-[var(--mg-text-3)]">Nenhum campo configurado para este painel.</div>
      ) : visibleFields.map((field) => {
        const value = field.getValue ? field.getValue(values, context) : values[field.name];
        const error = errors[field.errorKey || field.name];
        const configuredField = { ...field, required: field.required || requiredFieldIds.includes(field.id) };
        const fieldReadOnly = readOnly || lockedFieldIds.includes(field.id);
        return (
          <FieldFrame key={field.id} field={configuredField} error={error} className={fieldClassName}>
            {field.render ? field.render({ field: configuredField, value, values, errors, onChange, readOnly: fieldReadOnly, context }) : <DefaultControl field={configuredField} value={value} onChange={onChange} readOnly={fieldReadOnly} />}
          </FieldFrame>
        );
      })}
    </div>
  );
}