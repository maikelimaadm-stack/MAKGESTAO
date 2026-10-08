import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
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
    <div className="absolute bottom-20 md:bottom-16 left-3 z-10 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg max-w-[200px]">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-slate-700 uppercase"
      >
        <span>{modoLabel}</span>
        {collapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {!collapsed && (
        <div className="px-3 pb-2 space-y-1">
          {items.map(([label, cor]) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-3 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: cor, border: '1px solid rgba(0,0,0,0.15)' }} />
              <span className="text-[10px] text-slate-700 leading-tight">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}