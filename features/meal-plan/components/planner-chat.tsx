"use client"

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
import Link from "next/link"
import { Streamdown } from "streamdown"
import {
  ArrowRightIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react"

import { Bubble, BubbleContent, BubbleGroup } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { Message, MessageContent, MessageHeader } from "@/components/ui/message"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { DIETARY_PATH } from "@/features/dietary/dietary"
import {
  messageProposals,
  messageCannotPropose,
  messageText,
  type MealPlannerChat,
  type Proposal,
  type ProposalStatus,
} from "@/features/meal-plan/hooks/use-meal-planner-chat"
import {
  DAY_LABELS,
  SECTION_LABELS,
  type MealSection,
  type Weekday,
} from "@/features/meal-plan/meal-plan"
import { LogoMark } from "@/features/shared/components/wordmark"

const UNSAFE_ELEMENTS = ["img", "a"]
const MAX_PLANNER_MESSAGE_LENGTH = 4000
const SUGGESTIONS = [
  "Lên thực đơn 7 ngày",
  "Mỗi bữa nấu trong 30 phút",
  "Tận dụng nguyên liệu đang có",
  "Hỏi về nguyên liệu và dinh dưỡng",
] as const

export type MealAskContext = { title: string; day: Weekday; section: MealSection }

function looksLikePlanRequest(text: string) {
  return /^(?:(?:hãy|giúp\s+(?:tôi|mình)|(?:tôi|mình)\s+muốn)\s+)?(?:lên|lập|tạo|xây|gợi\s+ý)\s+(?:một\s+)?thực\s+đơn\b|^cho\s+(?:tôi|mình)\s+(?:một\s+)?thực\s+đơn\b/iu.test(text)
}

function looksLikeMealChange(text: string) {
  return /^(?:(?:hãy|(?:tôi|mình)\s+muốn)\s+)?(?:đổi|thay|đề\s+xuất\s+món\s+khác|gợi\s+ý\s+món\s+khác)\b/iu.test(text)
}

function profileLine(savedAvoided: string[], savedLiked: string[]) {
  const avoided = savedAvoided.length ? savedAvoided.join(", ") : "chưa khai báo"
  const liked = savedLiked.length ? ` Nguyên liệu tôi thích: ${savedLiked.join(", ")}.` : ""
  return `Hồ sơ ăn uống của tôi: thực phẩm không ăn: ${avoided}.${liked}`
}

function AssistantMessage({ children }: { children: ReactNode }) {
  return (
    <Message>
      <MessageContent>
        <MessageHeader>
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <LogoMark className="size-6" /> Trợ lý Vedora
          </span>
        </MessageHeader>
        {children}
      </MessageContent>
    </Message>
  )
}

export function PlannerChat({
  chat,
  onStage,
  openPlan,
  savedAvoided = [],
  savedLiked = [],
  profileLoading = false,
  profileError = false,
  askContext,
  prefill,
  clearAskContext,
  onOpenPlanner,
  onFormSent,
}: {
  chat: MealPlannerChat
  onStage: (proposal: Proposal) => void
  openPlan: () => void
  savedAvoided?: string[]
  savedLiked?: string[]
  profileLoading?: boolean
  profileError?: boolean
  askContext?: MealAskContext | null
  prefill?: { text: string; nonce: number; fromForm?: boolean } | null
  clearAskContext?: () => void
  onOpenPlanner: (seed?: string) => void
  onFormSent?: () => void
}) {
  const { messages, busy, waiting, working, researching, streamingId, error, send, reset } = chat
  const [input, setInput] = useState("")
  const [inputError, setInputError] = useState("")
  const [profileOpen, setProfileOpen] = useState(false)
  const [useProfile, setUseProfile] = useState(true)
  const end = useRef<HTMLDivElement>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const lastPrefillNonce = useRef<number | null>(null)
  const fromForm = useRef(false)
  const pending = useRef<string | null>(null)
  const pendingAfterCount = useRef<number | null>(null)
  const showSuggestions = messages.length === 1 && !busy && !error
  const latestProposal = messages.flatMap(messageProposals).at(-1)
  const hasPendingProposal = latestProposal && !chat.statuses[latestProposal.id]

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" })
  }, [messages, waiting])

  useEffect(() => {
    if (!prefill || prefill.nonce === lastPrefillNonce.current) return
    lastPrefillNonce.current = prefill.nonce
    fromForm.current = Boolean(prefill.fromForm)
    setInput(prefill.text)
    requestAnimationFrame(() => textarea.current?.focus())
  }, [prefill])

  useEffect(() => {
    if (error && pending.current && !input.trim()) {
      setInput(pending.current)
    }
    if (!busy && !error && pending.current && pendingAfterCount.current !== null && messages.length > pendingAfterCount.current && messages.at(-1)?.role === "assistant") {
      pending.current = null
      pendingAfterCount.current = null
      fromForm.current = false
      clearAskContext?.()
    }
  }, [busy, error, messages, input, clearAskContext])

  function chooseSuggestion(index: number) {
    if (index === 3) {
      setInput("Mình muốn hỏi về nguyên liệu và dinh dưỡng.")
      requestAnimationFrame(() => textarea.current?.focus())
      return
    }
    onOpenPlanner(SUGGESTIONS[index])
  }

  function sendQuestion(payload: string, original: string) {
    pending.current = original
    pendingAfterCount.current = messages.length
    setInput("")
    setInputError("")
    send(payload)
    if (fromForm.current) onFormSent?.()
  }

  function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    if (busy) return
    const text = input.trim()
    if (!text) {
      setInputError("Nhập câu hỏi")
      return
    }
    if (text.length > MAX_PLANNER_MESSAGE_LENGTH) {
      setInputError(`Tin nhắn tối đa ${MAX_PLANNER_MESSAGE_LENGTH} ký tự`)
      return
    }
    if (looksLikePlanRequest(text) && !fromForm.current) {
      onOpenPlanner(text)
      setInput("")
      setInputError("")
      return
    }
    const context = askContext
      ? `Về món ${askContext.title} ở ${DAY_LABELS[askContext.day]}, bữa ${SECTION_LABELS[askContext.section].toLowerCase()}: `
      : ""
    const includeProfile = !fromForm.current && (useProfile || looksLikeMealChange(text))
    const payload = `${context}${text}${includeProfile ? `\n\n${profileLine(savedAvoided, savedLiked)}` : ""}`
    if (payload.length > MAX_PLANNER_MESSAGE_LENGTH) {
      setInputError(`Tin nhắn cùng ngữ cảnh hồ sơ tối đa ${MAX_PLANNER_MESSAGE_LENGTH} ký tự. Hãy rút ngắn nội dung.`)
      return
    }
    sendQuestion(payload, text)
  }

  return (
    <div className="flex h-[calc(100dvh-9rem)] min-h-[24rem] min-w-0 flex-col bg-background sm:h-[calc(100dvh-5rem)] lg:h-full">
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3 sm:px-5">
        <span className="flex size-10 items-center justify-center rounded-2xl bg-secondary"><LogoMark className="size-7" /></span>
        <div className="min-w-0">
          <h2 className="font-heading text-base font-bold leading-tight">Trợ lý Vedora</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Cùng bạn chọn món và lên thực đơn</p>
        </div>
      </header>

      <div className="shrink-0 border-b border-border bg-card px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between gap-2">
          <button type="button" aria-expanded={profileOpen} onClick={() => setProfileOpen((value) => !value)} className="inline-flex items-center gap-2 rounded-md text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/30">
            Hồ sơ ăn uống {profileOpen ? <ChevronUpIcon aria-hidden className="size-4" /> : <ChevronDownIcon aria-hidden className="size-4" />}
          </button>
          <Link href={DIETARY_PATH} className="text-xs font-semibold text-primary underline-offset-4 hover:underline focus-visible:underline">Xem hồ sơ</Link>
        </div>
        {profileOpen && (
          <div className="mt-3 space-y-2 text-xs leading-5">
            {profileLoading ? (
              <p role="status" className="text-muted-foreground">Đang tải hồ sơ ăn uống…</p>
            ) : profileError ? (
              <p role="alert" className="text-destructive">Chưa tải được hồ sơ ăn uống.</p>
            ) : (
              <>
                <p><span className="font-semibold">Không ăn:</span> {savedAvoided.length > 0 ? savedAvoided.join(", ") : "Chưa khai báo"}</p>
                <p><span className="font-semibold">Thích:</span> {savedLiked.length > 0 ? savedLiked.join(", ") : "Chưa chọn"}</p>
              </>
            )}
            <label className="flex items-center justify-between gap-3 border-t border-border pt-2">
              <span>Dùng hồ sơ ăn uống khi trò chuyện</span>
              <Switch checked={useProfile} onCheckedChange={setUseProfile} aria-label="Dùng hồ sơ ăn uống khi trò chuyện" size="sm" />
            </label>
          </div>
        )}
      </div>

      <div aria-label="Cuộc trò chuyện" aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5">
        {messages.map((message) => {
          const text = messageText(message)
          const proposals = messageProposals(message)
          const cannotPropose = messageCannotPropose(message)
          if (!text && proposals.length === 0 && !cannotPropose) return null
          return message.role === "assistant" ? (
            <AssistantMessage key={message.id}>
              {text && <Bubble variant="ghost"><BubbleContent><Streamdown caret="block" isAnimating={message.id === streamingId} controls={false} disallowedElements={UNSAFE_ELEMENTS} unwrapDisallowed>{text}</Streamdown></BubbleContent></Bubble>}
              {proposals.map((proposal) => (
                <ProposalCard key={proposal.id} proposal={proposal} status={chat.statuses[proposal.id]} superseded={proposal.id !== chat.latestProposalId} onStage={onStage} onDismiss={() => chat.setProposalStatus(proposal.id, "dismissed")} openPlan={openPlan} />
              ))}
              {cannotPropose && !text && <p role="status" className="mt-2 rounded-xl border border-border bg-card px-3 py-2 text-sm">Chưa tìm được đủ món phù hợp với yêu cầu này. Bạn có thể chỉnh yêu cầu và thử lại.</p>}
            </AssistantMessage>
          ) : (
            <Message key={message.id} align="end"><MessageContent><Bubble align="end"><BubbleContent>{text}</BubbleContent></Bubble></MessageContent></Message>
          )
        })}
        {waiting && <AssistantMessage><span className="shimmer text-sm text-muted-foreground motion-reduce:shimmer-none">{researching ? "Đang tra cứu tài liệu…" : working ? "Đang chọn món và kiểm tra thực đơn…" : "Đang suy nghĩ…"}</span></AssistantMessage>}
        {error && <AssistantMessage><div role="alert" className="space-y-2 text-sm text-destructive"><p>{error} Tin nhắn vẫn ở ô nhập để bạn thử lại.</p><Button variant="outline" size="sm" onClick={() => submit()} disabled={!input.trim() || busy}><RotateCcwIcon aria-hidden /> Thử lại</Button></div></AssistantMessage>}

        {showSuggestions && <BubbleGroup aria-label="Gợi ý">{SUGGESTIONS.map((suggestion, index) => <Bubble key={suggestion} variant="outline"><BubbleContent render={<button type="button" />} onClick={() => chooseSuggestion(index)}>{suggestion}</BubbleContent></Bubble>)}</BubbleGroup>}

        {hasPendingProposal && <Button variant="outline" size="sm" className="self-start lg:hidden" onClick={openPlan}>Xem đề xuất <ArrowRightIcon aria-hidden /></Button>}
        <div ref={end} aria-hidden className="h-px shrink-0" />
      </div>

      <div className="z-10 shrink-0 border-t border-border bg-card/95 px-4 py-3 shadow-[0_-8px_22px_rgba(20,38,26,0.04)] backdrop-blur-lg sm:px-5">
        {askContext && <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs text-primary"><span className="truncate">{DAY_LABELS[askContext.day]} · {SECTION_LABELS[askContext.section]} · {askContext.title}</span><button type="button" aria-label="Bỏ món đính kèm" onClick={clearAskContext} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"><XIcon aria-hidden className="size-3.5" /></button></div>}
        <form onSubmit={submit}>
          <InputGroup>
            <InputGroupTextarea ref={textarea} value={input} onChange={(event) => { setInput(event.target.value); setInputError("") }} aria-label="Tin nhắn cho trợ lý" aria-invalid={Boolean(inputError)} placeholder="Hỏi về món chay hoặc yêu cầu đổi món…" maxLength={MAX_PLANNER_MESSAGE_LENGTH} rows={1} className="max-h-32 min-h-12" onKeyDown={(event) => { if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return; event.preventDefault(); submit() }} />
            <InputGroupAddon align="inline-end"><InputGroupButton type="submit" size="icon-sm" variant="default" aria-label="Gửi" disabled={busy || !input.trim()}>{busy ? <Spinner aria-hidden /> : <ArrowUpIcon aria-hidden />}</InputGroupButton></InputGroupAddon>
          </InputGroup>
          {inputError && <p role="alert" className="mt-1 text-xs text-destructive">{inputError}</p>}
        </form>
        <div className="mt-2 flex items-center justify-between gap-3"><p className="text-[0.6875rem] leading-4 text-muted-foreground">Đề xuất chỉ thay đổi thực đơn khi bạn lưu.</p>{messages.length > 1 && <Button variant="ghost" size="xs" onClick={() => { reset(); setInput(""); pending.current = null; pendingAfterCount.current = null; fromForm.current = false }}><RotateCcwIcon aria-hidden /> Bắt đầu lại</Button>}</div>
      </div>
    </div>
  )
}

