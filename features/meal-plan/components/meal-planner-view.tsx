"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import Link from "next/link"
import { ArrowLeftIcon, CalendarRangeIcon, PanelLeftCloseIcon, SparklesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { isAccessTokenFresh } from "@/features/auth/lib/tokens"
import { fetchMyDietary, MY_DIETARY_KEY } from "@/features/dietary/dietary"
import { CalendarBoard } from "@/features/meal-plan/components/calendar-board"
import { PlannerChat, type PlannerChatHandle } from "@/features/meal-plan/components/planner-chat"
import { QuickGenerate } from "@/features/meal-plan/components/quick-generate"
import { WeekNav } from "@/features/meal-plan/components/week-nav"
import { MealRequestForm } from "@/features/meal-plan/components/meal-request-form"
import {
  proposalIds,
  useMealPlannerChat,
  type Proposal,
} from "@/features/meal-plan/hooks/use-meal-planner-chat"
import {
  copyMealWeek,
  DAY_LABELS,
  fetchMealPlan,
  generateMealDays,
  inputsForChanges,
  mealPlanKey,
  planAfterChanges,
  problemSchema,
  problemText,
  recipesAt,
  saveMealDays,
  SECTION_LABELS,
  shiftWeek,
  type GenerateInput,
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

/** What went wrong copying a week, in words the user can act on. */
function copyErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.code === "MEAL_DAY_LOCKED") return "Các ngày của tuần này đã qua nên không sao chép được."
  if (error instanceof ApiError && error.code === "MEAL_WEEK_NOT_EMPTY") return "Tuần này đã có món. Hãy thử sao chép lại."
  const problems = error instanceof ApiError ? z.array(problemSchema).safeParse(error.details?.problems) : null
  if (problems?.success && problems.data.length > 0) {
    return `Tuần trước có món bạn không ăn được: ${problems.data.map(problemText).join(" ")} Hãy sửa món đó rồi sao chép lại.`
  }
  return "Không sao chép được thực đơn. Hãy thử lại."
}

/** True when `onlyEmpty` was requested and every target slot already has at least one dish. */
function allRequestedSlotsFilled(plan: MealPlan | undefined, request: GenerateInput): boolean {
  if (!request.onlyEmpty || !plan) return false
  for (const day of request.days) {
    for (const section of request.sections) {
      if (recipesAt(plan, { day, section }).length === 0) return false
    }
  }
  return true
}

