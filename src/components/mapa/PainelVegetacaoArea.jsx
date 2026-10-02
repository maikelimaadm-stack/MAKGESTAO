import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Leaf, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { medirVegetacaoArea, LIMIAR_CAPIM, TETO_PADRAO_KG_HA } from "./vegetacaoArea";
import VegetacaoAreaResumo from "./VegetacaoAreaResumo";

const CHAVE_TETO = 'vegetacao_teto_kg_ha';

export default function PainelVegetacaoArea({ area }) {
  const [teto, setTeto] = useState(() => {
    const salvo = Number(localStorage.getItem(CHAVE_TETO));
    return salvo > 0 ? salvo : TETO_PADRAO_KG_HA;
  });

  const { data: dados, isLoading, isError, refetch } = useQuery({
    queryKey: ['vegetacao-area', area?.id],
    queryFn: () => medirVegetacaoArea(area),
    enabled: !!area?.id,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const atualizarTeto = (valor) => {
    const numero = Number(valor);
    setTeto(numero);
    if (numero > 0) localStorage.setItem(CHAVE_TETO, String(numero));
  };

  const limiarPct = LIMIAR_CAPIM * 100;
  const vigorNormalizado = dados ? Math.max(0, (dados.vigorMedioAtivoPct - limiarPct) / (100 - limiarPct)) : 0;
  const massaKgHa = dados ? Math.round(teto * vigorNormalizado) : 0;
  const massaTotalT = dados ? massaKgHa * dados.produtivaHa / 1000 : 0;
  const [ano, mes, dia] = (dados?.data || '').split('-');

  return (
    <div className="space-y-3" translate="no">
      <div className="flex items-center gap-2">
        <Leaf className="w-4 h-4 text-emerald-700" />
        <div>
          <div className="text-sm font-semibold text-slate-900">{area?.nome || 'Área'}</div>
          <div className="text-[10px] text-slate-500">
            {[area?.setor_nome, area?.tipo_pastagem].filter(Boolean).join(' · ') || 'Pastagem'}
          </div>
        </div>
      </div>

      {isLoading &&
      <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Lendo a imagem do satélite desta área...
        </div>
      }

      {!isLoading && (isError || !dados) &&
      <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 text-xs text-amber-800">
          Não foi possível ler a vegetação desta área. Verifique a conexão com a internet ou se a área tem o polígono desenhado no mapa.
          <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={() => refetch()}>
            Tentar de novo
          </Button>
        </div>
      }

      {!isLoading && dados && dados.leituras === 0 &&
      <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 text-xs text-amber-800">
          Esta área é pequena em relação à resolução do satélite (~{Math.round(dados.resolucaoM)} m), então não há
          leitura de vegetação dentro dela. A leitura fica mais confiável em pastos maiores.
        </div>
      }

      {!isLoading && dados && dados.leituras > 0 &&
      <>
          <VegetacaoAreaResumo dados={dados} massaKgHa={massaKgHa} massaTotalT={massaTotalT} />

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-[10px] text-slate-500">Massa de capim no ponto de melhor vigor (kg MS/ha)</Label>
              <Input
              type="number"
              value={teto}
              onChange={(e) => atualizarTeto(e.target.value)}
              className="h-8 text-xs mt-1" />
            
            </div>
          </div>

          <p className="text-[9px] text-slate-500 leading-snug">
            Leitura do satélite MODIS (NDVI) de {dia}/{mes}/{ano}, resolução de ~{Math.round(dados.resolucaoM)} m ·
            {' '}{dados.leituras} leituras dentro desta área. A massa de capim é uma estimativa: ajuste o valor acima conforme a
            sua medição de campo para o cálculo ficar na realidade do pasto.
          </p>
        </>
      }
    </div>);

}