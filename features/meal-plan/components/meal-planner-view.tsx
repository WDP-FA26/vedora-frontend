"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { CalendarDaysIcon, SparklesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { isAccessTokenFresh } from "@/features/auth/lib/tokens"
import { ApiError } from "@/features/shared/lib/api-client"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { PlannerChat } from "@/features/meal-plan/components/planner-chat"
import { Timetable } from "@/features/meal-plan/components/timetable"
import { useMealPlannerChat } from "@/features/meal-plan/hooks/use-meal-planner-chat"
import {
  fetchMealPlan,
  MEAL_PLAN_KEY,
  saveMealDays,
  DAY_LABELS,
  SECTION_LABELS,
  type MealDayInput,
  type MealSection,
  type Weekday,
} from "@/features/meal-plan/meal-plan"

const TOKEN_CHECK_MS = 20_000

type Tab = "plan" | "chat"

/** The weekly timetable and the assistant that proposes changes to it. */
export function MealPlannerView() {
  const { accessToken } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("plan")
  const chat = useMealPlannerChat()
  const plan = useSWR(
    accessToken ? ([MEAL_PLAN_KEY, accessToken] as const) : null,
    fetchMealPlan
  )

  // The layout's token outlives its expiry while this page sits open in a long
  // conversation; a refresh lets the proxy rotate it before the next request.
  useEffect(() => {
    const timer = setInterval(() => {
      if (!isAccessTokenFresh(accessToken)) router.refresh()
    }, TOKEN_CHECK_MS)
    return () => clearInterval(timer)
  }, [accessToken, router])

  async function apply(days: MealDayInput[]) {
    if (!accessToken) return
    try {
      const saved = await saveMealDays(accessToken, days)
      await plan.mutate(saved, { revalidate: false })
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) router.refresh()
      throw error
    }
  }

  function replace(day: Weekday, section: MealSection, title: string) {
    setTab("chat")
    chat.send(
      `Đổi món "${title}" ở ${DAY_LABELS[day]}, phần ${SECTION_LABELS[section].toLowerCase()} sang một món khác.`
    )
  }

  return (
    <section aria-labelledby="meal-planner-title">
      <Tabs value={tab} onValueChange={(next) => setTab(next as Tab)}>
        <div className="lg:flex">
          <div className="min-w-0 flex-1">
            <header className="sticky top-0 z-20 flex flex-col gap-2 border-b border-border bg-card/85 px-4 py-2 backdrop-blur-md sm:px-5">
              <h1 id="meal-planner-title" className="text-lg font-bold">
                Lên thực đơn
              </h1>
              {/* from lg up both panels show side by side */}
              <div className="lg:hidden">
                <TabsList>
                  <TabsTrigger value="plan">
                    <CalendarDaysIcon aria-hidden />
                    Thực đơn tuần
                  </TabsTrigger>
                  <TabsTrigger value="chat">
                    <SparklesIcon aria-hidden />
                    Trợ lý Vedora
                  </TabsTrigger>
                </TabsList>
              </div>
            </header>
            <div className={cn(tab !== "chat" && "hidden lg:block")}>
              <PlannerChat chat={chat} apply={apply} openPlan={() => setTab("plan")} />
            </div>
          </div>

          <div
            className={cn(
              "lg:sticky lg:top-0 lg:h-dvh lg:w-[26rem] lg:flex-none lg:overflow-y-auto lg:border-l lg:border-border lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden",
              tab !== "plan" && "hidden lg:block"
            )}
          >
            <h2 className="hidden border-b border-border px-5 py-2 text-lg font-bold lg:block">
              Thực đơn tuần
            </h2>
            <Timetable
              plan={plan.data}
              failed={Boolean(plan.error)}
              replace={replace}
              busy={chat.busy}
              action={
                <span className="lg:hidden">
                  <Button variant="outline" size="sm" onClick={() => setTab("chat")}>
                    <SparklesIcon aria-hidden />
                    Mở trợ lý
                  </Button>
                </span>
              }
            />
          </div>
        </div>
      </Tabs>
    </section>
  )
}
