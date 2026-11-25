"use client"

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import Link from "next/link"
import { ArrowLeftIcon, AudioLinesIcon, CalendarRangeIcon, PanelLeftCloseIcon, SparklesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { isAccessTokenFresh } from "@/features/auth/lib/tokens"
import {
  DIETARY_PATH,
  fetchMyDietary,
  fetchMyNutrition,
  MAX_MEMORY_ITEM_LENGTH,
  MAX_MEMORY_ITEMS,
  memoryLines,
  MY_DIETARY_KEY,
  MY_NUTRITION_KEY,
  NUTRITION_GOALS,
  NUTRITION_GOAL_LABELS,
  saveMyDietary,
  saveMyNutrition,
  type DietaryMemory,
  type NutritionGoal,
  type NutritionProfile,
} from "@/features/dietary/dietary"
import { CalendarBoard, type CalendarBoardHandle } from "@/features/meal-plan/components/calendar-board"
import { MealLogButton, type MealLogHandle } from "@/features/meal-plan/components/meal-log-button"
import { PlannerChat, type PlannerChatHandle } from "@/features/meal-plan/components/planner-chat"
import { RecipeSheet, type OpenedDish, type RecipeSheetHandle } from "@/features/meal-plan/components/recipe-sheet"
import { VoicePanel } from "@/features/meal-plan/components/voice-panel"
import { VoiceScreenGlow } from "@/features/meal-plan/components/voice-screen-glow"
import { WeekNav } from "@/features/meal-plan/components/week-nav"
import { useMealPlannerChat } from "@/features/meal-plan/hooks/use-meal-planner-chat"
import {
  DAY_LABELS,
  fetchMealPlan,
  inputsForChanges,
  mealPlanKey,
  planAfterChanges,
  problemSchema,
  problemText,
  saveMealDays,
  SECTION_LABELS,
  shiftWeek,
  type MealSection,
  type SlotChange,
  type SlotRef,
  type Weekday,
} from "@/features/meal-plan/meal-plan"
import {
  readScrollState,
  scrollContainer,
  VOICE_GLOW_MS,
  type VoiceEffects,
  type VoiceOpenRecipe,
  type VoiceScreen,
  type VoiceScreenPanel,
} from "@/features/meal-plan/voice"
import { ApiError } from "@/features/shared/lib/api-client"
import { z } from "zod"
import { cn } from "@/lib/utils"

const TOKEN_CHECK_MS = 20_000
const HOME_PATH = "/home"
const WEEK_PARAM = "week"
const WEEK_PATTERN = /^\d{4}-\d{2}-\d{2}$/
type Tab = "chat" | "calendar"
type AskContext = { title: string; day: Weekday; section: MealSection }

/** What went wrong saving a calendar edit, in words the user can act on. */
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

/**
 * One saved week at a time (the `week` URL param, else this week). The assistant
 * saves its changes to any plannable week as it goes, and the calendar follows.
 */
export function MealPlannerView() {
  const { user, accessToken } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedWeek = searchParams.get(WEEK_PARAM)
  const weekParam = requestedWeek !== null && WEEK_PATTERN.test(requestedWeek) ? requestedWeek : undefined
  const isPageSession = user?.accountType === "PAGE"
  const canLoadDietary = user !== null && user.accountType === "PERSONAL"
  const plan = useAuthedSWR(canLoadDietary ? mealPlanKey(weekParam) : null, fetchMealPlan)
  const weekStart = plan.data?.weekStart
  const chat = useMealPlannerChat(weekStart)
  const plannerChat = useRef<PlannerChatHandle>(null)
  const [tab, setTab] = useState<Tab>("chat")
  const [assistantOpen, setAssistantOpen] = useState(true)
  const calendar = useRef<CalendarBoardHandle>(null)
  const mealLog = useRef<MealLogHandle>(null)
  const voiceRecipeSheet = useRef<RecipeSheetHandle>(null)
  const calendarScrollRef = useRef<HTMLDivElement>(null)
  /** A day the voice agent showed in another week; the calendar picks it when that week mounts. */
  const [voiceDay, setVoiceDay] = useState<{ weekStart: string; day: Weekday } | null>(null)
  const [voiceDish, setVoiceDish] = useState<OpenedDish | null>(null)
  const [voiceDishOpen, setVoiceDishOpen] = useState(false)
  const [calendarRecipe, setCalendarRecipe] = useState<VoiceOpenRecipe | null>(null)
  const [voiceSheetRecipe, setVoiceSheetRecipe] = useState<VoiceOpenRecipe | null>(null)
  const openRecipe = voiceDishOpen ? voiceSheetRecipe : calendarRecipe
  /** When the voice agent last changed or opened something; the screen glows a little after it. */
  const [lastVoiceFocusAt, setLastVoiceFocusAt] = useState<number | null>(null)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [askContext, setAskContext] = useState<AskContext | null>(null)
  const restrictions = useAuthedSWR(canLoadDietary ? MY_DIETARY_KEY : null, fetchMyDietary)
  const nutrition = useAuthedSWR(canLoadDietary ? MY_NUTRITION_KEY : null, fetchMyNutrition)
  const savedAvoided = restrictions.data?.allergies ?? []

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

  // A `week` in the URL the API refuses (not a Monday, too far ahead) is dropped, back to this week.
  const weekRefused =
    plan.error instanceof ApiError && (plan.error.status === 400 || plan.error.status === 409)
  useEffect(() => {
    if (weekRefused && weekParam) window.history.replaceState(null, "", window.location.pathname)
  }, [weekRefused, weekParam])

  /** Puts the week in the URL without a server round trip; the current week needs no param. */
  function writeWeek(next: string | undefined) {
    const params = new URLSearchParams(searchParams.toString())
    if (next) params.set(WEEK_PARAM, next)
    else params.delete(WEEK_PARAM)
    const query = params.toString()
    window.history.pushState(null, "", query ? `?${query}` : window.location.pathname)
  }

  /** The chat keeps its own week for each change, so switching weeks loses nothing. */
  function showWeek(next: string) {
    if (next !== weekStart) {
      writeWeek(next === plan.data?.currentWeekStart ? undefined : next)
    }
    setTab("calendar")
  }

  /**
   * What the page shows now, for the voice agent: the week and day on the calendar and the
   * panel over it. Read when a turn starts, so it matches what the user saw as they spoke.
   */
  function voiceScreen(): VoiceScreen | null {
    if (!weekStart) return null
    const board = calendar.current?.screen()
    const diary = mealLog.current?.screen()
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
        recipeSection: board.recipe.section ?? undefined,
        recipeStep: board.recipe.step ?? undefined,
        scrollState: board.recipe.scrollState,
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
      return { ...screen, panel: "bodyMetrics", scrollState: board.bodyMetricsScrollState }
    }
    const desktopScroll =
      calendarScrollRef.current && calendarScrollRef.current.offsetParent !== null
        ? readScrollState(calendarScrollRef.current)
        : undefined
    return { ...screen, scrollState: board?.mobileScrollState ?? desktopScroll }
  }

  /** Closes panels the voice agent opened (or the user did), all but `keep`. */
  function closeVoicePanels(panel: VoiceScreenPanel, keep?: VoiceScreenPanel) {
    const closes = (name: VoiceScreenPanel) => name !== keep && (panel === "all" || panel === name)
    if (closes("recipe")) {
      setVoiceDishOpen(false)
      calendar.current?.closeDish()
    }
    if (closes("eatingLog")) mealLog.current?.close()
    if (closes("bodyMetrics")) calendar.current?.hideBodyMetrics()
  }

  /**
   * Lights the screen glow for anything the voice agent changed, opened or closed, then
   * does it in the planner's own UI: the dish on the calendar (or its recipe sheet when it
   * is not planned), the food diary, the BMI panel, or the day it showed or changed.
   * Opening one panel closes the others, so the agent never stacks sheets.
   */
  function showVoiceEffects({ focus, close, scroll }: VoiceEffects) {
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
      closeVoicePanels("all", "eatingLog")
      setTab("calendar")
      mealLog.current?.openDay(focus.date)
      if (scroll) mealLog.current?.scroll(scroll)
      return
    }
    if (focus.kind === "bodyMetrics") {
      closeVoicePanels("all", "bodyMetrics")
      setTab("calendar")
      calendar.current?.showBodyMetrics()
      if (scroll) calendar.current?.scrollBodyMetrics(scroll)
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
      // Another week remounts the calendar, so the day goes in as its initial pick.
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
    setVoiceDish({ recipeId: focus.recipeId, title: focus.title, voice })
    setVoiceDishOpen(true)
  }

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
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) router.refresh()
      if (error instanceof ApiError && error.code === "MEAL_DAY_LOCKED") void plan.mutate()
      throw new Error(calendarErrorMessage(error))
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
    nutrition.data.weightKg !== null

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
                onEffects={showVoiceEffects}
                // Voice turns are saved in the chat's thread; reloading it shows them in the chat.
                onTurnEnd={(threadId) => void chat.selectThread(threadId)}
                onClose={() => setVoiceOpen(false)}
                getScreen={voiceScreen}
                openRecipe={openRecipe}
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
                handle={calendar}
                onActiveRecipeChange={setCalendarRecipe}
                initialDay={voiceDay !== null && voiceDay.weekStart === weekStart ? voiceDay.day : undefined}
                onNutritionSaved={async (updated) => {
                  await nutrition.mutate(updated, { revalidate: false })
                }}
                onAskAssistant={askAssistant}
                action={
                  <div className="flex w-full min-w-0 items-center gap-2">
                    <WeekNav
                      plan={plan.data}
                      loading={plan.isLoading}
                      onPrevious={() => plan.data && showWeek(shiftWeek(plan.data.weekStart, -1))}
                      onNext={() => plan.data && showWeek(shiftWeek(plan.data.weekStart, 1))}
                      onToday={() => plan.data && showWeek(plan.data.currentWeekStart)}
                    />
                    {plan.data && (
                      <MealLogButton plan={plan.data} onAskAssistant={askAssistant} handle={mealLog} />
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

function MealPlannerOnboardingGate({
  backButton,
  initialNutrition,
  initialRestrictions,
  onCompleted,
}: {
  backButton: ReactNode
  initialNutrition: NutritionProfile
  initialRestrictions: DietaryMemory
  onCompleted: (savedNutrition: NutritionProfile, savedDietary: DietaryMemory) => Promise<void>
}) {
  const { accessToken } = useAuth()
  const initialNote = initialRestrictions.allergies.join("\n")

  const [heightCm, setHeightCm] = useState(initialNutrition.heightCm?.toString() ?? "")
  const [weightKg, setWeightKg] = useState(initialNutrition.weightKg?.toString() ?? "")
  const [nutritionGoal, setNutritionGoal] = useState<NutritionGoal | null>(
    initialNutrition.nutritionGoal ?? null
  )
  const [allergyNote, setAllergyNote] = useState(initialNote)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!accessToken || saving) return

    const heightNum = Number(heightCm.trim().replace(",", "."))
    const weightNum = Number(weightKg.trim().replace(",", "."))

    if (!Number.isInteger(heightNum) || heightNum < 100 || heightNum > 250) {
      setError("Nhập chiều cao hợp lệ từ 100 đến 250 cm để tính định mức calo.")
      return
    }
    if (!Number.isFinite(weightNum) || weightNum < 25 || weightNum > 300) {
      setError("Nhập cân nặng hợp lệ từ 25 đến 300 kg để tính định mức calo.")
      return
    }

    const allergies = memoryLines(allergyNote)
    if (allergies.length > MAX_MEMORY_ITEMS || allergies.some((line) => line.length > MAX_MEMORY_ITEM_LENGTH)) {
      setError(`Dị ứng tối đa ${MAX_MEMORY_ITEMS} dòng, mỗi dòng tối đa ${MAX_MEMORY_ITEM_LENGTH} ký tự.`)
      return
    }

    setSaving(true)
    setError(null)
    try {
      const [savedNutrition, savedDietary] = await Promise.all([
        saveMyNutrition(accessToken, {
          heightCm: heightNum,
          weightKg: Math.round(weightNum * 10) / 10,
          nutritionGoal,
        }),
        saveMyDietary(accessToken, { allergies }),
      ])
      await onCompleted(savedNutrition, savedDietary)
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Chưa lưu được hồ sơ ăn uống. Vui lòng thử lại."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-labelledby="meal-planner-onboarding-title" className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center gap-2 border-b border-border bg-card px-3 py-2.5">
        {backButton}
        <h1 id="meal-planner-onboarding-title" className="text-base font-bold">
          Cập nhật hồ sơ ăn uống trước khi lên thực đơn
        </h1>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center p-4 sm:p-6">
        <form
          onSubmit={submit}
          noValidate
          className="space-y-6 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
        >
          <div className="space-y-1">
            <h2 className="font-heading text-lg font-bold">
              Thiết lập nhanh chỉ số ăn uống của bạn
            </h2>
            <p className="text-xs leading-5 text-muted-foreground">
              Trợ lý chỉ hỏi đúng 3 thông tin dùng trực tiếp để chia khẩu phần hợp lý và loại bỏ món gây dị ứng cho bạn.
            </p>
          </div>

          <FieldGroup>
            <div className="space-y-2">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="gate-height">Chiều cao (cm) *</FieldLabel>
                  <Input
                    id="gate-height"
                    type="number"
                    required
                    min={100}
                    max={250}
                    step={1}
                    value={heightCm}
                    onChange={(event) => {
                      setHeightCm(event.target.value)
                      setError(null)
                    }}
                    placeholder="Ví dụ: 162"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="gate-weight">Cân nặng hiện tại (kg) *</FieldLabel>
                  <Input
                    id="gate-weight"
                    type="number"
                    required
                    min={25}
                    max={300}
                    step={0.1}
                    value={weightKg}
                    onChange={(event) => {
                      setWeightKg(event.target.value)
                      setError(null)
                    }}
                    placeholder="Ví dụ: 55.5"
                  />
                </Field>
              </div>
              <FieldDescription>
                Dùng để tính chỉ số BMI và định mức calo mỗi ngày (~kcal/ngày) nhằm ghép đủ số món cho từng bữa.
              </FieldDescription>
            </div>

            <Field>
              <FieldLabel>Mục tiêu thực đơn</FieldLabel>
              <div className="grid gap-2 sm:grid-cols-3">
                {NUTRITION_GOALS.map((goal) => {
                  const selected = nutritionGoal === goal
                  return (
                    <button
                      key={goal}
                      type="button"
                      onClick={() => setNutritionGoal(selected ? null : goal)}
                      className={cn(
                        "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors",
                        selected
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background hover:bg-accent/50"
                      )}
                    >
                      <span className="text-xs font-semibold">{NUTRITION_GOAL_LABELS[goal].label}</span>
                      <span className="text-[0.6875rem] leading-4 text-muted-foreground">
                        {NUTRITION_GOAL_LABELS[goal].hint}
                      </span>
                    </button>
                  )
                })}
              </div>
              <FieldDescription>
                Quyết định cách trợ lý phân bổ bữa ăn (ưu tiên bữa tối thanh nhẹ khi giảm cân, hoặc thêm món/bữa phụ khi cần bồi bổ). Có thể bỏ trống để hệ thống tự gợi ý theo BMI.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="gate-allergy-note">
                Dị ứng hoặc thực phẩm không ăn (tùy chọn, mỗi dòng một ý)
              </FieldLabel>
              <Textarea
                id="gate-allergy-note"
                rows={3}
                value={allergyNote}
                onChange={(event) => setAllergyNote(event.target.value)}
                placeholder={"Ví dụ:\nDị ứng đậu phộng\nKhông ăn đồ cay"}
              />
              <FieldDescription>
                Trợ lý sẽ tự tránh các món có nguyên liệu, gia vị hoặc cách nấu không hợp với bạn.
              </FieldDescription>
            </Field>
          </FieldGroup>

          {error && (
            <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <Button type="submit" disabled={saving}>
              {saving && <Spinner aria-hidden />}
              Lưu hồ sơ &amp; Bắt đầu lên thực đơn
            </Button>
            <Link
              href={DIETARY_PATH}
              className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
            >
              Chỉnh hồ sơ ăn uống
            </Link>
          </div>
        </form>
      </div>
    </section>
  )
}
