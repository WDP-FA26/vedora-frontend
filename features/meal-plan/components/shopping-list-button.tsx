"use client"

import { useImperativeHandle, useRef, useState, type Ref } from "react"
import { useRouter } from "next/navigation"
import {
  CalendarXIcon,
  ChevronDownIcon,
  CopyIcon,
  RotateCcwIcon,
  ShoppingBasketIcon,
  UsersIcon,
} from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import {
  readScrollState,
  scrollContainer,
  type ScreenScrollDirection,
  type VoiceScrollState,
} from "@/features/meal-plan/voice"
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

const PEOPLE_COUNTS = [1, 2, 3, 4] as const
type PeopleCount = (typeof PEOPLE_COUNTS)[number]
const PEOPLE_STORAGE_KEY = "vedora:shopping-people"

function loadPeopleCount(): PeopleCount {
  if (typeof window === "undefined") return 1
  try {
    const raw = Number(window.localStorage.getItem(PEOPLE_STORAGE_KEY))
    const matched = PEOPLE_COUNTS.find((count) => count === raw)
    return matched ?? 1
  } catch {
    return 1
  }
}

function savePeopleCount(count: PeopleCount) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(PEOPLE_STORAGE_KEY, String(count))
  } catch {
    // Ignore storage quota or private-mode restrictions.
  }
}

function checkedStorageKey(weekStart: string) {
  return `vedora:shopping-checked:${weekStart}`
}

function loadCheckedKeys(weekStart: string): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(checkedStorageKey(weekStart))
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === "string")
  } catch {
    return []
  }
}

function saveCheckedKeys(weekStart: string, keys: readonly string[]) {
  if (typeof window === "undefined") return
  try {
    if (keys.length === 0) {
      window.localStorage.removeItem(checkedStorageKey(weekStart))
      return
    }
    window.localStorage.setItem(checkedStorageKey(weekStart), JSON.stringify(keys))
  } catch {
    // Ignore storage quota or private-mode restrictions.
  }
}

/** Scales one recipe contribution from its base yield (`servings`) to `people` eaters. */
function scaledContributionQuantity(
  quantity: string | null,
  servings: number,
  people: PeopleCount
): number | null {
  if (quantity === null) return null
  const numeric = Number(quantity)
  if (!Number.isFinite(numeric)) return null
  const divisor = servings > 0 ? servings : 1
  return (numeric / divisor) * people
}

function formatScaledNumber(value: number | null, unit: string | null): string | null {
  if (value === null) return null
  const rounded = Math.round(value * 100) / 100
  return [formatQuantity(String(rounded)), unit].filter(Boolean).join(" ")
}

/** Sums per-person scaled quantities across all contributions for `people` eaters. */
function itemAmount(item: ShoppingItem, people: PeopleCount) {
  let sum = 0
  let knownCount = 0
  let hasUnknown = item.hasUnknownQuantity
  for (const source of item.contributions) {
    const scaled = scaledContributionQuantity(source.quantity, source.servings, people)
    if (scaled === null) {
      hasUnknown = true
    } else {
      sum += scaled
      knownCount += 1
    }
  }
  const known = knownCount > 0 ? formatScaledNumber(sum, item.unit) : null
  if (!known) return item.unit ? `Chưa rõ lượng (${item.unit})` : "Chưa rõ lượng"
  return hasUnknown ? `${known} + phần chưa rõ lượng` : known
}

function listText(items: ShoppingItem[], people: PeopleCount, checked: ReadonlySet<string>) {
  return items
    .map((item) => {
      const key = `${item.ingredientId}:${item.unit ?? ""}`
      const prefix = checked.has(key) ? "[x]" : "[ ]"
      return `${prefix} ${item.name}: ${itemAmount(item, people)}`
    })
    .join("\n")
}

function dayNames(days: readonly Weekday[]) {
  return days.map((day) => DAY_LABELS[day]).join(", ")
}

export type ShoppingListHandle = {
  open: () => void
  close: () => void
  scroll: (direction: ScreenScrollDirection) => void
  screen: () => { open: boolean; scrollState?: VoiceScrollState }
}

/**
 * Header button of one saved week: the ingredients to buy for the chosen days,
 * in a side sheet. Supports scaling by multiplier, checking off bought items,
 * and Voice screen control.
 */
