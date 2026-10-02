import React from "react";
import { Leaf } from "lucide-react";
import { dataReferenciaNdvi, NDVI_ESCALA } from "./mapaNdvi";

export default function MapaLegendaNdvi() {
  const [ano, mes, dia] = dataReferenciaNdvi().split("-");

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Leaf className="w-3.5 h-3.5 text-emerald-700" />
        <span className="text-[10px] font-bold text-emerald-900 uppercase">Vegetação por satélite</span>
      </div>

      <div className="flex h-3 rounded overflow-hidden">
        {NDVI_ESCALA.map((cor) =>
        <div key={cor} className="flex-1" style={{ backgroundColor: cor }} />
        )}
      </div>

      <div className="flex justify-between text-[9px] text-slate-600">
        <span>Menos capim</span>
        <span>Mais capim</span>
      </div>

      <p className="text-[9px] text-slate-500 leading-snug">
        Índice de vegetação (NDVI) do satélite MODIS, 250 m · composição de 8 dias de {dia}/{mes}/{ano}. Requer internet.
      </p>
    </div>);
}