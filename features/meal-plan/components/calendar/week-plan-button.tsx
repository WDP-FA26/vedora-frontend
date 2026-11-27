"use client"

import { useState } from "react"
import Link from "next/link"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
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
import { fetchMealPlan, MEAL_PLANNER_PATH, mealPlanKey } from "@/features/meal-plan/api/meal-plan.api"
import { Timetable } from "@/features/meal-plan/components/calendar/timetable"

export function WeekPlanButton() {
  const [open, setOpen] = useState(false)
  const plan = useAuthedSWR(open ? mealPlanKey() : null, fetchMealPlan)

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
          <SheetDescription>Thực đơn tuần này của bạn. Mở trang lên thực đơn để xem hoặc lên cho các tuần khác.</SheetDescription>
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
