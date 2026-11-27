"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSWRConfig } from "swr"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import Link from "next/link"
import { ArrowLeftIcon, AudioLinesIcon, CalendarRangeIcon, PanelLeftCloseIcon, SparklesIcon } from "lucide-react"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/components/ui/toast"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { isAccessTokenFresh } from "@/features/auth/lib/tokens"
import {
  fetchMyDietary,
  fetchMyNutrition,
  MY_DIETARY_KEY,
  MY_NUTRITION_KEY,
} from "@/features/dietary/dietary"
import {
  createMealLogEntry,
  deleteMealLogEntry,
  fetchMealLog,
  isMealLogKey,
  mealLogKey,
} from "@/features/meal-plan/api/meal-log.api"
import {
  fetchMealPlan,
  isMealPlanKey,
  mealPlanKey,
  saveMealDays,
} from "@/features/meal-plan/api/meal-plan.api"
import { CalendarBoard, type CalendarBoardHandle } from "@/features/meal-plan/components/calendar/calendar-board"
import { RecipeSheet, type OpenedDish, type RecipeSheetHandle } from "@/features/meal-plan/components/calendar/recipe-sheet"
import { PlannerChat, type PlannerChatHandle } from "@/features/meal-plan/components/chat/planner-chat"
import { MealLogSheet, type MealLogHandle } from "@/features/meal-plan/components/meal-log/meal-log-sheet"
import { MealPlannerOnboardingGate } from "@/features/meal-plan/components/onboarding-gate"
import { ShoppingListSheet, type ShoppingListHandle } from "@/features/meal-plan/components/shopping-list/shopping-list-sheet"
import { VoicePanel } from "@/features/meal-plan/components/voice/voice-panel"
import { VoiceScreenGlow } from "@/features/meal-plan/components/voice/voice-screen-glow"
import { WeekNav } from "@/features/meal-plan/components/week-nav"
import { useMealPlannerChat } from "@/features/meal-plan/hooks/use-meal-planner-chat"
import {
  DAY_LABELS,
  editableDaysOf,
  SECTION_LABELS,
  shiftWeek,
} from "@/features/meal-plan/lib/dates"
import { inputsForChanges, planAfterChanges } from "@/features/meal-plan/lib/plan-mutations"
import { problemText } from "@/features/meal-plan/lib/problems"
import { readScrollState, scrollContainer } from "@/features/meal-plan/lib/scroll"
import {
  problemSchema,
  type MealPlan,
  type MealSection,
  type SlotChange,
  type SlotRef,
  type Weekday,
} from "@/features/meal-plan/schemas/meal-plan.schema"
import { preloadDeepFilterAssets } from "@/features/meal-plan/voice/voice-deepfilter"
import type { VoiceOpenRecipe } from "@/features/meal-plan/voice/voice-session"
import {
  VOICE_GLOW_MS,
  type VoiceScreen,
  type VoiceScreenCommand,
  type VoiceScreenPanel,
} from "@/features/meal-plan/voice/voice-stream"
import { ApiError } from "@/features/shared/lib/api-client"
import { cn } from "@/lib/utils"

const TOKEN_CHECK_MS = 20_000
const HOME_PATH = "/home"
const WEEK_PARAM = "week"
const WEEK_PATTERN = /^\d{4}-\d{2}-\d{2}$/
type Tab = "chat" | "calendar"
type AskContext = { title: string; day: Weekday; section: MealSection }

function mondayOfDate(isoDate: string): string | null {
  if (!WEEK_PATTERN.test(isoDate)) return null
  const [year, month, day] = isoDate.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  const offset = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - offset)
  return date.toISOString().slice(0, 10)
}

function calendarErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return "Không lưu được thay đổi. Hãy thử lại."
  const problems = z.array(problemSchema).safeParse(error.details?.problems)
  if (error.status === 409 && problems.success && problems.data.length > 0) {
    return problems.data.map(problemText).join(" ")
  }
  if (error.status === 409 && error.code === "MEAL_DAY_LOCKED") return "Ngày đã qua nên không thể thay đổi."
  if (error.status === 409 && error.code === "MEAL_WEEK_OUT_OF_RANGE") return "Chưa thể lên thực đơn cho tuần xa như vậy."
  if (error.status === 409) return "Thực đơn đã thay đổi ở nơi khác. Hãy tải lại trang rồi thử lại."
  return "Không lưu được thay đổi. Hãy thử lại."
}

