import React from "react";
import { Button } from "@/components/ui/button";
import {
  Filter, List, Check, X, Paperclip, MoreHorizontal, Plus,
  ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight,
  Trash2, Copy, Pencil, Settings2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const iconButtonClass =
  "h-8 w-9 rounded-none border-y-0 border-l-0 border-r border-[var(--mg-border)] bg-white hover:bg-[var(--mg-gray-fill)] text-[var(--mg-text-2)] hover:text-[var(--mg-text-1)] shadow-none transition-colors";

const TipBtn = ({ title, children }) => (
  <TooltipProvider delayDuration={300}>
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" className="rounded-md bg-[var(--mg-text-1)] text-white border-0 shadow-md px-2.5 py-1 text-xs font-medium">
        {title}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export default function LegacyRecordToolbar({
  title,
  operationLabel,
  badgeLabel = "LOTE",
  showSaveActions = false,
  showEditAction = false,
  showDeleteDuplicateActions = true,
  showUtilityActions = true,
  onCancel,
  onSave,
  onEditRecord,
  onSettingsClick,
  onLayoutConfigClick,
  onAttachClick,
  attachDisabled = false,
  onToggleView,
  onBack,
  total = 0,
  currentIndex = 0,
  onNew,
  onFirst,
  onPrevious,
  onNext,
  onLast,
  onDelete,
  onDuplicate,
  onRefresh,
  filterOpen = false,
  filterActive = false,
  onToggleFilter,
  onClearFilter
}) {
  const canNavigate = total > 0;
  const isFirst = currentIndex <= 0;
  const isLast = currentIndex >= total - 1;

  return (
    <div className="bg-white border-b border-[var(--mg-border)] shadow-sm">
      {/* Main toolbar row */}
      <div className="flex items-center h-9 overflow-x-auto whitespace-nowrap border-b border-[var(--mg-border)]">

        {/* Left nav group */}
        <div className="flex items-center h-full border-r border-[var(--mg-border)]">
          {onBack && (
            <TipBtn title="Voltar">
              <Button type="button" variant="ghost" size="icon" onClick={onBack} className={iconButtonClass}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </TipBtn>
          )}
          <TipBtn title="Visualizar tabela">
            <Button type="button" variant="ghost" size="icon" onClick={onToggleView} className={iconButtonClass}>
              <List className="w-4 h-4" />
            </Button>
          </TipBtn>
        </div>

        {/* New */}
        <TipBtn title="Novo registro">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onNew}
            className="h-8 w-9 rounded-none border-y-0 border-l-0 border-r border-[var(--mg-accent-light)] bg-[var(--mg-accent)] hover:bg-[var(--mg-accent-dark)] text-white shadow-none transition-colors"
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
                  ? "relative h-8 w-9 rounded-none border-y-0 border-l-0 border-r border-[var(--mg-red-light)] bg-[var(--mg-red)] hover:brightness-110 text-white shadow-none transition-colors"
                  : iconButtonClass
              }
            >
              <Filter className="w-4 h-4" />
              {filterActive && (
                <span
                  onClick={(e) => { e.stopPropagation(); onClearFilter?.(); }}
                  className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-white text-[var(--mg-red)] border border-[var(--mg-red-light)] text-[10px] leading-[13px] font-bold cursor-pointer"
                >
                  ×
                </span>
              )}
            </Button>
          </TipBtn>
        )}

        {/* Record navigation */}
        <div className="flex items-center h-full border-l border-[var(--mg-border)]">
          <TipBtn title="Primeiro registro">
            <Button type="button" variant="ghost" size="icon" onClick={onFirst} disabled={!canNavigate || isFirst} className={iconButtonClass}>
              <ChevronsLeft className="w-4 h-4" />
            </Button>
          </TipBtn>
          <TipBtn title="Registro anterior">
            <Button type="button" variant="ghost" size="icon" onClick={onPrevious} disabled={!canNavigate || isFirst} className={iconButtonClass}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </TipBtn>
          <TipBtn title="Próximo registro">
            <Button type="button" variant="ghost" size="icon" onClick={onNext} disabled={!canNavigate || isLast} className={iconButtonClass}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </TipBtn>
          <TipBtn title="Último registro">
            <Button type="button" variant="ghost" size="icon" onClick={onLast} disabled={!canNavigate || isLast} className={iconButtonClass}>
              <ChevronsRight className="w-4 h-4" />
            </Button>
          </TipBtn>
        </div>

        {/* Edit */}
        {showEditAction && (
          <TipBtn title="Editar registro">
            <Button type="button" variant="ghost" size="icon" onClick={onEditRecord} className={`${iconButtonClass} border-l border-[var(--mg-border)]`}>
              <Pencil className="w-4 h-4" />
            </Button>
          </TipBtn>
        )}

        {/* Delete / Duplicate */}
        {showDeleteDuplicateActions && (
          <TipBtn title="Excluir registro">
            <Button type="button" variant="ghost" size="icon" onClick={onDelete} disabled={!canNavigate} className={`${iconButtonClass} border-l border-[var(--mg-border)] hover:text-[var(--mg-red)] hover:bg-[var(--mg-red-light)]`}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </TipBtn>
        )}
        {showDeleteDuplicateActions && (
          <TipBtn title="Duplicar registro">
            <Button type="button" variant="ghost" size="icon" onClick={onDuplicate} disabled={!canNavigate} className={iconButtonClass}>
              <Copy className="w-4 h-4" />
            </Button>
          </TipBtn>
        )}

        {/* Save / Cancel */}
        {showSaveActions && (
          <div className="flex items-center h-full border-l border-[var(--mg-border)]">
            <TipBtn title="Salvar alterações">
              <Button type="button" variant="ghost" size="icon" onClick={onSave} className={`${iconButtonClass} text-[var(--mg-green)] hover:brightness-110 hover:bg-[var(--mg-green-light)]`}>
                <Check className="w-4 h-4" />
              </Button>
            </TipBtn>
            <TipBtn title="Descartar alterações">
              <Button type="button" variant="ghost" size="icon" onClick={onCancel} className={`${iconButtonClass} hover:text-[var(--mg-red)] hover:bg-[var(--mg-red-light)]`}>
                <X className="w-4 h-4" />
              </Button>
            </TipBtn>
          </div>
        )}

        {/* Right group */}
        <div className="ml-auto flex items-center h-full border-l border-[var(--mg-border)]">
          {showUtilityActions && (
            <TipBtn title={attachDisabled ? "Salve o registro antes de anexar" : "Anexos"}>
              <Button type="button" variant="ghost" size="icon" onClick={onAttachClick} disabled={attachDisabled} className={iconButtonClass}>
                <Paperclip className="w-4 h-4" />
              </Button>
            </TipBtn>
          )}

          {showUtilityActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className={iconButtonClass}>
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-lg shadow-lg border border-[var(--mg-border)] p-1">
                <DropdownMenuItem onClick={onLayoutConfigClick} disabled={!onLayoutConfigClick} className="h-8 cursor-pointer gap-2 text-xs rounded-md">
                  <Settings2 className="w-3.5 h-3.5 text-[var(--mg-text-3)]" />
                  Layout do formulário
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onSettingsClick} disabled={!onSettingsClick} className="h-8 cursor-pointer gap-2 text-xs rounded-md">
                  <Settings2 className="w-3.5 h-3.5 text-[var(--mg-text-3)]" />
                  Campos personalizados
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Counter */}
          <div className="h-full px-3 border-r border-[var(--mg-border)] bg-[var(--mg-gray-fill)] flex items-center justify-center min-w-[3rem]">
            <span className="text-xs font-semibold text-[var(--mg-text-1)]">
              {total > 0 ? <>{currentIndex + 1}<span className="text-[var(--mg-text-3)] font-normal">/{total}</span></> : total}
            </span>
          </div>
        </div>
      </div>

      {/* Record title bar */}
      <div className="h-7 flex items-center gap-2 bg-gradient-to-r from-[var(--mg-gray-fill)] to-white border-b border-[var(--mg-border)] px-3">
        <span className="px-1.5 py-0.5 rounded bg-[var(--mg-accent)] text-white text-[10px] font-bold uppercase tracking-wide">
          {badgeLabel}
        </span>
        <span className="text-xs font-semibold text-[var(--mg-text-1)] uppercase truncate min-w-0 flex-1">{title}</span>
        {operationLabel && (
          <span className="ml-auto text-[10px] font-bold text-[var(--mg-accent)] uppercase tracking-wide whitespace-nowrap">
            {operationLabel}
          </span>
        )}
      </div>
    </div>
  );
}