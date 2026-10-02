import React from "react";
import { Leaf, Loader2, WifiOff } from "lucide-react";
import { CLASSES_AREA, CLASSES_VEGETACAO, MASSA_IDEAL_KG_HA } from "./vegetacaoZonas";

const Linha = ({ cor, nome, valor }) =>
<div className="flex items-center justify-between gap-2">
    <span className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full border border-white shadow" style={{ backgroundColor: cor }} />
      <span className="text-[10px] text-slate-700">{nome}</span>
    </span>
    <span className="text-[10px] font-semibold text-slate-500">{valor}</span>
  </div>;


export default function LegendaVegetacaoPontos({ resumo, carregando = false, erro = false }) {
  const contagemClasse = resumo?.contagemClasse || {};
  const contagemAreas = resumo?.contagemAreas || {};
  const data = resumo?.data ? resumo.data.split('-').reverse().join('/') : '';

  return (
    <div className="bg-white/95 border border-emerald-200 rounded-lg px-2.5 py-2 shadow-md w-[190px]">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Leaf className="w-3.5 h-3.5 text-emerald-700" />
        <span className="text-[10px] font-bold text-slate-800 uppercase">Vegetação por satélite</span>
      </div>

      {carregando &&
      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 py-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          Lendo o satélite das áreas...
        </div>
      }

      {!carregando && erro &&
      <div className="flex items-start gap-1.5 text-[10px] text-amber-700">
          <WifiOff className="w-3 h-3 mt-0.5 shrink-0" />
          Sem leitura agora. A vegetação precisa de internet.
        </div>
      }

      {!carregando && !erro && resumo &&
      <>
          <div className="text-[9px] font-bold text-emerald-900 uppercase mb-1">Pontos lidos</div>
          <div className="space-y-0.5">
            {CLASSES_VEGETACAO.map((classe) =>
          <Linha key={classe.id} cor={classe.cor} nome={classe.nome} valor={contagemClasse[classe.id] || 0} />
          )}
          </div>

          <div className="text-[9px] font-bold text-emerald-900 uppercase mt-1.5 mb-1 pt-1.5 border-t border-slate-200">Áreas por massa de forragem</div>
          <div className="space-y-0.5">
            {CLASSES_AREA.map((classe) =>
          <Linha key={classe.id} cor={classe.cor} nome={classe.plural} valor={contagemAreas[classe.id] || 0} />
          )}
          </div>

          <p className="text-[9px] text-slate-500 mt-1.5 leading-snug">
            Ideal: {MASSA_IDEAL_KG_HA.minimo.toLocaleString('pt-BR')} a {MASSA_IDEAL_KG_HA.maximo.toLocaleString('pt-BR')} kg MS/ha
          </p>

          <p className="text-[9px] text-slate-400 mt-1 leading-snug">
            Toque em um ponto para abrir a área{data ? ` · ${data}` : ''}
          </p>
        </>
      }
    </div>);

}