export function MealPlannerView() {
  const { user, accessToken } = useAuth()
  const { mutate: swrMutate } = useSWRConfig()
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedWeek = searchParams.get(WEEK_PARAM)
  const weekParam = requestedWeek !== null && WEEK_PATTERN.test(requestedWeek) ? requestedWeek : undefined
  const isPageSession = user?.accountType === "PAGE"
  const canLoadDietary = user !== null && user.accountType === "PERSONAL"
  const plan = useAuthedSWR(canLoadDietary ? mealPlanKey(weekParam) : null, fetchMealPlan)
  const weekStart = plan.data?.weekStart
  const weekLog = useAuthedSWR(canLoadDietary && weekStart ? mealLogKey(weekStart) : null, fetchMealLog)
  const chat = useMealPlannerChat(weekStart)
  const plannerChat = useRef<PlannerChatHandle>(null)
  const [tab, setTab] = useState<Tab>("chat")
  const [assistantOpen, setAssistantOpen] = useState(true)
  const [eatingBusyKey, setEatingBusyKey] = useState<string | null>(null)
  const calendar = useRef<CalendarBoardHandle>(null)
  const mealLog = useRef<MealLogHandle>(null)
  const shoppingList = useRef<ShoppingListHandle>(null)
  const voiceRecipeSheet = useRef<RecipeSheetHandle>(null)
  const calendarScrollRef = useRef<HTMLDivElement>(null)
  const [voiceDay, setVoiceDay] = useState<{ weekStart: string; day: Weekday } | null>(null)
  const pendingVoiceCommandRef = useRef<{
    targetWeek: string
    command: VoiceScreenCommand
  } | null>(null)
  const showVoiceScreenRef = useRef<(command: VoiceScreenCommand) => void>(() => undefined)
  const [voiceDish, setVoiceDish] = useState<OpenedDish | null>(null)
  const [voiceDishOpen, setVoiceDishOpen] = useState(false)
  const [calendarRecipe, setCalendarRecipe] = useState<VoiceOpenRecipe | null>(null)
  const [voiceSheetRecipe, setVoiceSheetRecipe] = useState<VoiceOpenRecipe | null>(null)
  const openRecipe = voiceDishOpen ? voiceSheetRecipe : calendarRecipe
  const [lastVoiceFocusAt, setLastVoiceFocusAt] = useState<number | null>(null)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [askContext, setAskContext] = useState<AskContext | null>(null)
  const restrictions = useAuthedSWR(canLoadDietary ? MY_DIETARY_KEY : null, fetchMyDietary)
  const nutrition = useAuthedSWR(canLoadDietary ? MY_NUTRITION_KEY : null, fetchMyNutrition)
  const savedAvoided = restrictions.data?.allergies ?? []

  useEffect(() => {
    preloadDeepFilterAssets()
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      if (!isAccessTokenFresh(accessToken)) router.refresh()
    }, TOKEN_CHECK_MS)
    return () => clearInterval(timer)
  }, [accessToken, router])

  useEffect(() => {
    if (lastVoiceFocusAt === null) return
    const timer = setTimeout(() => setLastVoiceFocusAt(null), VOICE_GLOW_MS)
    return () => clearTimeout(timer)
  }, [lastVoiceFocusAt])

  const weekRefused =
    plan.error instanceof ApiError && (plan.error.status === 400 || plan.error.status === 409)
  useEffect(() => {
    if (weekRefused && weekParam) window.history.replaceState(null, "", window.location.pathname)
  }, [weekRefused, weekParam])

  useEffect(() => {
    const pending = pendingVoiceCommandRef.current
    if (!pending || weekStart !== pending.targetWeek) return
    pendingVoiceCommandRef.current = null
    const frame = requestAnimationFrame(() => showVoiceScreenRef.current(pending.command))
    return () => cancelAnimationFrame(frame)
  }, [weekStart])

  function writeWeek(next: string | undefined) {
    const params = new URLSearchParams(searchParams.toString())
    if (next) params.set(WEEK_PARAM, next)
    else params.delete(WEEK_PARAM)
    const query = params.toString()
    window.history.pushState(null, "", query ? `?${query}` : window.location.pathname)
  }

  function showWeek(next: string) {
    if (next !== weekStart) {
      writeWeek(next === plan.data?.currentWeekStart ? undefined : next)
    }
    setTab("calendar")
  }

  function voiceScreen(): VoiceScreen | null {
    if (!weekStart) return null
    const board = calendar.current?.screen()
    const diary = mealLog.current?.screen()
    const shop = shoppingList.current?.screen()
    const screen: VoiceScreen = { weekStart, day: board?.day, panel: "none" }
    if (voiceDishOpen && voiceDish) {
      return {
        ...screen,
        panel: "recipe",
        recipeId: voiceDish.recipeId,
        recipeSection: voiceDish.voice?.section ?? undefined,
        recipeStep: voiceDish.voice?.step ?? undefined,
        scrollState: voiceRecipeSheet.current?.scrollState(),
      }
    }
    if (board?.recipe) {
      return {
        ...screen,
        panel: "recipe",
        recipeId: board.recipe.id,
        recipeDay: board.recipe.day,
        recipeMealSection: board.recipe.mealSection,
        recipeEaten: board.recipe.eaten,
        recipeSection: board.recipe.section ?? undefined,
        recipeStep: board.recipe.step ?? undefined,
        scrollState: board.recipe.scrollState,
      }
    }
    if (shop?.open) {
      return {
        ...screen,
        panel: "shoppingList",
        shoppingDays: shop.days,
        shoppingPeople: shop.people,
        shoppingCheckedCount: shop.checkedCount,
        scrollState: shop.scrollState,
      }
    }
    if (diary?.open) {
      return {
        ...screen,
        panel: "eatingLog",
        eatingLogDate: diary.date ?? undefined,
        scrollState: diary.scrollState,
      }
    }
    if (board?.bodyMetricsOpen) {
      return {
        ...screen,
        panel: "bodyMetrics",
        bodyMetricsTab: board.bodyMetricsTab,
        scrollState: board.bodyMetricsScrollState,
      }
    }
    const desktopScroll =
      calendarScrollRef.current && calendarScrollRef.current.offsetParent !== null
        ? readScrollState(calendarScrollRef.current)
        : undefined
    return { ...screen, scrollState: board?.mobileScrollState ?? desktopScroll }
  }

  function closeVoicePanels(panel: VoiceScreenPanel, keep?: VoiceScreenPanel) {
    const closes = (name: VoiceScreenPanel) => name !== keep && (panel === "all" || panel === name)
    if (closes("recipe")) {
      setVoiceDishOpen(false)
      calendar.current?.closeDish()
    }
    if (closes("eatingLog")) mealLog.current?.close()
    if (closes("bodyMetrics")) calendar.current?.hideBodyMetrics()
    if (closes("shoppingList")) shoppingList.current?.close()
  }

  function showVoiceScreen({ focus, close, scroll }: VoiceScreenCommand) {
    setLastVoiceFocusAt(Date.now())
    if (close) closeVoicePanels(close)
    if (!focus) {
      if (scroll) {
        scrollContainer(calendarScrollRef.current, scroll)
        calendar.current?.scrollMobileBoard(scroll)
      }
      return
    }
    if (focus.kind === "eatingLog") {
      const targetWeek =
        focus.date !== null
          ? mondayOfDate(focus.date)
          : plan.data?.currentWeekStart ?? null
      if (targetWeek && weekStart && targetWeek !== weekStart) {
        closeVoicePanels("all")
        pendingVoiceCommandRef.current = { targetWeek, command: { focus, close, scroll } }
        showWeek(targetWeek)
        return
      }
      closeVoicePanels("all", "eatingLog")
      setTab("calendar")
      mealLog.current?.openDay(focus.date)
      if (scroll) mealLog.current?.scroll(scroll)
      return
    }
    if (focus.kind === "bodyMetrics") {
      if (focus.weekStart && weekStart && focus.weekStart !== weekStart) {
        closeVoicePanels("all")
        pendingVoiceCommandRef.current = { targetWeek: focus.weekStart, command: { focus, close, scroll } }
        showWeek(focus.weekStart)
        return
      }
      closeVoicePanels("all", "bodyMetrics")
      setTab("calendar")
      calendar.current?.showBodyMetrics(focus.tab ?? undefined)
      if (scroll) calendar.current?.scrollBodyMetrics(scroll)
      return
    }
    if (focus.kind === "shoppingList") {
      if (focus.weekStart && weekStart && focus.weekStart !== weekStart) {
        closeVoicePanels("all")
        pendingVoiceCommandRef.current = { targetWeek: focus.weekStart, command: { focus, close, scroll } }
        showWeek(focus.weekStart)
        return
      }
      closeVoicePanels("all", "shoppingList")
      setTab("calendar")
      shoppingList.current?.open({
        day: focus.day,
        wholeWeek: focus.wholeWeek,
        people: focus.people,
        checkItems: focus.checkItems,
        uncheckItems: focus.uncheckItems,
        clearChecked: focus.clearChecked,
        expandItems: focus.expandItems,
        collapseItems: focus.collapseItems,
      })
      if (scroll) shoppingList.current?.scroll(scroll)
      return
    }
    if (focus.kind === "planDay") {
      closeVoicePanels("all")
      if (focus.weekStart === weekStart) {
        setTab("calendar")
        if (focus.day) calendar.current?.showDay(focus.day)
        if (scroll) {
          requestAnimationFrame(() => {
            scrollContainer(calendarScrollRef.current, scroll)
            calendar.current?.scrollMobileBoard(scroll)
          })
        }
        return
      }
      if (focus.day) setVoiceDay({ weekStart: focus.weekStart, day: focus.day })
      showWeek(focus.weekStart)
      return
    }
    const planned = plan.data?.days.find((day) =>
      day.sections.some(({ recipes }) => recipes.some(({ id }) => id === focus.recipeId))
    )
    closeVoicePanels("all", "recipe")
    const voice = {
      section: focus.section,
      step: focus.step ?? null,
      scroll: scroll ?? null,
      requestedAt: Date.now(),
    }
    if (planned) {
      setVoiceDishOpen(false)
      setTab("calendar")
      calendar.current?.openDish(planned.day, focus.recipeId, focus.section, focus.step ?? null, scroll ?? null)
      return
    }
    calendar.current?.closeDish()
    setTab("calendar")
    setVoiceDish({ recipeId: focus.recipeId, title: focus.title, voice })
    setVoiceDishOpen(true)
  }

  useEffect(() => {
    showVoiceScreenRef.current = showVoiceScreen
  })

  function askAssistant(prompt: string) {
    setAssistantOpen(true)
    setTab("chat")
    plannerChat.current?.ask(prompt)
  }

  async function changeCalendar(changes: SlotChange[]) {
    const current = plan.data
    if (!accessToken || !current) return
    try {
      await plan.mutate(saveMealDays(accessToken, current.weekStart, inputsForChanges(current, changes)), {
        optimisticData: planAfterChanges(current, changes) ?? undefined,
        rollbackOnError: true,
        populateCache: true,
        revalidate: false,
      })
      void swrMutate(isMealPlanKey)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) router.refresh()
      if (error instanceof ApiError && error.code === "MEAL_DAY_LOCKED") void plan.mutate()
      throw new Error(calendarErrorMessage(error))
    }
  }

  async function toggleEaten(
    day: Weekday,
    date: string,
    section: MealSection,
    recipeId: string,
    existingEntryId?: string
  ) {
    if (!accessToken) return
    const key = `${day}:${section}:${recipeId}`
    setEatingBusyKey(key)
    const currentLog = weekLog.data
    const optimisticLog = currentLog
      ? {
          ...currentLog,
          days: currentLog.days.map((logDay) => {
            if (logDay.day !== day) return logDay
            if (existingEntryId) {
              return {
                ...logDay,
                entries: logDay.entries.filter((entry) => entry.id !== existingEntryId),
              }
            }
            const plannedDish = plan.data?.days
              .find((item) => item.day === day)
              ?.sections.find((sec) => sec.section === section)
              ?.recipes.find((recipe) => recipe.id === recipeId)
            return {
              ...logDay,
              entries: [
                ...logDay.entries,
                {
                  id: `optimistic-${key}`,
                  date,
                  section,
                  source: "PLAN" as const,
                  recipeId,
                  name: plannedDish?.title ?? "",
                  servings: 1,
                  caloriesPerServing: plannedDish?.caloriesPerServing ?? null,
                  calories: plannedDish?.caloriesPerServing ?? null,
                  calorieSource: plannedDish?.caloriesPerServing != null ? ("RECIPE" as const) : null,
                  calorieNote: null,
                  calorieReferences: [],
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          }),
        }
      : undefined
    try {
      await weekLog.mutate(
        async () => {
          if (existingEntryId) {
            await deleteMealLogEntry(accessToken, existingEntryId)
          } else {
            await createMealLogEntry(accessToken, { date, section, recipeId })
          }
          if (!weekStart) return currentLog
          return fetchMealLog([mealLogKey(weekStart), accessToken])
        },
        {
          optimisticData: optimisticLog,
          rollbackOnError: true,
          revalidate: false,
        }
      )
      void swrMutate(isMealLogKey)
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) router.refresh()
      toast.add({
        title: caught instanceof ApiError ? caught.message : "Chưa cập nhật được nhật ký ăn uống.",
      })
    } finally {
      setEatingBusyKey(null)
    }
  }

  function suggestForSlot({ day, section }: SlotRef) {
    askAssistant(
      `Gợi ý giúp mình vài món cho bữa ${SECTION_LABELS[section].toLowerCase()} ${DAY_LABELS[day]} nhé.`
    )
  }

  function askAboutRecipe(recipe: { title: string }, day: Weekday, section: MealSection) {
    setAskContext({ title: recipe.title, day, section })
    setAssistantOpen(true)
    setTab("chat")
  }

  function startVoice() {
    setAssistantOpen(true)
    setTab("chat")
    if (weekStart) setVoiceOpen(true)
  }

  const voicePillButton = (className?: string) =>
    voiceOpen ? (
      <Button
        type="button"
        variant="secondary"
        size="pill-sm"
        shape="pill"
        aria-label="Mở màn hình trò chuyện giọng nói"
        onClick={() => {
          setAssistantOpen(true)
          setTab("chat")
        }}
        className={cn("shrink-0", className)}
      >
        <span className="size-2 rounded-full bg-primary animate-pulse motion-reduce:animate-none" aria-hidden />
        <span>Đang nói</span>
      </Button>
    ) : (
      <Button
        type="button"
        variant="default"
        size="pill-sm"
        shape="pill"
        aria-label="Trò chuyện bằng giọng nói"
        title="Trò chuyện bằng giọng nói"
        disabled={!weekStart}
        onClick={startVoice}
        className={cn("shrink-0", className)}
      >
        <AudioLinesIcon aria-hidden />
        <span>Nói</span>
      </Button>
    )

  const hideAssistantButton = (
    <Button
      variant="ghost"
      size="icon"
      className="hidden lg:inline-flex"
      aria-label="Ẩn trợ lý"
      onClick={() => setAssistantOpen(false)}
    >
      <PanelLeftCloseIcon aria-hidden />
    </Button>
  )

  const backButton = (size: "icon" | "icon-sm") => (
    <Button
      variant="ghost"
      size={size}
      nativeButton={false}
      render={<Link href={HOME_PATH} aria-label="Quay lại trang chủ" />}
    >
      <ArrowLeftIcon aria-hidden />
    </Button>
  )

  if (isPageSession) {
    return (
      <section aria-labelledby="meal-planner-title" className="flex min-h-dvh flex-col">
        <header className="flex items-center gap-2 border-b border-border bg-card px-3 py-2.5">
          {backButton("icon")}
          <h1 id="meal-planner-title" className="text-base font-bold">Lên thực đơn</h1>
        </header>
        <p className="p-4 text-sm text-muted-foreground sm:px-5">
          Trang nhà hàng không có hồ sơ ăn uống hay thực đơn cá nhân.{" "}
          {user.actor
            ? `Chuyển về tài khoản @${user.actor.username} trong menu tài khoản để sử dụng Trợ lý Vedora.`
            : "Hãy chuyển về tài khoản cá nhân để sử dụng Trợ lý Vedora."}
        </p>
      </section>
    )
  }

  const hasNutritionProfile =
    nutrition.data !== undefined &&
    nutrition.data.heightCm !== null &&
    nutrition.data.weightKg !== null &&
    nutrition.data.birthYear !== null &&
    nutrition.data.biologicalSex !== null &&
    nutrition.data.activityLevel !== null

  if (!nutrition.data || !restrictions.data) {
    if (nutrition.error || restrictions.error) {
      return (
        <section aria-labelledby="meal-planner-title" className="flex min-h-dvh flex-col">
          <header className="flex items-center gap-2 border-b border-border bg-card px-3 py-2.5">
            {backButton("icon")}
            <h1 id="meal-planner-title" className="text-base font-bold">Lên thực đơn</h1>
          </header>
          <div className="mx-auto my-auto flex max-w-md flex-col items-center gap-3 p-6 text-center">
            <p role="alert" className="text-sm text-destructive">
              Chưa tải được hồ sơ ăn uống của bạn. Vui lòng thử lại.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                void nutrition.mutate()
                void restrictions.mutate()
              }}
            >
              Thử lại
            </Button>
          </div>
        </section>
      )
    }

    return (
      <section aria-labelledby="meal-planner-title" className="flex min-h-dvh flex-col">
        <h1 id="meal-planner-title" className="sr-only">Lên thực đơn</h1>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <Spinner aria-label="Đang tải hồ sơ ăn uống" />
          <p className="text-sm text-muted-foreground">Đang chuẩn bị trợ lý lên thực đơn…</p>
        </div>
      </section>
    )
  }

  if (!hasNutritionProfile) {
    return (
      <MealPlannerOnboardingGate
        backButton={backButton("icon")}
        initialNutrition={nutrition.data}
        initialRestrictions={restrictions.data}
        onCompleted={async (savedNutrition, savedDietary) => {
          await Promise.all([
            nutrition.mutate(savedNutrition, { revalidate: false }),
            restrictions.mutate(savedDietary, { revalidate: false }),
          ])
        }}
      />
    )
  }

  return (
    <section aria-labelledby="meal-planner-title" className="flex min-h-dvh min-w-0 flex-col lg:h-dvh lg:overflow-hidden">
      <h1 id="meal-planner-title" className="sr-only">Lên thực đơn</h1>
      <Tabs value={tab} onValueChange={(next) => setTab(next as Tab)} className="min-w-0 lg:min-h-0 lg:flex-1">
        <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-card/95 px-3 py-3 backdrop-blur-md lg:hidden">
          {backButton("icon")}
          <TabsList className="grid min-w-0 flex-1 grid-cols-2" aria-label="Lên thực đơn">
            <TabsTrigger value="chat" className="min-w-0">
              <SparklesIcon aria-hidden /> Trợ lý
            </TabsTrigger>
            <TabsTrigger value="calendar" className="min-w-0">
              <CalendarRangeIcon aria-hidden /> Lịch
            </TabsTrigger>
          </TabsList>
          {tab === "calendar" && voicePillButton()}
        </div>

        <div
          className={cn(
            "min-w-0 lg:grid lg:min-h-0 lg:flex-1 lg:transition-[grid-template-columns] lg:duration-300 lg:ease-in-out motion-reduce:lg:transition-none",
            assistantOpen ? "lg:grid-cols-[24rem_minmax(0,1fr)]" : "lg:grid-cols-[0rem_minmax(0,1fr)]"
          )}
        >
          <div className={cn("min-w-0 lg:min-h-0 lg:overflow-hidden", tab !== "chat" && "hidden lg:block")}>
            <div
              className={cn(
                "lg:h-full lg:w-[24rem] lg:border-r lg:border-border lg:transition-[opacity,visibility] lg:duration-300 motion-reduce:lg:transition-none",
                !assistantOpen && "lg:invisible lg:opacity-0"
              )}
            >
            {voiceOpen ? (
              <VoicePanel
                weekStart={weekStart}
                today={plan.data?.today}
                threadId={chat.threadId}
                onScreen={showVoiceScreen}
                onTurnEnd={(threadId) => void chat.selectThread(threadId)}
                onClose={() => setVoiceOpen(false)}
                getScreen={voiceScreen}
                openRecipe={openRecipe}
                showFloatingBar={tab !== "chat" || voiceDishOpen}
                onExpandMobile={() => {
                  closeVoicePanels("all")
                  setTab("chat")
                }}
                leading={<span className="hidden lg:block">{backButton("icon")}</span>}
                trailing={hideAssistantButton}
              />
            ) : (
              <PlannerChat
                handle={plannerChat}
                chat={chat}
                savedAvoided={savedAvoided}
                profileLoading={restrictions.isLoading}
                profileError={Boolean(restrictions.error)}
                askContext={askContext}
                clearAskContext={() => setAskContext(null)}
                leading={<span className="hidden lg:block">{backButton("icon")}</span>}
                trailing={hideAssistantButton}
                onOpenWeek={showWeek}
                onStartVoice={startVoice}
                onEditDietary={() => {
                  setTab("calendar")
                  calendar.current?.showDietary()
                }}
                onOpenMealLog={(date) => {
                  setTab("calendar")
                  mealLog.current?.openDay(date ?? null)
                }}
                onOpenBodyMetrics={() => {
                  setTab("calendar")
                  calendar.current?.showBodyMetrics()
                }}
                onLogRestaurantDish={(dish) => {
                  setTab("calendar")
                  mealLog.current?.openCustomDish({
                    name: dish.name,
                    details: `Tại ${dish.restaurant.name}`,
                  })
                }}
                voiceDisabled={!weekStart || voiceOpen}
              />
            )}
            </div>
          </div>
          <div ref={calendarScrollRef} className={cn("min-w-0 lg:min-h-0 lg:overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", tab === "chat" && "hidden lg:block")}>
            <div className="lg:h-full">
              <CalendarBoard
                key={weekStart ?? "loading"}
                plan={plan.data}
                failed={Boolean(plan.error)}
                onChange={changeCalendar}
                onRetry={() => void plan.mutate()}
                onAsk={askAboutRecipe}
                onSuggestSlot={suggestForSlot}
                nutrition={nutrition.data}
                mealLog={weekLog.data}
                dietary={restrictions.data}
                handle={calendar}
                onActiveRecipeChange={setCalendarRecipe}
                initialDay={voiceDay !== null && voiceDay.weekStart === weekStart ? voiceDay.day : undefined}
                onNutritionSaved={async (updated) => {
                  await nutrition.mutate(updated, { revalidate: false })
                }}
                onDietarySaved={async (updated) => {
                  await restrictions.mutate(updated, { revalidate: false })
                }}
                onToggleEaten={toggleEaten}
                eatingBusyKey={eatingBusyKey}
                onLogEatingOut={() => mealLog.current?.openCustomDish()}
                onAskAssistant={askAssistant}
                action={
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <WeekNav
                      plan={plan.data}
                      loading={plan.isLoading}
                      onPrevious={() => plan.data && showWeek(shiftWeek(plan.data.weekStart, -1))}
                      onNext={() => plan.data && showWeek(shiftWeek(plan.data.weekStart, 1))}
                      onToday={() => plan.data && showWeek(plan.data.currentWeekStart)}
                    />
                    {plan.data && (
                      <ShoppingListSheet
                        weekStart={plan.data.weekStart}
                        plannedDays={plannedDays(plan.data)}
                        editableDays={editableDaysOf(plan.data)}
                        handle={shoppingList}
                        onOpenRecipe={(recipeId, title) => {
                          const plannedDay = plan.data?.days.find((day) =>
                            day.sections.some(({ recipes }) =>
                              recipes.some((recipe) => recipe.id === recipeId)
                            )
                          )
                          if (plannedDay) {
                            calendar.current?.openDish(plannedDay.day, recipeId, null)
                            return
                          }
                          setVoiceDish({ recipeId, title })
                          setVoiceDishOpen(true)
                        }}
                      />
                    )}
                    {plan.data && (
                      <MealLogSheet plan={plan.data} onAskAssistant={askAssistant} handle={mealLog} />
                    )}
                    {!assistantOpen && voicePillButton("hidden lg:inline-flex")}
                  </div>
                }
                leading={
                  assistantOpen ? undefined : (
                    <span className="hidden flex-col items-center gap-1 animate-in fade-in duration-300 lg:flex">
                      {backButton("icon-sm")}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Mở trợ lý"
                        onClick={() => setAssistantOpen(true)}
                      >
                        <SparklesIcon aria-hidden />
                      </Button>
                    </span>
                  )
                }
              />
            </div>
          </div>

        </div>
      </Tabs>
      <RecipeSheet
        open={voiceDishOpen}
        dish={voiceDish}
        handle={voiceRecipeSheet}
        onClose={() => setVoiceDishOpen(false)}
        onActiveRecipeChange={setVoiceSheetRecipe}
      />
      {voiceOpen && <VoiceScreenGlow active={lastVoiceFocusAt !== null} />}
    </section>
  )
}

function plannedDays(plan: MealPlan): Weekday[] {
  const days: Weekday[] = []
  for (const { day, sections } of plan.days) {
    if (sections.some(({ recipes }) => recipes.length > 0)) days.push(day)
  }
  return days
}
