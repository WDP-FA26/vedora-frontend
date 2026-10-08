"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { CalendarDaysIcon, SparklesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { isAccessTokenFresh } from "@/features/auth/lib/tokens"
import { useDietaryDraft } from "@/features/dietary/hooks/use-dietary-draft"
import { fetchMyDietary, MY_DIETARY_KEY } from "@/features/dietary/dietary"
import { PlannerChat } from "@/features/meal-plan/components/planner-chat"
import { MealRequestForm } from "@/features/meal-plan/components/meal-request-form"
import { Timetable } from "@/features/meal-plan/components/timetable"
import {
  messageProposals,
  useMealPlannerChat,
  type Proposal,
} from "@/features/meal-plan/hooks/use-meal-planner-chat"
import {
  DAY_LABELS,
  fetchMealPlan,
  MEAL_PLAN_KEY,
  saveMealDays,
  SECTION_LABELS,
  type MealDayInput,
  type MealPlan,
  type MealSection,
  type Weekday,
} from "@/features/meal-plan/meal-plan"
import { ApiError } from "@/features/shared/lib/api-client"
import { cn } from "@/lib/utils"

const TOKEN_CHECK_MS = 20_000
type Tab = "chat" | "plan"
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

/** The saved recurring week and the assistant share one frontend draft. */
export function MealPlannerView() {
  const { accessToken, user } = useAuth()
  const router = useRouter()
  const chat = useMealPlannerChat()
  const { appliedDraft: profile } = useDietaryDraft(user?.id)
  const [tab, setTab] = useState<Tab>("chat")
  const [draft, setDraft] = useState<Proposal | null>(null)
  const [savingDraft, setSavingDraft] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [askContext, setAskContext] = useState<AskContext | null>(null)
  const [prefill, setPrefill] = useState<{ text: string; nonce: number; fromForm?: boolean } | null>(null)
  const [formSeed, setFormSeed] = useState<{ text: string; nonce: number } | null>(null)
  const [requestOpen, setRequestOpen] = useState(false)
  const [formHandoffState, setFormHandoffState] = useState<"editing" | "prepared" | "sent">("editing")
  const [formSentAtCount, setFormSentAtCount] = useState<number | null>(null)
  const plan = useSWR(
    accessToken ? ([MEAL_PLAN_KEY, accessToken] as const) : null,
    fetchMealPlan
  )
  const restrictions = useSWR(
    accessToken ? ([MY_DIETARY_KEY, accessToken] as const) : null,
    fetchMyDietary
  )
  const newestProposal = chat.messages.flatMap(messageProposals).at(-1) ?? null
  const suggestion = newestProposal && !chat.statuses[newestProposal.id] ? newestProposal : null
  const hasSavedMeals = Boolean(plan.data?.days.some(({ sections }) => sections.some(({ recipes }) => recipes.length > 0)))
  const showRequestForm = requestOpen || Boolean(plan.data && !hasSavedMeals && !draft && !suggestion)
  const savedAvoided = [
    ...(restrictions.data?.groups.map(({ name }) => name) ?? []),
    ...(restrictions.data?.ingredients.map(({ name }) => name) ?? []),
  ]
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

  function stage(proposal: Proposal) {
    if (draft && draft.id !== proposal.id && !window.confirm("Thay bản nháp thực đơn hiện tại bằng đề xuất mới?")) return
    if (draft && draft.id !== proposal.id) chat.setProposalStatus(draft.id, "dismissed")
    setDraft(proposal)
    setRequestOpen(false)
    setSaveError(null)
    chat.setProposalStatus(proposal.id, "staged")
    setTab("plan")
  }

  function discardDraft() {
    if (!draft) return
    chat.setProposalStatus(draft.id, "dismissed")
    setDraft(null)
    setSaveError(null)
    setFormHandoffState("editing")
  }

  async function saveDraft() {
    if (!draft || !accessToken || savingDraft) return
    setSavingDraft(true)
    setSaveError(null)
    try {
      const current = await fetchMealPlan([MEAL_PLAN_KEY, accessToken])
      const days = changedDayInputs(draft, current)
      if (days.length === 0) {
        setSaveError("Đề xuất này không có thay đổi để lưu.")
        return
      }
      const saved = await saveMealDays(accessToken, days)
      await plan.mutate(saved, { revalidate: false })
      chat.setProposalStatus(draft.id, "saved")
      setDraft(null)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) router.refresh()
      setSaveError(
        error instanceof ApiError && error.status === 409
          ? "Thực đơn hoặc thông tin ăn uống đã thay đổi. Hãy kiểm tra lại đề xuất trước khi lưu."
          : error instanceof Error && !(error instanceof ApiError)
          ? error.message
          : "Không lưu được thực đơn. Bản nháp vẫn còn để bạn thử lại."
      )
    } finally {
      setSavingDraft(false)
    }
  }

  function requestReplacement(day: Weekday, section: MealSection, title: string) {
    setTab("chat")
    setPrefill((current) => ({
      text: `Đề xuất món khác thay cho "${title}" ở ${DAY_LABELS[day]}, bữa ${SECTION_LABELS[section].toLowerCase()}. Chỉ đổi bữa này, hãy cho tôi xem đề xuất trước khi lưu.`,
      nonce: (current?.nonce ?? 0) + 1,
    }))
  }

  function startPlanning(seed?: string) {
    setAskContext(null)
    setFormHandoffState("editing")
    setFormSentAtCount(null)
    setFormSeed((current) => ({ text: seed ?? "", nonce: (current?.nonce ?? 0) + 1 }))
    setRequestOpen(true)
    setTab("plan")
  }

  function continueInChat(prompt: string) {
    setPrefill((current) => ({ text: prompt, nonce: (current?.nonce ?? 0) + 1, fromForm: true }))
    setFormHandoffState("prepared")
    setFormSentAtCount(null)
    setRequestOpen(false)
    setTab("chat")
  }

  return (
    <section aria-labelledby="meal-planner-title" className="min-w-0 lg:h-dvh lg:overflow-hidden">
      <h1 id="meal-planner-title" className="sr-only">Lên thực đơn</h1>
      <Tabs value={tab} onValueChange={(next) => setTab(next as Tab)} className="min-w-0 lg:h-full">
        <div className="sticky top-0 z-20 border-b border-border bg-card/95 px-4 py-3 backdrop-blur-md lg:hidden">
          <TabsList className="grid w-full grid-cols-2" aria-label="Lên thực đơn">
            <TabsTrigger value="chat" className="min-w-0">
              <SparklesIcon aria-hidden /> Trợ lý
            </TabsTrigger>
            <TabsTrigger value="plan" className="min-w-0">
              <CalendarDaysIcon aria-hidden /> Thực đơn
              {suggestion && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[0.625rem] leading-none text-primary-foreground">Mới</span>}
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="min-w-0 lg:grid lg:h-full lg:grid-cols-[minmax(0,55fr)_minmax(24rem,45fr)]">
          <div className={cn("min-w-0 lg:h-full lg:min-h-0", tab !== "chat" && "hidden lg:block")}>
            <PlannerChat
              chat={chat}
              onStage={stage}
              openPlan={() => setTab("plan")}
              profile={profile}
              savedAvoided={savedAvoided}
              profileLoading={restrictions.isLoading}
              profileError={Boolean(restrictions.error)}
              askContext={askContext}
              prefill={prefill}
              clearAskContext={() => setAskContext(null)}
              onOpenPlanner={startPlanning}
              onFormSent={() => {
                setFormHandoffState("sent")
                setFormSentAtCount(chat.messages.length)
              }}
            />
          </div>

          <div className={cn("min-w-0 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-border", tab !== "plan" && "hidden lg:block")}>
            {showRequestForm ? (
              <MealRequestForm
                profile={profile}
                savedAvoided={savedAvoided}
                profileLoading={restrictions.isLoading}
                profileError={Boolean(restrictions.error)}
                onRetryProfile={() => void restrictions.mutate()}
                seed={formSeed}
                onContinue={continueInChat}
                handoffState={formHandoffState}
                awaitingReply={formAwaitingReply}
                chatError={chat.error}
                onEdit={() => setFormHandoffState("editing")}
                onCancel={hasSavedMeals || draft || suggestion ? () => setRequestOpen(false) : undefined}
                busy={chat.busy}
              />
            ) : <Timetable
              plan={plan.data}
              failed={Boolean(plan.error)}
              onRetry={() => void plan.mutate()}
              replace={requestReplacement}
              busy={chat.busy}
              onAsk={(recipe, day, section) => {
                setAskContext({ title: recipe.title, day, section })
                setTab("chat")
              }}
              onStart={() => startPlanning()}
              onForm={() => startPlanning()}
              action={<Button variant="outline" size="sm" onClick={() => startPlanning()}>Lên thực đơn</Button>}
              draft={draft}
              onSaveDraft={saveDraft}
              onDiscardDraft={discardDraft}
              savingDraft={savingDraft}
              saveError={saveError}
              suggestion={suggestion}
              onStageSuggestion={() => suggestion && stage(suggestion)}
              onDismissSuggestion={() => {
                if (!suggestion) return
                chat.setProposalStatus(suggestion.id, "dismissed")
                setFormHandoffState("editing")
              }}
            />}
          </div>
        </div>
      </Tabs>
    </section>
  )
}
