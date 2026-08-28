import { base44 } from "@/api/base44Client";
import { ensureDeleteAllowed as ensureEntityDeleteAllowed } from "@/lib/entityDeleteGuards";

const ORIGENS_SISTEMA = [
  "MOVIMENTAÇÃO",
  "REVERSÃO MOVIMENTAÇÃO",
  "Nascimento",
  "Mudança de Categoria",
  "NASCIMENTO",
  "MUDANÇA DE CATEGORIA"
];

const NATIVE_SELECT_FIELDS = [
  {
    field_id: "lote_native_motivo_entrada",
    field_name: "motivo_entrada",
    label: "Motivo da Entrada",
    options: ["COMPRA", "AJUSTE", "INVENTÁRIO", "OUTROS"]
  }
];

const normalizeOption = (option) => String(option?.label || option?.value || option || "").trim().toUpperCase();
const buildProtectedOptions = (protectedOptions = [], options = []) => {
  const merged = [...protectedOptions, ...options.map(normalizeOption)].filter(Boolean);
  return [...new Set(merged)].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" })).map((item) => ({ value: item, label: item, protected: protectedOptions.includes(item) }));
};

const filterByEmpresa = (items, empresaId) => {
  if (!empresaId) return items;
  return items.filter((item) => item.empresa_id === empresaId);
};

const getNextNumeroLote = (lotes) => {
  const maxNum = lotes.reduce((max, lote) => Math.max(max, parseInt(lote.numero_lote) || 0), 0);
  return String(maxNum + 1);
};

