import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";

// Cores por tipo de cultura
export const CORES_TIPO_CULTURA = {
  'Pastagem': '#22c55e',
  'Agricultura': '#eab308',
  'Reserva': '#0ea5e9',
  'APP': '#06b6d4',
  'Infraestrutura': '#94a3b8'
};

// Cores por aproveitamento
export const CORES_APROVEITAMENTO = {
  'Alta': '#22c55e',
  'Média': '#f59e0b',
  'Baixa': '#ef4444'
};

// Cores por status de ocupação
export const CORES_OCUPACAO = {
  'Disponível': '#94a3b8',
  'Médio': '#f59e0b',
  'Alto': '#ef4444',
  'Sobrepastoreado': '#991b1b'
};

// Cores por faixa de UA/ha (baseado em dados Embrapa/Scot Consultoria)
export const CORES_UA_HA = {
  'Sem gado': '#d1d5db',
  'Sublotação (< 0,8 UA/ha)': '#86efac',
  'Moderada (0,8 - 1,2 UA/ha)': '#22c55e',
  'Ideal (1,2 - 1,8 UA/ha)': '#3b82f6',
  'Alta (1,8 - 2,4 UA/ha)': '#f59e0b',
  'Superlotação (> 2,4 UA/ha)': '#ef4444'
};

// Cores por situação do pasto (Ocupado vs Vazio)
export const CORES_SITUACAO_PASTO = {
  'Vazio - Sem histórico': '#d1d5db',
  'Vazio - Em descanso': '#86efac',
  'Ocupado - Normal': '#3b82f6',
  'Ocupado - Atenção (> 45d)': '#f59e0b',
  'Ocupado - Crítico (> 90d)': '#ef4444'
};

// Cores por categoria de gado
export const CORES_CATEGORIA_GADO = [
'#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#6366f1',
'#d946ef', '#0ea5e9', '#84cc16', '#f43f5e', '#a855f7'];


export const MODOS_COLORACAO = [
{ id: 'padrao', label: 'Padrão (cor da área)' },
{ id: 'tipo_cultura', label: 'Tipo de Cultura' },
{ id: 'aproveitamento', label: 'Aproveitamento' },
{ id: 'ocupacao', label: 'Ocupação' },
{ id: 'categoria_gado', label: 'Categoria de Manejo' },
{ id: 'tipo_pastagem', label: 'Tipo de Pastagem' },
{ id: 'ua_ha', label: 'UA por Hectare' },
{ id: 'situacao_pasto', label: 'Situação do Pasto' }];