export function ShoppingListButton({
  weekStart,
  hasUnsavedChanges = false,
  plannedDays,
  editableDays,
  onOpenRecipe,
  handle,
}: {
  /** Monday of the week to shop for. Days before today are left out by the API. */
  weekStart: string
  hasUnsavedChanges?: boolean
  /** Days of the saved plan with at least one dish; unknown while it loads. */
  plannedDays?: readonly Weekday[]
  /** Days from today onward; days before today are past and skipped by the API. */
  editableDays?: readonly Weekday[]
  /** Opens a dish in the planner's RecipeSheet when provided. */
  onOpenRecipe?: (recipeId: string, title: string) => void
  /** Lets the voice agent open, close, and scroll the shopping list. */
  handle?: Ref<ShoppingListHandle>
}) {
  const [open, setOpen] = useState(false)
  const [days, setDays] = useState<Weekday[]>([...WEEKDAYS])
  const [people, setPeople] = useState<PeopleCount>(loadPeopleCount)
  const [checkedByWeek, setCheckedByWeek] = useState<{ weekStart: string; keys: string[] }>(() => ({
    weekStart,
    keys: loadCheckedKeys(weekStart),
  }))
  const [openRecipeId, setOpenRecipeId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const checkedKeys =
    checkedByWeek.weekStart === weekStart ? checkedByWeek.keys : loadCheckedKeys(weekStart)
  const checkedSet = new Set(checkedKeys)

  useImperativeHandle(handle, () => ({
    open() {
      setOpen(true)
    },
    close() {
      setOpen(false)
    },
    scroll(direction) {
      requestAnimationFrame(() => scrollContainer(scrollRef.current, direction))
    },
    screen() {
      return {
        open,
        scrollState: open ? readScrollState(scrollRef.current) : undefined,
      }
    },
  }))

  const wholeWeek = days.length === WEEKDAYS.length
  const allSelectedPast =
    editableDays !== undefined && days.every((day) => !editableDays.includes(day))
  // Nothing to fetch when every picked day is either past or known to be empty.
  const nothingPlanned =
    !allSelectedPast &&
    plannedDays !== undefined &&
    days.every((day) => {
      const isEditable = editableDays === undefined || editableDays.includes(day)
      return !isEditable || !plannedDays.includes(day)
    })

  const shouldFetch = open && !allSelectedPast && !nothingPlanned
  const list = useAuthedSWR(shouldFetch ? shoppingListKey(weekStart, days) : null, fetchShoppingList, {
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) router.refresh()
    },
  })
  const items = list.data?.items ?? []

  function toggleChecked(itemKey: string) {
    const next = checkedSet.has(itemKey)
      ? checkedKeys.filter((key) => key !== itemKey)
      : [...checkedKeys, itemKey]
    setCheckedByWeek({ weekStart, keys: next })
    saveCheckedKeys(weekStart, next)
  }

  function clearChecked() {
    setCheckedByWeek({ weekStart, keys: [] })
    saveCheckedKeys(weekStart, [])
  }

  /** One day at a time, like tabs; tapping the picked day again goes back to the whole week. */
  function pickDay(next: string[]) {
    const day = WEEKDAYS.find((weekday) => next.includes(weekday))
    setDays(day ? [day] : [...WEEKDAYS])
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(listText(items, people, checkedSet))
      toast.add({ title: "Đã sao chép danh sách mua sắm" })
    } catch {
      toast.add({ title: "Không sao chép được", description: "Trình duyệt chặn quyền sao chép." })
    }
  }

  function handleOpenRecipe(recipeId: string, title: string) {
    if (onOpenRecipe) {
      setOpen(false)
      onOpenRecipe(recipeId, title)
      return
    }
    setOpenRecipeId(recipeId)
  }

  let checkedCount = 0
  for (const item of items) {
    if (checkedSet.has(`${item.ingredientId}:${item.unit ?? ""}`)) checkedCount += 1
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" size="sm" />}>
        <ShoppingBasketIcon aria-hidden />
        Đi chợ
      </SheetTrigger>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg data-[side=right]:lg:max-w-xl">
        <SheetHeader>
          <SheetTitle>Danh sách mua sắm</SheetTitle>
          <SheetDescription>
            Tính từ các ngày từ hôm nay trở đi, tự động quy đổi lượng nguyên liệu theo {people} người ăn.
          </SheetDescription>
        </SheetHeader>

        <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-6">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
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
              <div className="flex items-center gap-1" role="group" aria-label="Số người ăn">
                <UsersIcon aria-hidden className="size-3.5 text-muted-foreground" />
                {PEOPLE_COUNTS.map((value) => (
                  <Button
                    key={value}
                    type="button"
                    variant={people === value ? "default" : "outline"}
                    size="xs"
                    aria-pressed={people === value}
                    onClick={() => {
                      setPeople(value)
                      savePeopleCount(value)
                    }}
                  >
                    {value} người
                  </Button>
                ))}
              </div>
            </div>
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
                const isPast = editableDays !== undefined && !editableDays.includes(day)
                const empty = !isPast && plannedDays !== undefined && !plannedDays.includes(day)
                const dimmed = isPast || empty
                let title: string | undefined
                let ariaLabel = DAY_LABELS[day]
                if (isPast) {
                  title = "Ngày đã qua"
                  ariaLabel = `${DAY_LABELS[day]}, đã qua`
                } else if (empty) {
                  title = "Chưa có thực đơn"
                  ariaLabel = `${DAY_LABELS[day]}, chưa có thực đơn`
                }
                return (
                  <ToggleGroupItem
                    key={day}
                    value={day}
                    aria-label={ariaLabel}
                    title={title}
                  >
                    <span className={cn(dimmed && "opacity-45")}>{SHORT_DAY_LABELS[day]}</span>
                  </ToggleGroupItem>
                )
              })}
            </ToggleGroup>
            {((plannedDays !== undefined && plannedDays.length < WEEKDAYS.length) ||
              (editableDays !== undefined && editableDays.length < WEEKDAYS.length)) && (
              <p className="text-xs text-muted-foreground">
                Ngày chữ mờ đã qua hoặc chưa có thực đơn.
              </p>
            )}
          </div>

          {hasUnsavedChanges && (
            <p role="note" className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
              Bản nháp hoặc đề xuất chưa lưu chưa được tính vào danh sách này.
            </p>
          )}

          {allSelectedPast ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CalendarXIcon aria-hidden />
                </EmptyMedia>
                <EmptyTitle>Ngày đã qua</EmptyTitle>
                <EmptyDescription>
                  {wholeWeek
                    ? "Tuần này đã qua hết nên không còn nguyên liệu cần đi chợ."
                    : `${dayNames(days)} đã qua nên không có danh sách đi chợ. Hãy chọn từ hôm nay trở đi.`}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : nothingPlanned ? (
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
                    ? "Các món trong thực đơn từ hôm nay trở đi chưa ghi nguyên liệu."
                    : `Các món ${dayNames(days)} chưa ghi nguyên liệu.`}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground tabular-nums">
                  {items.length} nguyên liệu
                  {checkedCount > 0 && ` · Đã mua ${checkedCount}/${items.length}`}
                </p>
                <div className="flex items-center gap-1">
                  {checkedCount > 0 && (
                    <Button type="button" variant="ghost" size="xs" onClick={clearChecked}>
                      Bỏ đánh dấu
                    </Button>
                  )}
                  <Button type="button" variant="ghost" size="sm" onClick={() => void copy()}>
                    <CopyIcon aria-hidden />
                    Sao chép
                  </Button>
                </div>
              </div>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {items.map((item) => {
                  const itemKey = `${item.ingredientId}:${item.unit ?? ""}`
                  return (
                    <ShoppingRow
                      key={itemKey}
                      item={item}
                      people={people}
                      checked={checkedSet.has(itemKey)}
                      onToggleChecked={() => toggleChecked(itemKey)}
                      onOpenRecipe={handleOpenRecipe}
                    />
                  )
                })}
              </ul>
            </>
          )}
        </div>
        {!onOpenRecipe && <RecipeDialog id={openRecipeId} onClose={() => setOpenRecipeId(null)} />}
      </SheetContent>
    </Sheet>
  )
}

/** "Thứ Ba, bữa trưa"; the "Khác" section is snacks and drinks, not a meal. */
function mealLabel(day: Weekday, section: ShoppingItem["contributions"][number]["section"]) {
  const meal = section === "OTHER" ? "món khác" : `bữa ${SECTION_LABELS[section].toLowerCase()}`
  return `${DAY_LABELS[day]}, ${meal}`
}

/** One ingredient, checkable and expandable into the dishes, days and meals it comes from. */
function ShoppingRow({
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
                    {formatted ?? (
                      <span className="text-muted-foreground">Chưa rõ lượng</span>
                    )}
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