export const loteRepository = {
  async list({ empresaId, incluirSistema = true } = {}) {
    const all = await base44.entities.Lote.list();
    return filterByEmpresa(all, empresaId).filter((lote) => incluirSistema || !ORIGENS_SISTEMA.includes(lote.origem));
  },

  async getById(id) {
    const all = await base44.entities.Lote.list();
    return all.find((lote) => lote.id === id) || null;
  },

  async create(data, { empresaId } = {}) {
    const allLotes = await base44.entities.Lote.list();
    return base44.entities.Lote.create({
      ...data,
      empresa_id: empresaId || data.empresa_id,
      numero_lote: data.numero_lote || getNextNumeroLote(allLotes),
      status: data.status || "Ativo",
      campos_personalizados: data.campos_personalizados || {}
    });
  },

  async update(id, data, { oldData } = {}) {
    const updated = await base44.entities.Lote.update(id, {
      ...data,
      campos_personalizados: data.campos_personalizados || {}
    });

    try {
      await base44.functions.invoke("syncEntityReferences", {
        event: { type: "update", entity_name: "Lote" },
        data: updated,
        old_data: oldData
      });
    } catch (syncError) {
      console.warn("syncEntityReferences indisponível, registro atualizado sem sincronização de referências:", syncError?.message || syncError);
    }

    return updated;
  },

  async delete(id) {
    return base44.entities.Lote.delete(id);
  },

  async ensureDeleteAllowed(id) {
    return ensureEntityDeleteAllowed(base44, "Lote", id);
  },

  async listAreasAtivas(empresaId) {
    const all = await base44.entities.AreaPastagem.list();
    return filterByEmpresa(all, empresaId).filter((area) => area.ativo !== false);
  },

  async listLotesComMovimentacoes(empresaId) {
    const [movsPecuaria, movsMapa] = await Promise.all([
      base44.entities.MovimentacaoPecuaria.list(),
      base44.entities.MovimentacaoMapa.list()
    ]);

    const idsPecuaria = filterByEmpresa(movsPecuaria, empresaId).filter((mov) => mov.lote_id).map((mov) => mov.lote_id);
    const idsMapa = filterByEmpresa(movsMapa, empresaId).filter((mov) => mov.lote_id).map((mov) => mov.lote_id);

    return [...new Set([...idsPecuaria, ...idsMapa])];
  },

  async listCategoriasManejo(empresaId) {
    const all = await base44.entities.CategoriaManejo.list();
    return filterByEmpresa(all, empresaId).filter((categoria) => categoria.ativo !== false);
  },

  async listFornecedores(empresaId) {
    const all = await base44.entities.Fornecedor.list();
    return filterByEmpresa(all, empresaId);
  },

  async listOptionsSources(sources = []) {
    const configs = sources.map((source) => typeof source === "string" ? { entity: source } : source).filter((source) => source?.entity);
    const unique = Array.from(new Map(configs.map((source) => [source.entity, source])).values());
    const entries = await Promise.all(unique.map(async (source) => {
      const entityApi = base44.entities[source.entity];
      if (!entityApi?.list) return [source.entity, []];
      const records = await entityApi.list();
      const labelField = source.labelField || "nome";
      const valueField = source.valueField || "id";
      return [source.entity, records.map((record) => ({
        ...record,
        value: record[valueField] ?? record.id,
        label: record[labelField] || record.nome || record.nome_produto || record.apelido || record.descricao || record.razao_social || record.full_name || record.email || record.id
      }))];
    }));
    return Object.fromEntries(entries);
  },

  async ensureLoteLayoutBase() {
    const layouts = await base44.entities.LayoutConfiguracao.list();
    let layout = layouts.find((item) => item.tela === "CadastroLotes" && item.ativo !== false);

    if (!layout) {
      layout = await base44.entities.LayoutConfiguracao.create({
        tela: "CadastroLotes",
        nome: "Cadastro de Lotes",
        descricao: "Layout configurável dos campos do cadastro de lotes",
        escopo: "sistema",
        versao_ativa: 1,
        ativo: true
      });
    }

    const secoes = await base44.entities.LayoutSecao.list();
    let secao = secoes.find((item) => item.layout_id === layout.id && item.section_id === "campos_personalizados");

    if (!secao) {
      secao = await base44.entities.LayoutSecao.create({
        layout_id: layout.id,
        section_id: "campos_personalizados",
        titulo: "Campos Personalizados",
        ordem: 99,
        ativo: true
      });
    }

    const camposLayout = await base44.entities.LayoutCampo.list();
    await Promise.all(NATIVE_SELECT_FIELDS.map(async (nativeField) => {
      const existing = camposLayout.find((campo) => campo.layout_id === layout.id && campo.field_name === nativeField.field_name);
      const payload = {
        layout_id: layout.id,
        section_id: secao.section_id,
        field_id: nativeField.field_id,
        entity_name: "Lote",
        field_name: nativeField.field_name,
        origem: "sistema",
        label: nativeField.label,
        tipo: "select",
        ativo: true,
        visivel_form: false,
        visivel_tabela: false,
        visivel_relatorio: false,
        options: buildProtectedOptions(nativeField.options, existing?.options || []),
        options_text: buildProtectedOptions(nativeField.options, existing?.options || []).map((option) => option.label).join("\n"),
        metadata: { ...(existing?.metadata || {}), native_select: true, protected_options: nativeField.options }
      };
      if (existing) await base44.entities.LayoutCampo.update(existing.id, payload);else await base44.entities.LayoutCampo.create(payload);
    }));

    return { layout, secao };
  },

  async listCamposPersonalizados() {
    const { layout } = await this.ensureLoteLayoutBase();
    const campos = await base44.entities.LayoutCampo.list();
    return campos
      .filter((campo) => campo.layout_id === layout.id && campo.entity_name === "Lote" && (campo.origem === "customizado" || campo.metadata?.native_select))
      .sort((a, b) => Number(!!b.metadata?.native_select) - Number(!!a.metadata?.native_select) || (a.ordem || 0) - (b.ordem || 0));
  },

  async createCampoPersonalizado(data) {
    const { layout, secao } = await this.ensureLoteLayoutBase();
    const campos = await this.listCamposPersonalizados();
    const fieldName = data.field_name;

    return base44.entities.LayoutCampo.create({
      layout_id: layout.id,
      section_id: secao.section_id,
      field_id: `lote_custom_${fieldName}`,
      entity_name: "Lote",
      field_name: fieldName,
      origem: "customizado",
      label: data.label,
      placeholder: data.placeholder || "",
      descricao: data.descricao || "",
      tipo: data.tipo,
      col_span: data.col_span || 6,
      ordem: campos.length + 1,
      obrigatorio: !!data.obrigatorio,
      read_only: data.tipo === "calculado",
      ativo: true,
      visivel_form: data.visivel_form !== false,
      visivel_tabela: data.visivel_tabela !== false,
      visivel_relatorio: data.visivel_relatorio !== false,
      ordenavel: data.ordenavel !== false,
      filtravel: data.filtravel !== false,
      alinhamento: data.alinhamento || "left",
      largura_coluna: data.largura_coluna || 160,
      ordem_tabela: data.ordem_tabela || campos.length + 1,
      agregacao: data.agregacao || data.agregacao_tipo || undefined,
      agregacao_tipo: data.agregacao_tipo || data.agregacao || undefined,
      agregacao_campo_base: "",
      options: data.options || [],
      options_source: data.options_source || data.options_source_entity || "",
      options_source_entity: data.options_source_entity || "",
      options_label_field: data.options_label_field || "nome",
      options_value_field: data.options_value_field || "id",
      relation_entity: data.relation_entity || "",
      relation_display_field: data.relation_display_field || "nome",
      regras: data.regras || {},
      formula: data.formula || "",
      calculation_builder: data.calculation_builder || { items: [] },
      usar_decimal: !!data.usar_decimal && !data.usar_mascara,
      decimal_places: data.decimal_places ?? 2,
      usar_mascara: !!data.usar_mascara && !data.usar_decimal,
      mascaras_text: data.mascaras_text || "",
      dependencias: data.dependencias || data.campos_dependentes || [],
      campos_dependentes: data.campos_dependentes || data.dependencias || []
    });
  },

  async updateCampoPersonalizado(id, data) {
    const campos = await base44.entities.LayoutCampo.list();
    const current = campos.find((campo) => campo.id === id);
    if (current?.metadata?.native_select) {
      const protectedOptions = current.metadata.protected_options || [];
      const options = buildProtectedOptions(protectedOptions, data.options || []);
      return base44.entities.LayoutCampo.update(id, {
        options,
        options_text: options.map((option) => option.label).join("\n"),
        metadata: current.metadata
      });
    }

    return base44.entities.LayoutCampo.update(id, {
      ...data,
      read_only: data.tipo === "calculado",
      agregacao_campo_base: "",
      filtravel: data.filtravel !== false,
      options_source: data.options_source || data.options_source_entity || "",
      agregacao: data.agregacao || data.agregacao_tipo || undefined,
      dependencias: data.dependencias || data.campos_dependentes || []
    });
  },

  async deleteCampoPersonalizado(campo) {
    if (campo?.metadata?.native_select) {
      throw new Error("Esta lista é nativa do sistema e não pode ser excluída.");
    }
    const fieldName = campo.field_name;
    const lotes = await base44.entities.Lote.list();
    const possuiDados = lotes.some((lote) => {
      const value = lote.campos_personalizados?.[fieldName];
      return value !== undefined && value !== null && String(value).trim() !== "";
    });
    if (possuiDados) {
      throw new Error("Este campo já possui dados em lotes cadastrados e não pode ser excluído com segurança.");
    }
    return base44.entities.LayoutCampo.delete(campo.id);
  }
};

export default loteRepository;