/** One saved week at a time (the `week` URL param, else this week); the assistant shares one frontend draft with it. */
export function MealPlannerView() {
  const { accessToken } = useAuth()
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
  const [draft, setDraft] = useState<Proposal | null>(null)
  const [generated, setGenerated] = useState<Proposal | null>(null)
  const [savingDraft, setSavingDraft] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [askContext, setAskContext] = useState<AskContext | null>(null)
  const [prefill, setPrefill] = useState<{ text: string; nonce: number; fromForm?: boolean } | null>(null)
  const [formSeed, setFormSeed] = useState<{ text: string; nonce: number } | null>(null)
  const [requestOpen, setRequestOpen] = useState(false)
  const [formHandoffState, setFormHandoffState] = useState<"editing" | "prepared" | "sent">("editing")
  const [formSentAtCount, setFormSentAtCount] = useState<number | null>(null)
  const [copying, setCopying] = useState(false)
  const restrictions = useAuthedSWR(MY_DIETARY_KEY, fetchMyDietary)
  const suggestion = generated ?? chat.pendingProposal
  const plannedDays = plan.data
    ? plan.data.days
        .filter(({ sections }) => sections.some(({ recipes }) => recipes.length > 0))
        .map(({ day }) => day)
    : undefined
  const hasSavedMeals = Boolean(plannedDays?.length)
  const savedAvoided = [
    ...(restrictions.data?.groups.map(({ name }) => name) ?? []),
    ...(restrictions.data?.ingredients.map(({ name }) => name) ?? []),
  ]
  const savedLiked = restrictions.data?.liked.map(({ name }) => name) ?? []
  const formReplyReceived = formSentAtCount !== null &&
    chat.messages.length > formSentAtCount && chat.messages.at(-1)?.role === "assistant" && !chat.busy
  const formAwaitingReply = formHandoffState === "sent" && !chat.error && !formReplyReceived

  useEffect(() => {
    const timer = setInterval(() => {
      if (!isAccessTokenFresh(accessToken)) router.refresh()
    }, TOKEN_CHECK_MS)
    return () => clearInterval(timer)
  }, [accessToken, router])

  useEffect(() => {
    if (!draft) return
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    const navigate = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return
      const anchor = event.target.closest("a[href]")
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank") return
      const destination = new URL(anchor.href, window.location.href)
      if (destination.origin !== window.location.origin || destination.href === window.location.href) return
      if (!window.confirm("Bản nháp thực đơn chưa được lưu. Bạn muốn rời trang?")) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener("beforeunload", beforeUnload)
    document.addEventListener("click", navigate, true)
    return () => {
      window.removeEventListener("beforeunload", beforeUnload)
      document.removeEventListener("click", navigate, true)
    }
  }, [draft])

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

  /** Unsaved suggestions belong to one week, so leaving it asks first. */
  function showWeek(next: string) {
    if (next === weekStart) return
    const unsaved = draft !== null || generated !== null
    if (unsaved && !window.confirm("Bản nháp thực đơn của tuần này chưa lưu và sẽ bị bỏ. Chuyển tuần?")) return
    if (draft) chat.setProposalsStatus(proposalIds(draft), "dismissed")
    setDraft(null)
    setGenerated(null)
    setSaveError(null)
    setRequestOpen(false)
    writeWeek(next === plan.data?.currentWeekStart ? undefined : next)
  }

  async function copyFromPreviousWeek() {
    const current = plan.data
    if (!accessToken || !current || copying) return
    const source = shiftWeek(current.weekStart, -1)
    // Only days that may still change count: the server leaves the others alone.
    const overwrite = current.days.some(
      ({ editable, sections }) => editable && sections.some(({ recipes }) => recipes.length > 0)
    )
    if (overwrite && !window.confirm("Tuần này đã có món. Thay bằng thực đơn của tuần trước?")) return
    setCopying(true)
    setSaveError(null)
    try {
      const copied = await copyMealWeek(accessToken, source, current.weekStart, overwrite)
      await plan.mutate(copied, { revalidate: false })
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) router.refresh()
      setSaveError(copyErrorMessage(error))
    } finally {
      setCopying(false)
    }
  }

  async function generate(request: GenerateInput): Promise<string | null> {
    if (!accessToken || !weekStart) return "Phiên đăng nhập đã hết hạn. Hãy tải lại trang."
    try {
      const result = await generateMealDays(accessToken, { ...request, weekStart })
      if (result.days.length === 0) {
        return allRequestedSlotsFilled(plan.data, request)
          ? "Các bữa đã chọn đều đã có món. Chọn “Cả tuần” hoặc “Hôm nay” nếu bạn muốn đổi món mới."
          : "Không tìm thấy món phù hợp với lựa chọn này."
      }
      if (!result.ok) return "Các món tìm được xung đột với hồ sơ ăn uống. Hãy thử lại."
      setGenerated({ id: `generated-${crypto.randomUUID()}`, ok: true, weekStart, days: result.days })
      setTab("calendar")
      return null
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) router.refresh()
      return "Không chọn được món. Hãy thử lại."
    }
  }

  function askAssistant(prompt: string) {
    setAssistantOpen(true)
    setTab("chat")
    plannerChat.current?.ask(prompt)
  }

  function dismissSuggestion(proposal: Proposal) {
    if (generated?.id === proposal.id) {
      setGenerated(null)
      return
    }
    chat.setProposalsStatus(proposalIds(proposal), "dismissed")
  }

  function stage(proposal: Proposal) {
    if (generated?.id === proposal.id) setGenerated(null)
    if (draft && draft.id !== proposal.id && !window.confirm("Thay bản nháp thực đơn hiện tại bằng đề xuất mới?")) return
    if (draft && draft.id !== proposal.id) chat.setProposalsStatus(proposalIds(draft), "dismissed")
    setDraft(proposal)
    setRequestOpen(false)
    setSaveError(null)
    chat.setProposalsStatus(proposalIds(proposal), "staged")
    setTab("calendar")
  }

  function discardDraft() {
    if (!draft) return
    chat.setProposalsStatus(proposalIds(draft), "dismissed")
    setDraft(null)
    setSaveError(null)
    setFormHandoffState("editing")
  }

  async function saveDraft() {
    if (!draft || !accessToken || savingDraft) return
    setSavingDraft(true)
    setSaveError(null)
    try {
      const draftWeek = draft.weekStart
      if (!draftWeek) {
        setSaveError("Đề xuất này không ghi rõ tuần nào. Hãy yêu cầu đề xuất mới.")
        return
      }
      const current = await fetchMealPlan([mealPlanKey(draftWeek), accessToken])
      const days = changedDayInputs(draft, current)
      if (days.length === 0) {
        setSaveError("Đề xuất này không có thay đổi để lưu.")
        return
      }
      const saved = await saveMealDays(accessToken, draftWeek, days)
      await plan.mutate(saved, { revalidate: false })
      chat.setProposalsStatus(proposalIds(draft), "saved")
      setDraft(null)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) router.refresh()
      if (error instanceof ApiError && error.code === "MEAL_DAY_LOCKED") void plan.mutate()
      setSaveError(
        error instanceof ApiError && error.code === "MEAL_DAY_LOCKED"
          ? "Có ngày trong đề xuất đã qua nên không lưu được. Hãy yêu cầu đề xuất mới."
          : error instanceof ApiError && error.status === 409
          ? "Thực đơn hoặc thông tin ăn uống đã thay đổi. Hãy kiểm tra lại đề xuất trước khi lưu."
          : error instanceof Error && !(error instanceof ApiError)
          ? error.message
          : "Không lưu được thực đơn. Bản nháp vẫn còn để bạn thử lại."
      )
    } finally {
      setSavingDraft(false)
    }
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

  function startPlanning(seed?: string) {
    setAskContext(null)
    setFormHandoffState("editing")
    setFormSentAtCount(null)
    setFormSeed((current) => ({ text: seed ?? "", nonce: (current?.nonce ?? 0) + 1 }))
    setRequestOpen(true)
    setTab("calendar")
  }

  function continueInChat(prompt: string) {
    setPrefill((current) => ({ text: prompt, nonce: (current?.nonce ?? 0) + 1, fromForm: true }))
    setFormHandoffState("prepared")
    setFormSentAtCount(null)
    setRequestOpen(false)
    setTab("chat")
  }

  function suggestForSlot({ day, section }: SlotRef) {
    setAssistantOpen(true)
    setTab("chat")
    setPrefill((current) => ({
      text: `Gợi ý vài món cho ${DAY_LABELS[day]}, bữa ${SECTION_LABELS[section].toLowerCase()}. Chỉ thay bữa này, hãy cho tôi xem đề xuất trước khi lưu.`,
      nonce: (current?.nonce ?? 0) + 1,
    }))
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
              onStage={stage}
              openPlan={() => setTab("calendar")}
              savedAvoided={savedAvoided}
              savedLiked={savedLiked}
              profileLoading={restrictions.isLoading}
              profileError={Boolean(restrictions.error)}
              askContext={askContext}
              prefill={prefill}
              clearAskContext={() => setAskContext(null)}
              onOpenPlanner={startPlanning}
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
              onFormSent={() => {
                setFormHandoffState("sent")
                setFormSentAtCount(chat.messages.length)
              }}
            />
            </div>
          </div>
          <div className={cn("min-w-0 lg:min-h-0 lg:overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", tab === "chat" && "hidden lg:block")}>
            <div className={cn("mx-auto w-full max-w-2xl", tab === "calendar" && requestOpen ? "block" : "hidden", requestOpen ? "lg:block" : "lg:hidden")}>
              <MealRequestForm
                savedAvoided={savedAvoided}
                savedLiked={savedLiked}
                profileLoading={restrictions.isLoading}
                profileError={Boolean(restrictions.error)}
                onRetryProfile={() => void restrictions.mutate()}
                seed={formSeed}
                onContinue={continueInChat}
                handoffState={formHandoffState}
                awaitingReply={formAwaitingReply}
                chatError={chat.error}
                onEdit={() => setFormHandoffState("editing")}
                onCancel={hasSavedMeals || draft || suggestion || requestOpen ? () => setRequestOpen(false) : undefined}
                busy={chat.busy}
              />
            </div>

            <div className={cn("lg:h-full", tab === "calendar" && !requestOpen ? "block" : "hidden", requestOpen ? "lg:hidden" : "lg:block")}>
              <CalendarBoard
                key={weekStart ?? "loading"}
                plan={plan.data}
                failed={Boolean(plan.error)}
                draft={draft}
                suggestion={suggestion}
                onApplySuggestion={suggestion ? () => stage(suggestion) : undefined}
                onDismissSuggestion={suggestion ? () => dismissSuggestion(suggestion) : undefined}
                onSaveDraft={saveDraft}
                onDiscardDraft={discardDraft}
                savingDraft={savingDraft}
                saveError={saveError}
                onChange={changeCalendar}
                onRetry={() => void plan.mutate()}
                onAsk={askAboutRecipe}
                onSuggestSlot={suggestForSlot}
                action={
                  <WeekNav
                    plan={plan.data}
                    loading={plan.isLoading}
                    onPrevious={() => plan.data && showWeek(shiftWeek(plan.data.weekStart, -1))}
                    onNext={() => plan.data && showWeek(shiftWeek(plan.data.weekStart, 1))}
                    onToday={() => plan.data && showWeek(plan.data.currentWeekStart)}
                    onCopyPrevious={() => void copyFromPreviousWeek()}
                    copying={copying}
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
      <div className={cn(tab === "chat" && "hidden lg:block")}>
        <QuickGenerate plan={plan.data} disabled={savingDraft} onGenerate={generate} onAskAssistant={askAssistant} />
      </div>
    </section>
  )
}
