import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Calculator, Settings2 } from "lucide-react";
import FuncionariosTable from "../components/folha/FuncionariosTable";
import Simulador from "../components/folha/Simulador";
import FichaFuncionario from "../components/folha/FichaFuncionario";
import RelatorioHolerite from "../components/folha/RelatorioHolerite";

export default function Folha() {
  return (
    <div className="min-h-screen bg-white" translate="no">
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Folha de Pagamento</h1>
            <p className="text-xs text-slate-600">Módulo isolado: sem menus do sistema principal</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700">
              <Calculator className="w-3.5 h-3.5 mr-1.5" /> Gerar Folha (em breve)
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs">
              <Settings2 className="w-3.5 h-3.5 mr-1.5" /> Configurações (em breve)
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <FuncionariosTable />
          <FichaFuncionario />
          <RelatorioHolerite />
          <Simulador />
        </div>

        <Card className="bg-slate-50">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4" /> Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-xs text-slate-600 list-disc pl-5 space-y-1">
              <li>CPF é exibido sempre mascarado; criptografia forte pode exigir upgrade para funções de backend.</li>
              <li>Etapa 1: cadastro e motor de cálculo prontos. Etapa 2 trará relatórios, PDFs e envios.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}