function ProposalCard({ proposal, status, superseded, onStage, onDismiss, openPlan }: {
  proposal: Proposal
  status: ProposalStatus | undefined
  superseded: boolean
  onStage: (proposal: Proposal) => void
  onDismiss: () => void
  openPlan: () => void
}) {
  const titles = (recipes: { title: string }[]) => recipes.map(({ title }) => title).join(", ")
  const changedDays = proposal.days
    .map(({ day, sections }) => ({
      day,
      sections: sections.filter(({ recipes, previous }) =>
        recipes.map(({ id }) => id).join() !== previous.map(({ id }) => id).join()
      ),
    }))
    .filter(({ sections }) => sections.length > 0)
  const changed = changedDays.flatMap(({ sections }) => sections)
  return (
    <article aria-label="Đề xuất thực đơn" className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3">
      <h3 className="text-sm font-semibold">
        {changed.length === 0
          ? "Thực đơn hiện tại đã giống đề xuất"
          : changedDays.length === 7
            ? "Thực đơn đề xuất cho cả tuần"
            : `Thực đơn đề xuất cho ${changedDays.map(({ day }) => DAY_LABELS[day]).join(", ")}`}
      </h3>
      {changedDays.map(({ day, sections }) => (
        <section key={day} className="mt-3 border-t border-border pt-2.5">
          <h4 className="text-xs font-semibold text-muted-foreground">{DAY_LABELS[day]}</h4>
          <dl className="mt-1 text-sm leading-6">
            {sections.map(({ section, recipes, previous }) => (
              <div key={section} className="flex gap-3">
                <dt className="w-10 shrink-0 text-muted-foreground">{SECTION_LABELS[section]}</dt>
                <dd className="min-w-0">
                  {recipes.length > 0 ? titles(recipes) : <span className="text-muted-foreground">Để trống</span>}
                  {previous.length > 0 && (
                    <span className="text-muted-foreground"> · thay {titles(previous)}</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      {status === "saved" ? <p role="status" className="mt-3 text-sm text-primary">Đã lưu vào thực đơn.</p> : status === "staged" ? <div className="mt-3 flex flex-wrap items-center gap-2"><p role="status" className="text-sm">Đã thêm vào bản nháp, chưa lưu.</p><Button variant="link" size="sm" onClick={openPlan}>Xem bản nháp</Button></div> : status === "dismissed" ? <p role="status" className="mt-3 text-sm text-muted-foreground">Đã bỏ đề xuất.</p> : superseded ? <p className="mt-3 text-sm text-muted-foreground">Đã có đề xuất mới hơn.</p> : changed.length > 0 ? <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" onClick={() => onStage(proposal)}>Áp dụng vào bản nháp</Button><Button variant="outline" size="sm" onClick={onDismiss}>Bỏ đề xuất</Button></div> : null}
    </article>
  )
}
