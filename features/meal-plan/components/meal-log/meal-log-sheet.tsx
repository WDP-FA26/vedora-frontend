"use client"

import { useImperativeHandle, useRef, useState, type Ref } from "react"
import { useRouter } from "next/navigation"
import { NotebookPenIcon, RotateCcwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import { fetchMealLog, mealLogKey } from "@/features/meal-plan/api/meal-log.api"
import { MealLogDayView } from "@/features/meal-plan/components/meal-log/meal-log-day-view"
import {
  reviewPrompt,
  type CustomDishPrefill,
  type MealLogHandle,
} from "@/features/meal-plan/components/meal-log/meal-log-utils"
import { MealLogWeekSummary } from "@/features/meal-plan/components/meal-log/meal-log-week-summary"
import { readScrollState, scrollContainer } from "@/features/meal-plan/lib/scroll"
import type { MealLogWeek } from "@/features/meal-plan/schemas/meal-log.schema"
import type { MealPlan, Weekday } from "@/features/meal-plan/schemas/meal-plan.schema"
import { ApiError } from "@/features/shared/lib/api-client"

export type { CustomDishPrefill, MealLogHandle }

export function MealLogSheet({
  plan,
  onAskAssistant,
  handle,
}: {
  plan: MealPlan
  onAskAssistant?: (prompt: string) => void
  handle?: Ref<MealLogHandle>
}) {
  const [open, setOpen] = useState(false)
  const [pickedDay, setPickedDay] = useState<Weekday | null>(null)
  const [prefill, setPrefill] = useState<(CustomDishPrefill & { id: number }) | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const todayDay = plan.days.find((item) => item.date === plan.today)?.day
  const selectedDay: Weekday = pickedDay ?? todayDay ?? "SUN"

  useImperativeHandle(handle, () => ({
    openDay(date) {
      setPickedDay(plan.days.find((item) => item.date === date)?.day ?? null)
      setPrefill(null)
      setOpen(true)
    },
    openCustomDish(next) {
      if (next?.date) {
        setPickedDay(plan.days.find((item) => item.date === next.date)?.day ?? null)
      } else {
        setPickedDay(todayDay ?? null)
      }
      setPrefill({ name: next?.name ?? "", details: next?.details, date: next?.date, id: Date.now() })
      setOpen(true)
    },
    close() {
      setOpen(false)
    },
    scroll(direction) {
      requestAnimationFrame(() => scrollContainer(scrollRef.current, direction))
    },
    screen() {
      const date = plan.days.find((item) => item.day === selectedDay)?.date ?? null
      return {
        open,
        date,
        scrollState: open ? readScrollState(scrollRef.current) : undefined,
      }
    },
  }))

  const router = useRouter()
  const log = useAuthedSWR(open ? mealLogKey(plan.weekStart) : null, fetchMealLog, {
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) router.refresh()
    },
  })
  const day = log.data?.days.find((item) => item.day === selectedDay)

  function reviewWeek(week: MealLogWeek) {
    const prompt = reviewPrompt(week)
    if (!prompt) return
    setOpen(false)
    onAskAssistant?.(prompt)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" size="sm" />}>
        <NotebookPenIcon aria-hidden />
        Nhật ký
      </SheetTrigger>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg data-[side=right]:lg:max-w-xl">
        <SheetHeader>
          <SheetTitle>Nhật ký ăn uống</SheetTitle>
          <SheetDescription>
            Ghi lại món bạn đã thực sự ăn, kể cả món ngoài thực đơn. Kcal chỉ để tham khảo.
          </SheetDescription>
        </SheetHeader>

        <div ref={scrollRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-6">
          {log.isLoading && !log.data && (
            <div role="status" aria-label="Đang tải nhật ký" className="space-y-2">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          )}
          {log.error && !log.data && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span>Không tải được nhật ký.</span>
              <Button type="button" variant="outline" size="sm" onClick={() => void log.mutate()}>
                <RotateCcwIcon aria-hidden />
                Thử lại
              </Button>
            </div>
          )}
          {log.data && (
            <>
              <MealLogWeekSummary
                week={log.data}
                selectedDay={selectedDay}
                onPickDay={setPickedDay}
                onReview={onAskAssistant ? reviewWeek : undefined}
              />
              {day && (
                <MealLogDayView
                  key={`${day.date}-${prefill?.id ?? 0}`}
                  plan={plan}
                  day={day}
                  initialPrefill={prefill}
                  onClearPrefill={() => setPrefill(null)}
                  onChanged={async () => {
                    await log.mutate()
                  }}
                />
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
