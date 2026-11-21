"use client"

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSWRConfig } from "swr"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import Link from "next/link"
import { ArrowLeftIcon, CalendarRangeIcon, PanelLeftCloseIcon, SparklesIcon } from "lucide-react"

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
  MAX_ALLERGY_NOTE_LENGTH,
  MY_DIETARY_KEY,
  MY_NUTRITION_KEY,
  NUTRITION_GOALS,
  NUTRITION_GOAL_LABELS,
  saveMyDietary,
  saveMyNutrition,
  type DietaryRestrictions,
  type NutritionGoal,
  type NutritionProfile,
} from "@/features/dietary/dietary"
import { CalendarBoard } from "@/features/meal-plan/components/calendar-board"
import { PlannerChat, type PlannerChatHandle } from "@/features/meal-plan/components/planner-chat"
import { WeekNav } from "@/features/meal-plan/components/week-nav"
import {
  proposalIds,
  useMealPlannerChat,
  type Proposal,
} from "@/features/meal-plan/hooks/use-meal-planner-chat"
import {
  DAY_LABELS,
  discardMealDraft,
  formatDayMonth,
  fetchMealPlan,
  inputsForChanges,
  mealPlanKey,
  planAfterChanges,
  problemSchema,
  problemText,
  saveMealDays,
  SECTION_LABELS,
  shiftWeek,
  type MealDayInput,
  type MealPlan,
  type MealSection,
  type SlotChange,
  type SlotRef,
  type Weekday,
} from "@/features/meal-plan/meal-plan"
import { ApiError } from "@/features/shared/lib/api-client"
import { z } from "zod"
import { cn } from "@/lib/utils"

const TOKEN_CHECK_MS = 20_000
const HOME_PATH = "/home"
const WEEK_PARAM = "week"
const WEEK_PATTERN = /^\d{4}-\d{2}-\d{2}$/
type Tab = "chat" | "calendar"
type AskContext = { title: string; day: Weekday; section: MealSection }

function sameIds(left: string[], right: string[]) {
  return left.length === right.length && left.every((id, index) => id === right[index])
}

/** PUT replaces a whole day, so untouched sections must come from fresh server data. */
function changedDayInputs(proposal: Proposal, current: MealPlan): MealDayInput[] {
  return proposal.days.flatMap(({ day, sections }) => {
    const saved = current.days.find((item) => item.day === day)
    const changed = sections.filter(
      ({ recipes, previous }) => !sameIds(recipes.map(({ id }) => id), previous.map(({ id }) => id))
    )
    if (changed.length === 0) return []

    for (const { section, previous } of changed) {
      const currentIds = saved?.sections.find((item) => item.section === section)?.recipes.map(({ id }) => id) ?? []
      if (!sameIds(currentIds, previous.map(({ id }) => id))) {
        throw new Error("Thực đơn đã thay đổi từ khi trợ lý đề xuất. Hãy yêu cầu đề xuất mới trước khi lưu.")
      }
    }

    const ids = (section: MealSection) =>
      changed.find((item) => item.section === section)?.recipes.map(({ id }) => id) ??
      saved?.sections.find((item) => item.section === section)?.recipes.map(({ id }) => id) ??
      []

    return [{
      day,
      breakfast: ids("BREAKFAST"),
      lunch: ids("LUNCH"),
      dinner: ids("DINNER"),
      others: ids("OTHER"),
    }]
  })
}

/**
 * Only days that may still change can be saved; a proposal made yesterday may hold
 * one that has passed. Returns the days to save and the passed ones left out.
 */
function splitPassedDays(inputs: MealDayInput[], current: MealPlan) {
  const save: MealDayInput[] = []
  const passed: string[] = []
  for (const input of inputs) {
    const day = current.days.find((item) => item.day === input.day)
    if (day?.editable) {
      save.push(input)
      continue
    }
    passed.push(day ? `${DAY_LABELS[input.day]} ${formatDayMonth(day.date)}` : DAY_LABELS[input.day])
  }
  return { save, passed }
}

