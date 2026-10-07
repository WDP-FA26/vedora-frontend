"use client"

import { useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { CalendarDaysIcon, SparklesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { Timetable } from "@/features/meal-plan/components/timetable"
import {
  fetchMealPlan,
  MEAL_PLAN_KEY,
  MEAL_PLANNER_PATH,
} from "@/features/meal-plan/meal-plan"

/** Header button that shows the saved week in a side sheet, from any page. */
export function WeekPlanButton() {
  const { accessToken } = useAuth()
  const [open, setOpen] = useState(false)
  const plan = useSWR(
    open && accessToken ? ([MEAL_PLAN_KEY, accessToken] as const) : null,
    fetchMealPlan
  )

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon-lg" shape="pill" />}
        aria-label="Xem thực đơn tuần"
        title="Thực đơn tuần"
      >
        <CalendarDaysIcon aria-hidden className="size-5" />
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Thực đơn tuần</SheetTitle>
          <SheetDescription>Thực đơn bạn đang lưu, lặp lại mỗi tuần.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Timetable
            plan={plan.data}
            failed={Boolean(plan.error)}
            action={
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={MEAL_PLANNER_PATH} onClick={() => setOpen(false)} />}
              >
                <SparklesIcon aria-hidden />
                Chỉnh với trợ lý
              </Button>
            }
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
