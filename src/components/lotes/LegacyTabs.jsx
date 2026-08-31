import React, { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const SYSTEM_PANEL_IDS = ["geral", "compra", "identificacao", "observacoes", "campos_personalizados"];
const isCustomPanel = (tab) => tab && !SYSTEM_PANEL_IDS.includes(tab.id);
const CustomMarker = () => <span className="pointer-events-none absolute bottom-0 right-0 z-10 w-0 h-0 border-l-[7px] border-l-transparent border-b-[7px] border-b-green-500" />;
const navButtonClass = "relative z-20 h-7 flex-none self-center bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center w-8";

export default function LegacyTabs({ tabs = [], activeTab, onChange }) {
  const tabsScrollRef = useRef(null);
  const scrollTabs = (direction) => tabsScrollRef.current?.scrollBy({ left: direction * 260, behavior: "smooth" });

  return (
    <div className="relative flex h-9 items-end gap-0 bg-white before:absolute before:left-0 before:right-0 before:bottom-0 before:h-px before:bg-slate-300">
      <button type="button" onClick={() => scrollTabs(-1)} className={`${navButtonClass} border-r border-slate-300`} title="Painéis anteriores">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button type="button" onClick={() => scrollTabs(1)} className={navButtonClass} title="Próximos painéis">
        <ChevronRight className="w-4 h-4" />
      </button>
      <div ref={tabsScrollRef} className="flex min-w-0 flex-1 items-end gap-0 overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`relative z-10 flex-none h-8 min-w-max px-4 mx-0.5 border border-slate-300 text-xs whitespace-nowrap overflow-hidden transition-colors rounded-[2px_2px_0px_0px] ${active ? "bg-white text-slate-800 font-semibold border-t-2 border-t-green-500 border-b-white" : "bg-slate-50 text-slate-700 border-b-slate-300 hover:bg-white"}`}>
              {isCustomPanel(tab) && <CustomMarker />}
              {tab.label}
            </button>);

        })}
      </div>
    </div>);

}