/** Why a proposal could not be saved, in words the user can act on. */
function applyErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.code === "MEAL_DAY_LOCKED") {
    return "Có ngày trong đề xuất đã qua nên không lưu được. Hãy nhờ trợ lý đề xuất lại."
  }
  if (error instanceof ApiError && error.code === "MEAL_WEEK_OUT_OF_RANGE") return "Chưa thể lên thực đơn cho tuần xa như vậy."
  if (error instanceof ApiError && error.status === 409) {
    return "Thực đơn hoặc thông tin ăn uống đã thay đổi. Hãy nhờ trợ lý đề xuất lại."
  }
  if (error instanceof Error && !(error instanceof ApiError)) return error.message
  return "Không lưu được thực đơn. Hãy thử lại."
}

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
 * One saved week at a time (the `week` URL param, else this week). The assistant may
 * propose for any plannable week; proposals can be applied from either chat cards or calendar preview.
 */
export function MealPlannerView() {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedWeek = searchParams.get(WEEK_PARAM)
  const weekParam = requestedWeek !== null && WEEK_PATTERN.test(requestedWeek) ? requestedWeek : undefined
  const plan = useAuthedSWR(mealPlanKey(weekParam), fetchMealPlan)
  const weekStart = plan.data?.weekStart
  const chat = useMealPlannerChat(weekStart)
  const plannerChat = useRef<PlannerChatHandle>(null)
  const [tab, setTab] = useState<Tab>("chat")
  const [assistantOpen, setAssistantOpen] = useState(true)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [applyErrors, setApplyErrors] = useState<Record<string, string>>({})
  /** Passed days a saved proposal could not keep, by proposal id. */
  const [skippedDays, setSkippedDays] = useState<Record<string, string[]>>({})
  const [askContext, setAskContext] = useState<AskContext | null>(null)
  const restrictions = useAuthedSWR(MY_DIETARY_KEY, fetchMyDietary)
  const nutrition = useAuthedSWR(MY_NUTRITION_KEY, fetchMyNutrition)
  // The calendar previews what a card would change in the week on screen.
  const suggestion = chat.pendingProposals.find((proposal) => proposal.weekStart === weekStart) ?? null
  const savedAvoided = [
    ...(restrictions.data?.groups.map(({ name }) => name) ?? []),
    ...(restrictions.data?.ingredients.map(({ name }) => name) ?? []),
    ...(restrictions.data?.allergyNote ? [restrictions.data.allergyNote] : []),
  ]

  useEffect(() => {
    const timer = setInterval(() => {
      if (!isAccessTokenFresh(accessToken)) router.refresh()
    }, TOKEN_CHECK_MS)
    return () => clearInterval(timer)
  }, [accessToken, router])

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

  /** Proposals live in the chat and keep their own week, so switching weeks loses nothing. */
  function showWeek(next: string) {
    if (next !== weekStart) {
      writeWeek(next === plan.data?.currentWeekStart ? undefined : next)
    }
    setTab("calendar")
  }

  function askAssistant(prompt: string) {
    setAssistantOpen(true)
    setTab("chat")
    plannerChat.current?.ask(prompt)
  }

  function setApplyError(id: string, message: string | null) {
    setApplyErrors((current) => {
      const next = { ...current }
      if (message === null) delete next[id]
      else next[id] = message
      return next
    })
  }

  /** Saves a card's changes to its own week, which need not be the week on screen. */
  async function applyProposal(proposal: Proposal) {
    const week = proposal.weekStart
    if (!accessToken || applyingId || !week) return
    setApplyingId(proposal.id)
    setApplyError(proposal.id, null)
    try {
      const current = await fetchMealPlan([mealPlanKey(week), accessToken])
      const { save, passed } = splitPassedDays(changedDayInputs(proposal, current), current)
      if (save.length === 0) {
        setApplyError(proposal.id, "Các ngày trong đề xuất đã qua hoặc đã giống thực đơn đang lưu. Hãy nhờ trợ lý đề xuất lại.")
        return
      }
      const saved = await saveMealDays(accessToken, week, save)
      await mutate([mealPlanKey(week), accessToken], saved, { revalidate: false })
      // The current week is also cached under the key without `weekStart` (page default, header sheet).
      if (week === saved.currentWeekStart) await mutate([mealPlanKey(), accessToken], saved, { revalidate: false })
      if (passed.length > 0) setSkippedDays((current) => ({ ...current, [proposal.id]: passed }))
      chat.setProposalsStatus(proposalIds(proposal), "saved")
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) router.refresh()
      setApplyError(proposal.id, applyErrorMessage(error))
    } finally {
      setApplyingId(null)
    }
  }

  async function dismissProposal(proposal: Proposal) {
    setApplyError(proposal.id, null)
    chat.setProposalsStatus(proposalIds(proposal), "dismissed")
    const week = proposal.weekStart
    if (!accessToken || !week) return
    // The planner builds on its server draft; drop it so the next turn starts from the saved week.
    // A failure is harmless: the conversation note already tells the planner the card was dismissed.
    await discardMealDraft(accessToken, week).catch(() => undefined)
  }

  function openChat() {
    setAssistantOpen(true)
    setTab("chat")
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
              {suggestion && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[0.625rem] leading-none text-primary-foreground">Mới</span>}
            </TabsTrigger>
          </TabsList>
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
            <PlannerChat
              handle={plannerChat}
              chat={chat}
              applyingId={applyingId}
              applyErrors={applyErrors}
              skippedDays={skippedDays}
              onApply={(proposal) => void applyProposal(proposal)}
              onDismiss={(proposal) => void dismissProposal(proposal)}
              savedAvoided={savedAvoided}
              profileLoading={restrictions.isLoading}
              profileError={Boolean(restrictions.error)}
              askContext={askContext}
              clearAskContext={() => setAskContext(null)}
              leading={<span className="hidden lg:block">{backButton("icon")}</span>}
              trailing={
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden lg:inline-flex"
                  aria-label="Ẩn trợ lý"
                  onClick={() => setAssistantOpen(false)}
                >
                  <PanelLeftCloseIcon aria-hidden />
                </Button>
              }
              onOpenWeek={showWeek}
            />
            </div>
          </div>
          <div className={cn("min-w-0 lg:min-h-0 lg:overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", tab === "chat" && "hidden lg:block")}>
            <div className="lg:h-full">
              <CalendarBoard
                key={weekStart ?? "loading"}
                plan={plan.data}
                failed={Boolean(plan.error)}
                suggestion={suggestion}
                onApplySuggestion={() => suggestion && void applyProposal(suggestion)}
                onDismissSuggestion={() => suggestion && void dismissProposal(suggestion)}
                applyingSuggestion={Boolean(suggestion && applyingId === suggestion.id)}
                onOpenChat={openChat}
                onChange={changeCalendar}
                onRetry={() => void plan.mutate()}
                onAsk={askAboutRecipe}
                onSuggestSlot={suggestForSlot}
                nutrition={nutrition.data}
                onNutritionSaved={async (updated) => {
                  await nutrition.mutate(updated, { revalidate: false })
                }}
                onAskAssistant={askAssistant}
                action={
                  <WeekNav
                    plan={plan.data}
                    loading={plan.isLoading}
                    onPrevious={() => plan.data && showWeek(shiftWeek(plan.data.weekStart, -1))}
                    onNext={() => plan.data && showWeek(shiftWeek(plan.data.weekStart, 1))}
                    onToday={() => plan.data && showWeek(plan.data.currentWeekStart)}
                  />
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
  initialRestrictions: DietaryRestrictions
  onCompleted: (savedNutrition: NutritionProfile, savedDietary: DietaryRestrictions) => Promise<void>
}) {
  const { accessToken } = useAuth()
  const existingAvoided = [
    ...initialRestrictions.groups.map(({ name }) => name),
    ...initialRestrictions.ingredients.map(({ name }) => name),
  ]
  const initialNote = initialRestrictions.allergyNote?.trim() || existingAvoided.join(", ")

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

    setSaving(true)
    setError(null)
    try {
      const [savedNutrition, savedDietary] = await Promise.all([
        saveMyNutrition(accessToken, {
          heightCm: heightNum,
          weightKg: Math.round(weightNum * 10) / 10,
          nutritionGoal,
        }),
        saveMyDietary(accessToken, {
          groupIds: [],
          ingredientIds: [],
          likedIngredientIds: initialRestrictions.liked.map(({ id }) => id),
          allergyNote,
        }),
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
                Ghi chú dị ứng hoặc thực phẩm không ăn (tùy chọn)
              </FieldLabel>
              <Textarea
                id="gate-allergy-note"
                rows={3}
                maxLength={MAX_ALLERGY_NOTE_LENGTH}
                value={allergyNote}
                onChange={(event) => setAllergyNote(event.target.value)}
                placeholder="Ví dụ: Mình dị ứng đậu phộng, mè/vừng và không ăn đồ cay…"
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
              Chọn thêm nguyên liệu yêu thích
            </Link>
          </div>
        </form>
      </div>
    </section>
  )
}
