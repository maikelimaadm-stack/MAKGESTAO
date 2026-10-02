import React, { useState } from "react";
import { ChevronDown, ChevronUp, Palette } from "lucide-react";
import {
  CORES_TIPO_CULTURA,
  CORES_APROVEITAMENTO,
  CORES_OCUPACAO,
  CORES_UA_HA,
  CORES_SITUACAO_PASTO,
  MODOS_COLORACAO,
} from "./MapaFiltrosAvancados";

export default function MapaLegenda({ modoColoracao, categoriasGadoCores, tiposPastagemCores }) {
  const [collapsed, setCollapsed] = useState(false);

  if (modoColoracao === 'padrao') return null;

  const modoLabel = MODOS_COLORACAO.find(m => m.id === modoColoracao)?.label || '';

  let items = [];
  if (modoColoracao === 'tipo_cultura') {
    items = Object.entries(CORES_TIPO_CULTURA);
  } else if (modoColoracao === 'aproveitamento') {
    items = Object.entries(CORES_APROVEITAMENTO);
  } else if (modoColoracao === 'ocupacao') {
    items = Object.entries(CORES_OCUPACAO);
  } else if (modoColoracao === 'categoria_gado' && categoriasGadoCores) {
    items = Object.entries(categoriasGadoCores);
  } else if (modoColoracao === 'tipo_pastagem' && tiposPastagemCores) {
    items = Object.entries(tiposPastagemCores);
  } else if (modoColoracao === 'ua_ha') {
    items = Object.entries(CORES_UA_HA);
  } else if (modoColoracao === 'situacao_pasto') {
    items = Object.entries(CORES_SITUACAO_PASTO);
  }

  if (items.length === 0) return null;

  return (
    <div className="absolute bottom-20 md:bottom-16 left-3 z-10 w-[212px] rounded-xl overflow-hidden bg-slate-900/80 backdrop-blur-md border border-white/15 shadow-xl">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold text-white/90 uppercase tracking-wide">
        <span className="flex items-center gap-1.5">
          <Palette className="w-3 h-3 text-emerald-300" />
          {modoLabel}
        </span>
        {collapsed ? <ChevronUp className="w-3 h-3 text-white/60" /> : <ChevronDown className="w-3 h-3 text-white/60" />}
      </button>
      {!collapsed && (
        <div className="px-3 pb-2.5 pt-0.5 space-y-1.5 max-h-[42vh] overflow-y-auto">
          {items.map(([label, cor]) => (
            <div key={label} className="flex items-center gap-2">
              <span
                className="w-4 h-3 rounded-[4px] flex-shrink-0"
                style={{ backgroundColor: cor, boxShadow: '0 0 0 1px rgba(255,255,255,0.35) inset' }}
              />
              <span className="text-[10px] text-white/85 leading-tight">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}