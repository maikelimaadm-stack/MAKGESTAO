import React from "react";
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
    <div className="mg-action-bar">
      {/* Left group */}
      <div className="mg-action-bar__zone">
        {onBack && (
          <TipBtn title="Voltar">
            <button type="button" onClick={onBack} className={`ios-btn tb-btn tb-btn-ghost tb-btn-icon`}>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </TipBtn>
        )}
        <TipBtn title={toggleViewDisabled ? "Selecione apenas um registro" : viewMode === "table" ? "Visualizar registro" : "Visualizar tabela"}>
          <button type="button" onClick={onToggleView} disabled={toggleViewDisabled} className={`ios-btn tb-btn tb-btn-ghost tb-btn-icon ${toggleViewDisabled ? "" : ""}`}>
            {viewMode === "table" ? <List className="w-4 h-4" /> : <Table className="w-4 h-4" />}
          </button>
        </TipBtn>
      </div>

      {/* New button — green accent */}
      <TipBtn title="Novo registro">
        <button type="button" onClick={onNew} className="ios-btn tb-btn tb-btn-green tb-btn-icon">
          <Plus className="w-4 h-4" />
        </button>
      </TipBtn>

      {/* Filter */}
      {onToggleFilter && (
        <TipBtn title={filterActive ? "Filtro ativo — clique para gerenciar" : "Filtros"}>
          <button
            type="button"
            onClick={onToggleFilter}
            className={`ios-btn tb-btn tb-btn-icon ${filterOpen || filterActive ? "tb-btn-red" : "tb-btn-ghost"} relative`}
          >
            <Filter className="w-4 h-4" />
            {filterActive && (
              <span
                onClick={(e) => { e.stopPropagation(); onClearFilter?.(); }}
                className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-white text-red-600 border border-red-400 text-[10px] leading-[13px] font-bold cursor-pointer hover:bg-red-50 flex items-center justify-center"
              >
                ×
              </span>
            )}
          </button>
        </TipBtn>
      )}

      {/* Navigation — record mode only */}
      {showRecordNavigation && (
        <div className="mg-action-bar__zone">
          <TipBtn title="Primeiro registro">
            <button type="button" onClick={onFirst} disabled={!canNavigate} className="ios-btn mg-nav-btn">
              <ChevronsLeft className="w-4 h-4" />
            </button>
          </TipBtn>
          <TipBtn title="Registro anterior">
            <button type="button" onClick={onPrevious} disabled={!canNavigate} className="ios-btn mg-nav-btn">
              <ChevronLeft className="w-4 h-4" />
            </button>
          </TipBtn>
          <TipBtn title="Próximo registro">
            <button type="button" onClick={onNext} disabled={!canNavigate} className="ios-btn mg-nav-btn">
              <ChevronRight className="w-4 h-4" />
            </button>
          </TipBtn>
          <TipBtn title="Último registro">
            <button type="button" onClick={onLast} disabled={!canNavigate} className="ios-btn mg-nav-btn">
              <ChevronsRight className="w-4 h-4" />
            </button>
          </TipBtn>
        </div>
      )}

      {/* Delete / Duplicate */}
      {showDeleteSelectionAction && (
        <TipBtn title={selectedCount > 1 ? `Excluir ${selectedCount} selecionados` : "Excluir registro"}>
          <button type="button" onClick={onDelete} className="ios-btn tb-btn tb-btn-red tb-btn-icon">
            <Trash2 className="w-4 h-4" />
          </button>
        </TipBtn>
      )}
      {showDuplicateSelectionAction && (
        <TipBtn title="Duplicar registro">
          <button type="button" onClick={onDuplicate} className="ios-btn tb-btn tb-btn-ghost tb-btn-icon">
            <Copy className="w-4 h-4" />
          </button>
        </TipBtn>
      )}

      {/* Right group */}
      <div className="mg-action-bar__zone ml-auto">

        {/* Search */}
        {showSearch && (
          <div className="mg-action-bar__search-pill">
            <Search className="w-3.5 h-3.5 text-slate-400 pointer-events-none shrink-0" />
            <input
              value={searchValue}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Pesquisar..."
            />
          </div>
        )}

        {/* Attachments */}
        {showUtilityActions && (
          <TipBtn title={attachDisabled ? "Selecione apenas um registro" : "Anexos"}>
            <button type="button" onClick={onAttachClick} disabled={attachDisabled} className="ios-btn tb-btn tb-btn-ghost tb-btn-icon">
              <Paperclip className="w-4 h-4" />
            </button>
          </TipBtn>
        )}

        {/* More options dropdown */}
        {showUtilityActions && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="ios-btn tb-btn tb-btn-more tb-btn-icon" title="Mais opções">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-lg shadow-lg border border-slate-200 p-1">
              <DropdownMenuItem onClick={onConfigColumns} disabled={!onConfigColumns} className="h-8 cursor-pointer gap-2 text-xs rounded-md">
                <Columns3 className="w-3.5 h-3.5 text-slate-500" />
                Configurar colunas
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="flex items-center rounded-md overflow-hidden">
                <DropdownMenuItem onClick={onExportExcel} disabled={!onExportExcel} className="h-8 flex-1 cursor-pointer gap-2 text-xs rounded-none rounded-l-md">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-primary" />
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
        <div className={`mg-toolbar-counter ${selectedCount > 0 ? "mg-toolbar-counter--active" : ""}`}>
          {selectedCount > 0 ? (
            <>{selectedCount}<span className="opacity-50 font-normal">/{total}</span></>
          ) : viewMode === "record" && total > 0 ? (
            <>{currentIndex + 1}<span className="opacity-50 font-normal">/{total}</span></>
          ) : (
            <>{total}</>
          )}
        </div>
      </div>

      {/* Record title bar */}
      {viewMode === "record" && (
        <div className="flex items-center gap-2 bg-slate-50 border-t border-slate-100 px-3 py-1.5 w-full">
          {recordLabel && (
            <span className="px-1.5 py-0.5 rounded bg-slate-600 text-white text-[10px] font-bold uppercase tracking-wide">
              {recordLabel}
            </span>
          )}
          <span className="text-xs font-semibold text-slate-700 truncate min-w-0 flex-1">{title}</span>
          <span className="ml-auto text-[10px] font-bold text-primary uppercase tracking-wide whitespace-nowrap">
            {operationLabel || "VISUALIZAÇÃO DE REGISTRO"}
          </span>
        </div>
      )}
    </div>
  );
}