"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  CalendarXIcon,
  ChevronDownIcon,
  CopyIcon,
  RotateCcwIcon,
  ShoppingBasketIcon,
} from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import {
  DAY_LABELS,
  fetchShoppingList,
  formatQuantity,
  SECTION_LABELS,
  shoppingListKey,
  WEEKDAYS,
  type ShoppingItem,
  type Weekday,
} from "@/features/meal-plan/meal-plan"
import { RecipeDialog } from "@/features/recipes/components/recipe-card"
import { ApiError } from "@/features/shared/lib/api-client"

const SHORT_DAY_LABELS: Record<Weekday, string> = {
  MON: "T2",
  TUE: "T3",
  WED: "T4",
  THU: "T5",
  FRI: "T6",
  SAT: "T7",
  SUN: "CN",
}

function amount(quantity: string | null, unit: string | null) {
  return quantity === null ? null : [formatQuantity(quantity), unit].filter(Boolean).join(" ")
}

/** "100,25 g", "100,25 g + phần chưa rõ lượng" or "Chưa rõ lượng"; never 0 for unknown. */
function itemAmount({ knownQuantity, unit, hasUnknownQuantity }: ShoppingItem) {
  const known = amount(knownQuantity, unit)
  if (!known) return unit ? `Chưa rõ lượng (${unit})` : "Chưa rõ lượng"
  return hasUnknownQuantity ? `${known} + phần chưa rõ lượng` : known
}

function listText(items: ShoppingItem[]) {
  return items.map((item) => `- ${item.name}: ${itemAmount(item)}`).join("\n")
}

function dayNames(days: readonly Weekday[]) {
  return days.map((day) => DAY_LABELS[day]).join(", ")
}

/**
 * Header button of the saved week: the ingredients to buy for the chosen days,
 * in a side sheet. Read-only; it never changes the plan.
 */
