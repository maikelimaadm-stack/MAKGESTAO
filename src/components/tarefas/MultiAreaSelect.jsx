import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Check, MapPin } from "lucide-react";

/**
 * Multi-seleção de áreas/pastos de um setor.
 * Props:
 * - areas: lista de áreas disponíveis (do setor selecionado)
 * - selectedIds: array de IDs selecionados
 * - onChange: (ids, nomes) => void
 * - disabled: boolean
 * - placeholder: string
 */
export default function MultiAreaSelect({
  areas = [],
  selectedIds = [],
  onChange,
  disabled = false,
  placeholder = "SELECIONE"
}) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");

  const areasFiltradas = useMemo(() => {
    if (!busca) return areas;
    const termo = busca.toLowerCase();
    return areas.filter((area) => (area.nome || "").toLowerCase().includes(termo));
  }, [areas, busca]);

  const todasVisiveisSelecionadas = areasFiltradas.length > 0 &&
    areasFiltradas.every((area) => selectedIds.includes(area.id));

  const toggleArea = (areaId, checked) => {
    const area = areas.find((a) => a.id === areaId);
    if (checked) {
      const novosIds = [...selectedIds, areaId];
      const novosNomes = novosIds
        .map((id) => areas.find((a) => a.id === id)?.nome)
        .filter(Boolean);
      onChange(novosIds, novosNomes);
    } else {
      const novosIds = selectedIds.filter((id) => id !== areaId);
      const novosNomes = novosIds
        .map((id) => areas.find((a) => a.id === id)?.nome)
        .filter(Boolean);
      onChange(novosIds, novosNomes);
    }
  };

  const toggleAll = (checked) => {
    if (checked) {
      const todosIds = areasFiltradas.map((a) => a.id);
      const todosNomes = areasFiltradas.map((a) => a.nome).filter(Boolean);
      onChange(todosIds, todosNomes);
    } else {
      onChange([], []);
    }
  };

  const limpar = () => {
    onChange([], []);
    setOpen(false);
  };

  const textoExibicao = selectedIds.length === 0
    ? placeholder
    : selectedIds.length === 1
      ? areas.find((a) => a.id === selectedIds[0])?.nome?.toUpperCase() || placeholder
      : `${selectedIds.length} ÁREAS SELECIONADAS`;

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setBusca(""); }} disabled={disabled}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          disabled={disabled}
          className="h-7 w-full justify-between text-xs border-0 shadow-none focus:ring-0 bg-transparent hover:bg-transparent px-0 disabled:opacity-50">
          <span className={`truncate text-left ${selectedIds.length > 0 ? "text-slate-700" : "text-slate-400"}`}>
            {textoExibicao}
          </span>
          <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={4} className="w-[280px] p-0 z-[9999]">
        <div className="p-2 space-y-2 border-b">
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="BUSCAR ÁREA..."
            className="h-7 text-xs uppercase" />
        </div>

        <div className="p-1 max-h-56 overflow-y-auto">
          {areasFiltradas.length === 0 ? (
            <div className="text-center py-4 text-xs text-slate-400">
              {busca ? "Nenhuma área encontrada" : "Nenhuma área disponível"}
            </div>
          ) : (
            <>
              <label className="flex h-7 items-center gap-2 px-2 text-xs text-slate-700 border-b border-slate-200 hover:bg-slate-50 cursor-pointer">
                <Checkbox
                  checked={todasVisiveisSelecionadas}
                  onCheckedChange={toggleAll}
                  className="h-3.5 w-3.5 shrink-0" />
                <span className="font-medium">(Selecionar tudo)</span>
              </label>
              {areasFiltradas.map((area) => (
                <label
                  key={area.id}
                  className="flex h-7 items-center gap-2 px-2 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap">
                  <Checkbox
                    checked={selectedIds.includes(area.id)}
                    onCheckedChange={(checked) => toggleArea(area.id, checked)}
                    className="h-3.5 w-3.5 shrink-0" />
                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="flex-1 overflow-hidden text-ellipsis">{(area.nome || "").toUpperCase()}</span>
                </label>
              ))}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 p-1 border-t">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-slate-500"
            onClick={limpar}
            disabled={selectedIds.length === 0}>
            Limpar
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => setOpen(false)}>
            <Check className="w-3 h-3 mr-1" />
            Concluir
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}