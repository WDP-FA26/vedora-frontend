"use client"

import {
  ArrowRightLeftIcon,
  BookOpenIcon,
  CheckIcon,
  EllipsisIcon,
  MessageCircleIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DAY_LABELS, SECTION_LABELS } from "@/features/meal-plan/lib/dates"
import type { SlotRef } from "@/features/meal-plan/schemas/meal-plan.schema"
import { tagView, type RecipeTag } from "@/features/recipes/tags"
import { cn } from "@/lib/utils"

export const CALENDAR_DRAG_TYPE = "application/x-vedora-meal"

export function slotLabel({ day, section }: SlotRef) {
  return `${DAY_LABELS[day]}, bữa ${SECTION_LABELS[section].toLowerCase()}`
}

export function CalendarDishChip({
  title,
  tag,
  slot,
  recipeId,
  warnings,
  disabled,
  eaten = false,
  eatingBusy = false,
  onToggleEaten,
  onOpen,
  onMove,
  onRemove,
  onAsk,
}: {
  title: string
  tag: RecipeTag | null
  slot: SlotRef
  recipeId: string
  warnings: string[]
  disabled: boolean
  eaten?: boolean
  eatingBusy?: boolean
  onToggleEaten?: () => void
  onOpen: () => void
  onMove: () => void
  onRemove: () => void
  onAsk?: () => void
}) {
  const { icon: TagIcon, label: tagLabel } = tagView(tag)
  const warning = warnings.join("; ")
  return (
    <div
      draggable={!disabled}
      onDragStart={(event) => {
        event.dataTransfer.setData(CALENDAR_DRAG_TYPE, JSON.stringify({ ...slot, recipeId }))
        event.dataTransfer.effectAllowed = "move"
      }}
      className={cn(
        "group flex min-w-0 items-center gap-0.5 rounded-lg border py-0.5 pr-0.5 pl-1.5 text-xs",
        eaten ? "border-emerald-500/35 bg-emerald-500/10" : "border-transparent bg-primary/10",
        !disabled && "cursor-grab active:cursor-grabbing"
      )}
    >
      {onToggleEaten && (
        <button
          type="button"
          disabled={eatingBusy}
          aria-pressed={eaten}
          aria-label={eaten ? `Bỏ đánh dấu đã ăn ${title}` : `Đánh dấu đã ăn ${title}`}
          title={eaten ? "Đã ăn (bấm để bỏ)" : "Đánh dấu đã ăn"}
          onClick={onToggleEaten}
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
            eaten
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-primary/40 bg-background/80 text-transparent hover:border-primary hover:text-primary/60"
          )}
        >
          <CheckIcon aria-hidden className="size-2.5" />
        </button>
      )}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Xem công thức ${title}, ${slotLabel(slot)}`}
        title={warning ? `${title}: ${warning}` : `${title} · ${tagLabel}`}
        className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md py-0.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        <TagIcon aria-hidden className="size-3.5 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 line-clamp-2 break-words leading-tight font-medium text-foreground">
          {title}
        </span>
        {warning && (
          <>
            <TriangleAlertIcon aria-hidden className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="sr-only">Cần xem lại: {warning}</span>
          </>
        )}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`Tùy chọn cho ${title}, ${slotLabel(slot)}`}
            />
          }
        >
          <EllipsisIcon aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onOpen}>
            <BookOpenIcon aria-hidden /> Xem công thức
          </DropdownMenuItem>
          {onToggleEaten && (
            <DropdownMenuItem onClick={onToggleEaten}>
              <CheckIcon aria-hidden /> {eaten ? "Bỏ đánh dấu đã ăn" : "Đánh dấu đã ăn"}
            </DropdownMenuItem>
          )}
          {onAsk && (
            <DropdownMenuItem onClick={onAsk}>
              <MessageCircleIcon aria-hidden /> Hỏi trợ lý
            </DropdownMenuItem>
          )}
          {!disabled && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onMove}>
                <ArrowRightLeftIcon aria-hidden /> Chuyển sang…
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={onRemove}>
                <Trash2Icon aria-hidden /> Xóa khỏi bữa
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