export default function MapaFiltrosAvancados({
  // Visibilidade
  showAreas, setShowAreas,
  showPontos, setShowPontos,
  showLinhas, setShowLinhas,
  showLotes, setShowLotes,
  showTarefas, setShowTarefas,
  showCochos, setShowCochos,
  showDepositos, setShowDepositos,
  showAlertas, setShowAlertas,
  showUserLocation, setShowUserLocation,
  showNomesAreas, setShowNomesAreas,
  showHectaresAreas, setShowHectaresAreas,
  // Filtros de lotes
  filtroCategoria, setFiltroCategoria,
  filtroIdentificador, setFiltroIdentificador,
  filtroStatus, setFiltroStatus,
  filtroSistema, setFiltroSistema,
  filtroAlertaTipo, setFiltroAlertaTipo,
  filtroPesoMin, setFiltroPesoMin,
  filtroPesoMax, setFiltroPesoMax,
  // Filtros de área
  filtroSetor, setFiltroSetor,
  filtroTipoCultura, setFiltroTipoCultura,
  filtroTipoPastagem, setFiltroTipoPastagem,
  // Coloração
  modoColoracao, setModoColoracao,
  // Dados para opções
  categorias = [],
  identificadores = [],
  tiposPastagem = [],
  setores = [],
  sistemasProdutivos = [],
  permissions = null
}) {

  // Definição das camadas disponíveis com base nas permissões e estados
  const availableLayers = [
  permissions?.visualizar_areas !== false && { label: 'Mapa de Áreas', checked: showAreas, onChange: () => setShowAreas((v) => !v) },
  permissions?.visualizar_nomes_areas !== false && permissions?.visualizar_areas !== false && { label: 'Detalhes Áreas', checked: showNomesAreas, onChange: () => setShowNomesAreas((v) => !v) },
  permissions?.visualizar_areas !== false && { label: 'Hectares', checked: showHectaresAreas, onChange: () => setShowHectaresAreas((v) => !v) },
  permissions?.visualizar_pontos_referencia !== false && { label: 'Pontos Referência', checked: showPontos, onChange: () => setShowPontos((v) => !v) },
  permissions?.visualizar_tarefas !== false && { label: 'Tarefas', checked: showTarefas, onChange: () => setShowTarefas((v) => !v) },
  permissions?.visualizar_lotes !== false && { label: 'Lotes', checked: showLotes, onChange: () => setShowLotes((v) => !v) },
  permissions?.visualizar_linhas !== false && { label: 'Linhas (cercas, rios)', checked: showLinhas, onChange: () => setShowLinhas((v) => !v) },
  permissions?.visualizar_cochos_suplementacao !== false && { label: 'Cochos', checked: showCochos, onChange: () => setShowCochos((v) => !v) },
  permissions?.visualizar_cochos_suplementacao !== false && { label: 'Depósitos', checked: showDepositos, onChange: () => setShowDepositos((v) => !v) },
  permissions?.visualizar_alertas !== false && { label: 'Alertas', checked: showAlertas, onChange: () => setShowAlertas((v) => !v) },
  permissions?.visualizar_localizacao !== false && { label: 'Localização', checked: showUserLocation, onChange: () => setShowUserLocation((v) => !v) }].
  filter(Boolean);

  return (
    <div className="rounded space-y-1">
      {/* ─── Camadas Visíveis ─── */}
      {availableLayers.length > 0 &&
      <>
          <div className="space-y-0 px-1">
            <div className="space-y-0 px-1">
              <span className="text-xs font-bold text-slate-800 uppercase">Camadas</span>
            </div>
            <div className="space-y-0">
              {availableLayers.map((item) =>
            <label key={item.label} className="flex items-center justify-between cursor-pointer hover:bg-slate-50 px-2 py-1.5 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="bg-green-600 text-zinc-50 rounded-full w-2.5 h-2.5" />
                    <span className="text-xs font-medium text-slate-700">{item.label}</span>
                  </div>
                  <Switch checked={item.checked} onCheckedChange={item.onChange} className="scale-75" />
                </label>
            )}
            </div>
          </div>
          <Separator />
        </>
      }

      {/* ─── Modo de Coloração das Áreas ─── */}
      {permissions?.visualizar_areas !== false &&
      <div>
          <div className="mb-3">
            <span className="text-xs font-bold text-slate-800 uppercase">DEMARCAR ÁREAS POR</span>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {MODOS_COLORACAO.map((modo) => {
            const ativo = modoColoracao === modo.id;
            return (
              <Button
                key={modo.id}
                variant={ativo ? 'default' : 'outline'}
                size="sm"
                onClick={() => setModoColoracao(modo.id)}
                className={`h-8 text-[10px] justify-start ${ativo ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}>
                
                  <span className="truncate">{modo.label}</span>
                </Button>);

          })}
          </div>

          {/* Legenda do modo ativo */}
          {modoColoracao !== 'padrao' &&
        <div className="mt-3 bg-slate-50 rounded-lg p-2.5 space-y-1">
              <div className="text-[10px] font-bold text-slate-600 uppercase mb-1">Legenda</div>
              {modoColoracao === 'tipo_cultura' && Object.entries(CORES_TIPO_CULTURA).map(([k, c]) => <LegendaItem key={k} cor={c} label={k} />)}
              {modoColoracao === 'aproveitamento' && Object.entries(CORES_APROVEITAMENTO).map(([k, c]) => <LegendaItem key={k} cor={c} label={k} />)}
              {modoColoracao === 'ocupacao' && Object.entries(CORES_OCUPACAO).map(([k, c]) => <LegendaItem key={k} cor={c} label={k} />)}
              {modoColoracao === 'categoria_gado' && <div className="text-[10px] text-slate-500">Cada categoria de manejo terá uma cor distinta</div>}
              {modoColoracao === 'tipo_pastagem' && <div className="text-[10px] text-slate-500">Cada tipo de pastagem terá uma cor distinta</div>}
              {modoColoracao === 'ua_ha' &&
          <>
                  {Object.entries(CORES_UA_HA).map(([k, c]) => <LegendaItem key={k} cor={c} label={k} />)}
                  <div className="text-[9px] text-slate-500 mt-1 italic">* Usa área efetiva (pastejada). 1 UA = 450 kg PV</div>
                </>
          }
              {modoColoracao === 'situacao_pasto' && Object.entries(CORES_SITUACAO_PASTO).map(([k, c]) => <LegendaItem key={k} cor={c} label={k} />)}
            </div>
        }
        </div>
      }

      {permissions?.visualizar_areas !== false && <Separator />}

      {/* ─── Filtros de Áreas ─── */}
      {permissions?.visualizar_areas !== false &&
      <div>
          <div className="space-y-0 px-1">
            <span className="text-xs font-bold text-slate-800 uppercase">Filtros de Áreas</span>
          </div>
          <div className="space-y-0 px-1">
            <div>
              <Label className="text-[10px] text-slate-600">Setor</Label>
              <Select value={filtroSetor} onValueChange={setFiltroSetor}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos" className="text-xs">Todos</SelectItem>
                  {setores.map((setor) => <SelectItem key={setor.id} value={setor.id} className="text-xs">{setor.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] text-slate-600">Tipo de Cultura</Label>
              <Select value={filtroTipoCultura} onValueChange={setFiltroTipoCultura}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas" className="text-xs">Todas</SelectItem>
                  <SelectItem value="Pastagem" className="text-xs">Pastagem</SelectItem>
                  <SelectItem value="Agricultura" className="text-xs">Agricultura</SelectItem>
                  <SelectItem value="Reserva" className="text-xs">Reserva</SelectItem>
                  <SelectItem value="APP" className="text-xs">APP</SelectItem>
                  <SelectItem value="Infraestrutura" className="text-xs">Infraestrutura</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] text-slate-600">Tipo de Pastagem</Label>
              <Select value={filtroTipoPastagem} onValueChange={setFiltroTipoPastagem}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas" className="text-xs">Todas</SelectItem>
                  {tiposPastagem.map((tp) => <SelectItem key={tp} value={tp} className="text-xs">{tp}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      }

      {permissions?.visualizar_lotes !== false && <Separator />}

      {/* ─── Filtros de Lotes ─── */}
      {permissions?.visualizar_lotes !== false &&
      <div>
          <div className="space-y-0 px-1">
            <span className="text-xs font-bold text-slate-800 uppercase">Filtros de Categorias de Manejo</span>
          </div>
          <div className="space-y-0 px-1">
            <div>
              <Label className="text-[10px] text-slate-600">Categoria</Label>
              <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas" className="text-xs">Todas</SelectItem>
                  {categorias.map((cat) => <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] text-slate-600">Sistema Produtivo</Label>
              <Select value={filtroSistema} onValueChange={setFiltroSistema}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos" className="text-xs">Todos</SelectItem>
                  {sistemasProdutivos.map((sp) => <SelectItem key={sp} value={sp} className="text-xs">{sp}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] text-slate-600">Identificador</Label>
              <Select value={filtroIdentificador} onValueChange={setFiltroIdentificador}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos" className="text-xs">Todos</SelectItem>
                  {identificadores.map((identificador) => <SelectItem key={identificador} value={identificador} className="text-xs">{identificador}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-0 px-1">
              <Label className="text-[10px] text-slate-600">Alertas</Label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos" className="text-xs">Todos</SelectItem>
                  <SelectItem value="com_alerta" className="text-xs">Com Alerta</SelectItem>
                  <SelectItem value="sem_alerta" className="text-xs">Sem Alerta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] text-slate-600">Tipo de Alerta</Label>
              <Select value={filtroAlertaTipo} onValueChange={setFiltroAlertaTipo}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos" className="text-xs">Todos</SelectItem>
                  <SelectItem value="suplementacao_pendente" className="text-xs">Suplementação</SelectItem>
                  <SelectItem value="cocho_sem_produto" className="text-xs">Cocho sem produto</SelectItem>
                  <SelectItem value="deposito_estoque_minimo" className="text-xs">Estoque mínimo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] text-slate-600">Peso Mínimo (kg)</Label>
              <Input
              type="number"
              placeholder="Ex: 200"
              className="h-8 text-xs"
              value={filtroPesoMin || ''}
              onChange={(e) => setFiltroPesoMin(e.target.value ? Number(e.target.value) : null)} />
            
            </div>
            <div>
              <Label className="text-[10px] text-slate-600">Peso Máximo (kg)</Label>
              <Input
              type="number"
              placeholder="Ex: 500"
              className="h-8 text-xs"
              value={filtroPesoMax || ''}
              onChange={(e) => setFiltroPesoMax(e.target.value ? Number(e.target.value) : null)} />
            
            </div>
          </div>
        </div>
      }
    </div>);


}

function LegendaItem({ cor, label }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-sm border border-white/50" style={{ backgroundColor: cor }} />
      <span className="text-[11px] text-slate-700">{label}</span>
    </div>);

}