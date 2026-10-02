import React from "react";
import { Leaf, Loader2 } from "lucide-react";
import { dataReferenciaNdvi, NDVI_ESCALA } from "./mapaNdvi";
import { CLASSES_AREA, CLASSES_VEGETACAO } from "./vegetacaoZonas";

export default function MapaLegendaNdvi({ resumo = null, carregando = false }) {
  const [ano, mes, dia] = dataReferenciaNdvi().split("-");
  const contagemClasse = resumo?.contagemClasse || {};
  const contagemAreas = resumo?.contagemAreas || {};

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

      {carregando &&
      <div className="flex items-center gap-1.5 text-[9px] text-slate-600 pt-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          Lendo os pontos de capim das áreas...
        </div>
      }

      {!carregando && resumo &&
      <div className="space-y-1 pt-1.5 border-t border-emerald-200">
          <div className="text-[9px] font-bold text-emerald-900 uppercase">Pontos lidos no mapa</div>
          {CLASSES_VEGETACAO.map((classe) =>
        <div key={classe.id} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full border border-white shadow" style={{ backgroundColor: classe.cor }} />
                <span className="text-[9px] text-slate-700">{classe.nome}</span>
              </span>
              <span className="text-[9px] font-semibold text-slate-500">{contagemClasse[classe.id] || 0}</span>
            </div>
        )}

          <div className="text-[9px] font-bold text-emerald-900 uppercase pt-1">Áreas por massa de forragem</div>
          {CLASSES_AREA.map((classe) =>
        <div key={classe.id} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full border border-white shadow" style={{ backgroundColor: classe.cor }} />
                <span className="text-[9px] text-slate-700">{classe.plural}</span>
              </span>
              <span className="text-[9px] font-semibold text-slate-500">{contagemAreas[classe.id] || 0}</span>
            </div>
        )}
        </div>
      }

      <p className="text-[9px] text-slate-500 leading-snug">
        Cor da vegetação: NDVI do satélite MODIS (250 m · composição de 8 dias de {dia}/{mes}/{ano}). Detalhe do capim:
        imagem Sentinel-2 (30 m) da data disponível mais recente. Requer internet.
      </p>
    </div>);
}