"use client"

import { ChevronDownIcon } from "lucide-react"
import { cn } from "cn"

import { Checkbox } from "@/components/ui/checkbox"
import {
  formatScaledNumber,
  itemAmount,
  mealLabel,
  scaledContributionQuantity,
  type PeopleCount,
} from "@/features/meal-plan/lib/shopping-list-utils"
import type { ShoppingItem } from "@/features/meal-plan/schemas/shopping-list.schema"

export function ShoppingListRow({
  item,
  people,
  checked,
  onToggleChecked,
  onOpenRecipe,
}: {
  item: ShoppingItem
  people: PeopleCount
  checked: boolean
  onToggleChecked: () => void
  onOpenRecipe: (id: string, title: string) => void
}) {
  return (
    <li>
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        <Checkbox
          checked={checked}
          onCheckedChange={onToggleChecked}
          aria-label={`Đánh dấu đã mua ${item.name}`}
          className="mt-0.5 shrink-0"
        />
        <details className="group min-w-0 flex-1">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 [&::-webkit-details-marker]:hidden">
            <span className={cn("min-w-0", checked && "line-through opacity-55")}>
              <span className="block font-medium">{item.name}</span>
              <span className="block text-muted-foreground">{itemAmount(item, people)}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              {item.contributions.length} món
              <ChevronDownIcon aria-hidden className="size-4 transition-transform group-open:rotate-180" />
            </span>
          </summary>
          <ul className="mt-2.5 divide-y divide-border rounded-lg bg-muted/50 text-sm">
            {item.contributions.map((source, index) => {
              const scaled = scaledContributionQuantity(source.quantity, source.servings, people)
              const formatted = formatScaledNumber(scaled, item.unit)
              return (
                <li
                  key={`${source.recipeId}:${source.day}:${source.section}:${index}`}
                  className="flex items-start justify-between gap-3 px-3 py-2"
                >
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onOpenRecipe(source.recipeId, source.recipeTitle)}
                      className="text-left font-medium text-foreground underline-offset-2 hover:underline"
                    >
                      {source.recipeTitle}
                    </button>
                    <p className="text-xs text-muted-foreground">{mealLabel(source.day, source.section)}</p>
                    <p className="text-xs text-muted-foreground">
                      Quy đổi cho {people} người (gốc {source.servings} suất)
                    </p>
                    {source.note && <p className="text-xs italic text-muted-foreground">{source.note}</p>}
                  </div>
                  <span className="shrink-0 text-right tabular-nums">
                    {formatted ?? <span className="text-muted-foreground">Chưa rõ lượng</span>}
                  </span>
                </li>
              )
            })}
          </ul>
        </details>
      </div>
    </li>
  )
}
