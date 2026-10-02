import React from "react";
import { Sprout, Wheat, TriangleAlert, Leaf } from "lucide-react";
import { fmtNum, fmtHa } from "../common/formatNumber";

const numero = (valor, casas = 0) =>
Number.isFinite(valor) ? valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }) : '--';

function Bloco({ icone: Icone, titulo, valor, detalhe, cor }) {
  return (
    <div className="border border-slate-200 rounded-lg p-2.5 bg-white">
      <div className="flex items-center gap-1.5 mb-1">
        <Icone className={`w-3.5 h-3.5 ${cor}`} />
        <span className="text-[10px] font-semibold text-slate-500 uppercase">{titulo}</span>
      </div>
      <div className="text-base font-bold text-slate-900 leading-tight">{valor}</div>
      {detalhe && <div className="text-[10px] text-slate-500 mt-0.5">{detalhe}</div>}
    </div>);

}

export default function VegetacaoAreaResumo({ dados, massaKgHa, massaTotalT }) {
  const semCapimHa = Math.max(0, dados.areaHa - dados.produtivaHa);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Bloco
          icone={Wheat}
          cor="text-emerald-700"
          titulo="Massa de capim"
          valor={`${numero(massaKgHa)} kg MS/ha`}
          detalhe={`≈ ${numero(massaTotalT, 1)} t de capim na área produtiva`} />
        
        <Bloco
          icone={Sprout}
          cor="text-lime-600"
          titulo="Área produtiva"
          valor={`${numero(dados.produtivaHa, 1)} ha`}
          detalhe={`${numero(dados.coberturaPct)}% da área com capim`} />
        
        <Bloco
          icone={Leaf}
          cor="text-emerald-600"
          titulo="Cobertura de capim"
          valor={`${numero(dados.coberturaPct)}%`}
          detalhe={`Vigor médio ${numero(dados.vigorMedioAtivoPct)}%`} />
        
        <Bloco
          icone={TriangleAlert}
          cor="text-amber-600"
          titulo="Solo exposto / baixo vigor"
          valor={`${numero(semCapimHa, 1)} ha`}
          detalhe={`${numero(100 - dados.coberturaPct)}% da área`} />
        
      </div>

      <div className="border border-slate-200 rounded-lg p-2.5 bg-white">
        <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1.5">
          <span className="font-semibold uppercase">Vigor médio da vegetação</span>
          <span>{numero(dados.vigorMedioPct)}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-300 via-lime-400 to-emerald-700"
            style={{ width: `${Math.min(100, Math.max(2, dados.vigorMedioPct))}%` }} />
          
        </div>
        <div className="flex justify-between text-[9px] text-slate-400 mt-1">
          <span>{fmtHa(dados.areaHa)} de área total</span>
          <span>{fmtNum(dados.leituras)} leituras de satélite</span>
        </div>
      </div>
    </div>);

}