export function ShoppingListButton({
  hasUnsavedChanges = false,
  plannedDays,
}: {
  hasUnsavedChanges?: boolean
  /** Days of the saved plan with at least one dish; unknown while it loads. */
  plannedDays?: readonly Weekday[]
}) {
  const [open, setOpen] = useState(false)
  const [days, setDays] = useState<Weekday[]>([...WEEKDAYS])
  const [openRecipeId, setOpenRecipeId] = useState<string | null>(null)
  const router = useRouter()
  const wholeWeek = days.length === WEEKDAYS.length
  // Nothing to fetch when every picked day is known to be empty.
  const nothingPlanned = plannedDays !== undefined && days.every((day) => !plannedDays.includes(day))
  // No `keepPreviousData`: after switching days, the old day's list must not
  // linger as if it were the new one's.
  const list = useAuthedSWR(open && !nothingPlanned ? shoppingListKey(days) : null, fetchShoppingList, {
    onError: (error) => {
      // Lets the proxy rotate the token pair; the retry uses the new one.
      if (error instanceof ApiError && error.status === 401) router.refresh()
    },
  })
  const items = list.data?.items ?? []

  /** One day at a time, like tabs; tapping the picked day again goes back to the whole week. */
  function pickDay(next: string[]) {
    const day = WEEKDAYS.find((weekday) => next.includes(weekday))
    setDays(day ? [day] : [...WEEKDAYS])
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(listText(items))
      toast.add({ title: "Đã sao chép danh sách mua sắm" })
    } catch {
      toast.add({ title: "Không sao chép được", description: "Trình duyệt chặn quyền sao chép." })
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" size="sm" />}>
        <ShoppingBasketIcon aria-hidden />
        Đi chợ
      </SheetTrigger>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Danh sách mua sắm</SheetTitle>
          <SheetDescription>
            Tính từ thực đơn đã lưu. Mỗi lần món xuất hiện tính đủ lượng của cả công thức,
            chưa chia theo số người.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-6">
          <div className="space-y-2">
            <Button
              type="button"
              variant={wholeWeek ? "default" : "outline"}
              size="sm"
              shape="pill"
              aria-pressed={wholeWeek}
              onClick={() => setDays([...WEEKDAYS])}
            >
              Cả tuần
            </Button>
            <ToggleGroup
              variant="outline"
              size="sm"
              spacing={1}
              aria-label="Chọn ngày"
              value={wholeWeek ? [] : days}
              onValueChange={pickDay}
              className="flex-wrap"
            >
              {WEEKDAYS.map((day) => {
                const empty = plannedDays !== undefined && !plannedDays.includes(day)
                return (
                  <ToggleGroupItem
                    key={day}
                    value={day}
                    aria-label={empty ? `${DAY_LABELS[day]}, chưa có thực đơn` : DAY_LABELS[day]}
                    title={empty ? "Chưa có thực đơn" : undefined}
                  >
                    <span className={cn(empty && "opacity-45")}>{SHORT_DAY_LABELS[day]}</span>
                  </ToggleGroupItem>
                )
              })}
            </ToggleGroup>
            {plannedDays !== undefined && plannedDays.length < WEEKDAYS.length && (
              <p className="text-xs text-muted-foreground">Ngày chữ mờ chưa có thực đơn.</p>
            )}
          </div>

          {hasUnsavedChanges && (
            <p role="note" className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
              Bản nháp hoặc đề xuất chưa lưu chưa được tính vào danh sách này.
            </p>
          )}

          {nothingPlanned ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CalendarXIcon aria-hidden />
                </EmptyMedia>
                <EmptyTitle>Chưa có thực đơn</EmptyTitle>
                <EmptyDescription>
                  {plannedDays?.length === 0
                    ? "Thực đơn đã lưu chưa có món nào, nên chưa có gì cần mua."
                    : `${dayNames(days)} chưa có món nào trong thực đơn, nên chưa có gì cần mua. Chọn ngày khác hoặc thêm món cho ngày này.`}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : list.isLoading && !list.data ? (
            <div role="status" aria-label="Đang tải danh sách mua sắm" className="space-y-2">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : list.error && !list.data ? (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span>Không tải được danh sách mua sắm.</span>
              <Button type="button" variant="outline" size="sm" shape="pill" onClick={() => void list.mutate()}>
                <RotateCcwIcon aria-hidden />
                Thử lại
              </Button>
            </div>
          ) : items.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ShoppingBasketIcon aria-hidden />
                </EmptyMedia>
                <EmptyTitle>Chưa có gì cần mua</EmptyTitle>
                <EmptyDescription>
                  {wholeWeek
                    ? "Các món trong thực đơn đã lưu chưa ghi nguyên liệu."
                    : `Các món ${dayNames(days)} chưa ghi nguyên liệu.`}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">{items.length} nguyên liệu</p>
                <Button type="button" variant="ghost" size="sm" onClick={() => void copy()}>
                  <CopyIcon aria-hidden />
                  Sao chép
                </Button>
              </div>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {items.map((item) => (
                  <ShoppingRow
                    key={`${item.ingredientId}:${item.unit ?? ""}`}
                    item={item}
                    onOpenRecipe={setOpenRecipeId}
                  />
                ))}
              </ul>
            </>
          )}
        </div>
        <RecipeDialog id={openRecipeId} onClose={() => setOpenRecipeId(null)} />
      </SheetContent>
    </Sheet>
  )
}

/** "Thứ Ba, bữa trưa"; the "Khác" section is snacks and drinks, not a meal. */
function mealLabel(day: Weekday, section: ShoppingItem["contributions"][number]["section"]) {
  const meal = section === "OTHER" ? "món khác" : `bữa ${SECTION_LABELS[section].toLowerCase()}`
  return `${DAY_LABELS[day]}, ${meal}`
}

/** One ingredient, expandable into the dishes, days and meals it comes from. */
function ShoppingRow({
  item,
  onOpenRecipe,
}: {
  item: ShoppingItem
  onOpenRecipe: (id: string) => void
}) {
  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">
            <span className="block font-medium">{item.name}</span>
            <span className="block text-muted-foreground">{itemAmount(item)}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            {item.contributions.length} món
            <ChevronDownIcon aria-hidden className="size-4 transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <ul className="mx-3 mb-3 divide-y divide-border rounded-lg bg-muted/50 text-sm">
          {item.contributions.map((source, index) => (
            <li
              key={`${source.recipeId}:${source.day}:${source.section}:${index}`}
              className="flex items-start justify-between gap-3 px-3 py-2"
            >
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => onOpenRecipe(source.recipeId)}
                  className="text-left font-medium text-foreground underline-offset-2 hover:underline"
                >
                  {source.recipeTitle}
                </button>
                <p className="text-xs text-muted-foreground">{mealLabel(source.day, source.section)}</p>
                <p className="text-xs text-muted-foreground">Công thức cho {source.servings} người</p>
                {source.note && <p className="text-xs italic text-muted-foreground">{source.note}</p>}
              </div>
              <span className="shrink-0 text-right tabular-nums">
                {amount(source.quantity, item.unit) ?? (
                  <span className="text-muted-foreground">Chưa rõ lượng</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </li>
  )
}
