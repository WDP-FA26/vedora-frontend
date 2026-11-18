"use client"

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { weekRangeLabel, type MealPlan } from "@/features/meal-plan/meal-plan"

type WeekNavProps = {
  /** The week on screen; undefined while it loads. */
  plan: MealPlan | undefined
  /** The server has not answered for the week that was just picked. */
  loading: boolean
  onPrevious: () => void
  onNext: () => void
  onToday: () => void
}

/** Moves between weeks within the range the server allows; never decides that range itself. */
export function WeekNav({ plan, loading, onPrevious, onNext, onToday }: WeekNavProps) {
  const isCurrent = plan !== undefined && plan.weekStart === plan.currentWeekStart
  const canGoBack = plan !== undefined && plan.weekStart > plan.minWeekStart
  const canGoForward = plan !== undefined && plan.weekStart < plan.maxWeekStart

  return (
    <nav aria-label="Chọn tuần" className="flex w-full min-w-0 flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Tuần trước"
        disabled={!canGoBack}
        onClick={onPrevious}
      >
        <ChevronLeftIcon aria-hidden />
      </Button>
      <p className="min-w-0 text-sm font-semibold tabular-nums" aria-live="polite">
        {plan ? weekRangeLabel(plan) : "Đang tải tuần…"}
        {loading && <Spinner aria-label="Đang tải" className="ml-2 inline-block size-3.5 align-middle" />}
      </p>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Tuần sau"
        disabled={!canGoForward}
        onClick={onNext}
      >
        <ChevronRightIcon aria-hidden />
      </Button>
      {plan && !isCurrent && (
        <Button variant="ghost" size="sm" onClick={onToday}>
          Về tuần này
        </Button>
      )}
      {isCurrent && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Tuần này</span>}
    </nav>
  )
}
