"use client"

import { useImperativeHandle, useRef, useState, type Ref } from "react"
import { useRouter } from "next/navigation"
import {
  CalendarXIcon,
  CopyIcon,
  RotateCcwIcon,
  ShoppingBasketIcon,
  UsersIcon,
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
import { fetchShoppingList, shoppingListKey } from "@/features/meal-plan/api/shopping-list.api"
import { ShoppingListRow } from "@/features/meal-plan/components/shopping-list/shopping-list-row"
import { DAY_LABELS, DAY_SHORT } from "@/features/meal-plan/lib/dates"
import {
  readScrollState,
  scrollContainer,
  type ScreenScrollDirection,
  type VoiceScrollState,
} from "@/features/meal-plan/lib/scroll"
import {
  dayNames,
  listText,
  loadCheckedKeys,
  loadPeopleCount,
  matchesAnyQuery,
  PEOPLE_COUNTS,
  saveCheckedKeys,
  savePeopleCount,
  type PeopleCount,
} from "@/features/meal-plan/lib/shopping-list-utils"
import { WEEKDAYS, type Weekday } from "@/features/meal-plan/schemas/meal-plan.schema"
import type { ShoppingItem } from "@/features/meal-plan/schemas/shopping-list.schema"
import { RecipeDialog } from "@/features/recipes/components/recipe-card"
import { ApiError } from "@/features/shared/lib/api-client"

export type ShoppingListOpenOptions = {
  day?: Weekday | null
  wholeWeek?: boolean
  people?: number | null
  checkItems?: string[] | null
  uncheckItems?: string[] | null
  clearChecked?: boolean
}

export type ShoppingListHandle = {
  open: (options?: ShoppingListOpenOptions) => void
  close: () => void
  scroll: (direction: ScreenScrollDirection) => void
  screen: () => {
    open: boolean
    days: Weekday[]
    people: PeopleCount
    checkedCount: number
    scrollState?: VoiceScrollState
  }
}

export function ShoppingListSheet({
  weekStart,
  hasUnsavedChanges = false,
  plannedDays,
  editableDays,
  onOpenRecipe,
  handle,
}: {
  weekStart: string
  hasUnsavedChanges?: boolean
  plannedDays?: readonly Weekday[]
  editableDays?: readonly Weekday[]
  onOpenRecipe?: (recipeId: string, title: string) => void
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
  const pendingCheckOpRef = useRef<{
    checkItems?: string[]
    uncheckItems?: string[]
  } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const checkedKeys =
    checkedByWeek.weekStart === weekStart ? checkedByWeek.keys : loadCheckedKeys(weekStart)
  const checkedSet = new Set(checkedKeys)

  function applyCheckMutation(
    currentKeys: readonly string[],
    targetItems: readonly ShoppingItem[],
    checkItems?: readonly string[],
    uncheckItems?: readonly string[]
  ) {
    const next = new Set(currentKeys)
    for (const item of targetItems) {
      const key = `${item.ingredientId}:${item.unit ?? ""}`
      if (checkItems && checkItems.length > 0 && matchesAnyQuery(item.name, checkItems)) {
        next.add(key)
      }
      if (uncheckItems && uncheckItems.length > 0 && matchesAnyQuery(item.name, uncheckItems)) {
        next.delete(key)
      }
    }
    const nextArray = [...next]
    setCheckedByWeek({ weekStart, keys: nextArray })
    saveCheckedKeys(weekStart, nextArray)
  }

  const wholeWeek = days.length === WEEKDAYS.length
  const allSelectedPast =
    editableDays !== undefined && days.every((day) => !editableDays.includes(day))
  const nothingPlanned =
    !allSelectedPast &&
    plannedDays !== undefined &&
    days.every((day) => {
      const isEditable = editableDays === undefined || editableDays.includes(day)
      return !isEditable || !plannedDays.includes(day)
    })

  const shouldFetch = open && !allSelectedPast && !nothingPlanned
  const list = useAuthedSWR(shouldFetch ? shoppingListKey(weekStart, days) : null, fetchShoppingList, {
    onSuccess: (data) => {
      const pending = pendingCheckOpRef.current
      if (!pending || data.items.length === 0) return
      pendingCheckOpRef.current = null
      const current = loadCheckedKeys(weekStart)
      applyCheckMutation(current, data.items, pending.checkItems, pending.uncheckItems)
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) router.refresh()
    },
  })
  const items = list.data?.items ?? []

  let checkedCount = 0
  for (const item of items) {
    if (checkedSet.has(`${item.ingredientId}:${item.unit ?? ""}`)) checkedCount += 1
  }

  useImperativeHandle(handle, () => ({
    open(options) {
      if (options?.day) {
        setDays([options.day])
      } else if (options?.wholeWeek) {
        setDays([...WEEKDAYS])
      }
      if (options?.people !== undefined && options.people !== null) {
        const matched = PEOPLE_COUNTS.find((count) => count === options.people)
        if (matched) {
          setPeople(matched)
          savePeopleCount(matched)
        }
      }
      if (options?.clearChecked) {
        setCheckedByWeek({ weekStart, keys: [] })
        saveCheckedKeys(weekStart, [])
      }
      const hasCheck = Boolean(options?.checkItems && options.checkItems.length > 0)
      const hasUncheck = Boolean(options?.uncheckItems && options.uncheckItems.length > 0)
      if (hasCheck || hasUncheck) {
        const baseKeys = options?.clearChecked ? [] : checkedKeys
        if (items.length > 0) {
          applyCheckMutation(
            baseKeys,
            items,
            options?.checkItems ?? undefined,
            options?.uncheckItems ?? undefined
          )
        } else {
          pendingCheckOpRef.current = {
            checkItems: options?.checkItems ?? undefined,
            uncheckItems: options?.uncheckItems ?? undefined,
          }
        }
      }
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
        days,
        people,
        checkedCount,
        scrollState: open ? readScrollState(scrollRef.current) : undefined,
      }
    },
  }))

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
                  <ToggleGroupItem key={day} value={day} aria-label={ariaLabel} title={title}>
                    <span className={cn(dimmed && "opacity-45")}>{DAY_SHORT[day]}</span>
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
                    <ShoppingListRow
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
