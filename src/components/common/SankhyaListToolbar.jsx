import React from "react";
import { Button } from "@/components/ui/button";
import {
  Filter,
  List,
  Table,
  Plus,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Trash2,
  Copy,
  Search,
  Paperclip,
  MoreHorizontal,
  FileSpreadsheet,
  FileText,
  Settings2,
  Columns3
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const iconButtonClass =
  "h-8 w-9 rounded-none border-y-0 border-l-0 border-r border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 shadow-none transition-colors";

const TipBtn = ({ title, children }) => (
  <TooltipProvider delayDuration={300}>
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" className="rounded-md bg-slate-900 text-white border-0 shadow-md px-2.5 py-1 text-xs font-medium">
        {title}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export default function SankhyaListToolbar({
  viewMode = "table",
  total = 0,
  currentIndex = 0,
  searchValue = "",
  onSearchChange,
  onNew,
  onToggleView,
  onBack,
  toggleViewDisabled = false,
  filterOpen = false,
  filterActive = false,
  onToggleFilter,
  onClearFilter,
  onFirst,
  onPrevious,
  onNext,
  onLast,
  onDelete,
  onDuplicate,
  onRefresh,
  onAttachClick,
  attachDisabled = false,
  onExportPdf,
  onConfigExportPdf,
  onExportExcel,
  onConfigExportExcel,
  onConfigColumns,
  selectedCount = 0,
  title = "REGISTROS",
  recordLabel = "LOTE",
  operationLabel,
  showUtilityActions = true,
  showSearch = true
}) {
  const canNavigate = viewMode === "record" && total > 0;
  const showRecordNavigation = viewMode === "record";
  const showDeleteSelectionAction = viewMode === "table" && selectedCount > 0 && !!onDelete;
  const showDuplicateSelectionAction = viewMode === "table" && selectedCount === 1 && !!onDuplicate;

  return (
    <div className="bg-white border-b border-slate-200 shadow-sm">
      {/* Main toolbar row */}
      <div className="flex items-center h-9 overflow-x-auto whitespace-nowrap border-b border-slate-200">

        {/* Left group */}
        <div className="flex items-center h-full border-r border-slate-200">
          {onBack && (
            <TipBtn title="Voltar">
              <Button type="button" variant="ghost" size="icon" onClick={onBack} className={iconButtonClass}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </TipBtn>
          )}
          <TipBtn title={toggleViewDisabled ? "Selecione apenas um registro" : viewMode === "table" ? "Visualizar registro" : "Visualizar tabela"}>
            <Button type="button" variant="ghost" size="icon" onClick={onToggleView} disabled={toggleViewDisabled} className={iconButtonClass}>
              {viewMode === "table" ? <List className="w-4 h-4" /> : <Table className="w-4 h-4" />}
            </Button>
          </TipBtn>
        </div>

        {/* New button — highlighted */}
        <TipBtn title="Novo registro">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onNew}
            className="h-8 w-9 rounded-none border-y-0 border-l-0 border-r border-emerald-200 bg-emerald-500 hover:bg-emerald-600 text-white shadow-none transition-colors"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </TipBtn>

        {/* Filter */}
        {onToggleFilter && (
          <TipBtn title={filterActive ? "Filtro ativo — clique para gerenciar" : "Filtros"}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onToggleFilter}
              className={
                filterOpen || filterActive
                  ? "relative h-8 w-9 rounded-none border-y-0 border-l-0 border-r border-red-300 bg-red-500 hover:bg-red-600 text-white shadow-none transition-colors"
                  : iconButtonClass
              }
            >
              <Filter className="w-4 h-4" />
              {filterActive && (
                <span
                  onClick={(e) => { e.stopPropagation(); onClearFilter?.(); }}
                  className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-white text-red-600 border border-red-400 text-[10px] leading-[13px] font-bold cursor-pointer hover:bg-red-50"
                >
                  ×
                </span>
              )}
            </Button>
          </TipBtn>
        )}

        {/* Navigation — record mode only */}
        {showRecordNavigation && (
          <div className="flex items-center h-full border-l border-slate-200">
            <TipBtn title="Primeiro registro">
              <Button type="button" variant="ghost" size="icon" onClick={onFirst} disabled={!canNavigate} className={iconButtonClass}>
                <ChevronsLeft className="w-4 h-4" />
              </Button>
            </TipBtn>
            <TipBtn title="Registro anterior">
              <Button type="button" variant="ghost" size="icon" onClick={onPrevious} disabled={!canNavigate} className={iconButtonClass}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </TipBtn>
            <TipBtn title="Próximo registro">
              <Button type="button" variant="ghost" size="icon" onClick={onNext} disabled={!canNavigate} className={iconButtonClass}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </TipBtn>
            <TipBtn title="Último registro">
              <Button type="button" variant="ghost" size="icon" onClick={onLast} disabled={!canNavigate} className={iconButtonClass}>
                <ChevronsRight className="w-4 h-4" />
              </Button>
            </TipBtn>
          </div>
        )}

        {/* Delete / Duplicate */}
        {showDeleteSelectionAction && (
          <TipBtn title={selectedCount > 1 ? `Excluir ${selectedCount} selecionados` : "Excluir registro"}>
            <Button type="button" variant="ghost" size="icon" onClick={onDelete} className={`${iconButtonClass} hover:text-red-600 hover:bg-red-50 border-l border-slate-200`}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </TipBtn>
        )}
        {showDuplicateSelectionAction && (
          <TipBtn title="Duplicar registro">
            <Button type="button" variant="ghost" size="icon" onClick={onDuplicate} className={iconButtonClass}>
              <Copy className="w-4 h-4" />
            </Button>
          </TipBtn>
        )}

        {/* Right group */}
        <div className="ml-auto flex items-center h-full border-l border-slate-200">

          {/* Search */}
          {showSearch && (
            <div className="relative h-full w-44 md:w-56 border-r border-slate-200 bg-white flex items-center">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder="Pesquisar..."
                className="h-full w-full pl-8 pr-3 text-xs bg-transparent outline-none text-slate-700 placeholder:text-slate-400"
              />
            </div>
          )}

          {/* Attachments */}
          {showUtilityActions && (
            <TipBtn title={attachDisabled ? "Selecione apenas um registro" : "Anexos"}>
              <Button type="button" variant="ghost" size="icon" onClick={onAttachClick} disabled={attachDisabled} className={iconButtonClass}>
                <Paperclip className="w-4 h-4" />
              </Button>
            </TipBtn>
          )}

          {/* More options dropdown */}
          {showUtilityActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className={iconButtonClass} title="Mais opções">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-lg shadow-lg border border-slate-200 p-1">
                <DropdownMenuItem onClick={onConfigColumns} disabled={!onConfigColumns} className="h-8 cursor-pointer gap-2 text-xs rounded-md">
                  <Columns3 className="w-3.5 h-3.5 text-slate-500" />
                  Configurar colunas
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="flex items-center rounded-md overflow-hidden">
                  <DropdownMenuItem onClick={onExportExcel} disabled={!onExportExcel} className="h-8 flex-1 cursor-pointer gap-2 text-xs rounded-none rounded-l-md">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    Exportar Excel
                  </DropdownMenuItem>
                  <button
                    type="button"
                    onClick={onConfigExportExcel}
                    disabled={!onConfigExportExcel}
                    className="h-8 w-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 rounded-r-md transition-colors"
                    title="Configurar Excel"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center rounded-md overflow-hidden">
                  <DropdownMenuItem onClick={onExportPdf} disabled={!onExportPdf} className="h-8 flex-1 cursor-pointer gap-2 text-xs rounded-none rounded-l-md">
                    <FileText className="w-3.5 h-3.5 text-red-500" />
                    Exportar PDF
                  </DropdownMenuItem>
                  <button
                    type="button"
                    onClick={onConfigExportPdf}
                    disabled={!onConfigExportPdf}
                    className="h-8 w-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 rounded-r-md transition-colors"
                    title="Configurar PDF"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Counter badge */}
          <div className="h-full px-3 border-r border-slate-200 bg-slate-50 flex items-center justify-center gap-1 min-w-[3rem]">
            {selectedCount > 0 ? (
              <span className="text-xs font-semibold text-emerald-700">{selectedCount}<span className="text-slate-400 font-normal">/{total}</span></span>
            ) : viewMode === "record" && total > 0 ? (
              <span className="text-xs font-semibold text-slate-700">{currentIndex + 1}<span className="text-slate-400 font-normal">/{total}</span></span>
            ) : (
              <span className="text-xs font-semibold text-slate-600">{total}</span>
            )}
          </div>
        </div>
      </div>

      {/* Record title bar */}
      {viewMode === "record" && (
        <div className="h-7 flex items-center gap-2 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 px-3">
          {recordLabel && (
            <span className="px-1.5 py-0.5 rounded bg-slate-600 text-white text-[10px] font-bold uppercase tracking-wide">
              {recordLabel}
            </span>
          )}
          <span className="text-xs font-semibold text-slate-700 truncate min-w-0 flex-1">{title}</span>
          <span className="ml-auto text-[10px] font-bold text-emerald-700 uppercase tracking-wide whitespace-nowrap">
            {operationLabel || "VISUALIZAÇÃO DE REGISTRO"}
          </span>
        </div>
      )}
    </div>
  );
}