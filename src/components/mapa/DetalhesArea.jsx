import React from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import HistoricoAbateCurral from "./HistoricoAbateCurral";

export default function DetalhesArea({ area }) {
  const isCurral = area?.tipo_cultura === 'Infraestrutura' && String(area?.tipo_infraestrutura || area?.tipo_pastagem || '').trim().toLowerCase() === 'curral';

  if (!isCurral) return null;

  return (
    <div className="space-y-1" translate="no">
      <Tabs defaultValue="historico" className="w-full">
        <TabsContent value="historico" className="mt-0">
          <HistoricoAbateCurral areaId={area.id} />
        </TabsContent>
      </Tabs>
    </div>);

}