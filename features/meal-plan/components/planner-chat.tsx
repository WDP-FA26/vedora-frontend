"use client"

import { useEffect, useImperativeHandle, useRef, useState, type FormEvent, type ReactNode, type Ref } from "react"
import Link from "next/link"
import { Streamdown } from "streamdown"
import {
  ArrowUpIcon,
  AudioLinesIcon,
  CalendarCheckIcon,
  CheckIcon,
  GlobeIcon,
  HistoryIcon,
  MapPinIcon,
  MessageSquarePlusIcon,
  NavigationIcon,
  RotateCcwIcon,
  SparklesIcon,
  SquareIcon,
  StarIcon,
  Trash2Icon,
  Undo2Icon,
  UtensilsIcon,
  XIcon,
} from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Bubble, BubbleContent, BubbleGroup } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { Message, MessageContent, MessageHeader } from "@/components/ui/message"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Spinner } from "@/components/ui/spinner"
import { DIETARY_PATH } from "@/features/dietary/dietary"
import {
  messagePlanChanges,
  messageProfileNoteUpdates,
  messageQuestions,
  messageRestaurantDishes,
  messageText,
  type MealPlannerChat,
  type PlanChangeEntry,
  type PlannerRestaurantDish,
  type ProfileNoteUpdate,
  type UserQuestion,
} from "@/features/meal-plan/hooks/use-meal-planner-chat"
import {
  DAY_LABELS,
  SECTION_LABELS,
  weekStartRangeLabel,
  type MealPlanProblem,
  type MealSection,
  type Weekday,
} from "@/features/meal-plan/meal-plan"
import { profilePath } from "@/features/profiles/profiles-cache"
import { AgentTrace, hasTrace, MessageSources } from "@/features/shared/components/agent-trace"
import { LogoMark } from "@/features/shared/components/wordmark"
import { formatPriceVnd, formatRatingScore } from "@/features/workspaces/lib/format"
import { cn } from "@/lib/utils"

function formatThreadTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const UNSAFE_ELEMENTS = ["img", "a"]
const MAX_PLANNER_MESSAGE_LENGTH = 4000
const SUGGESTIONS = [
  "Lên thực đơn 7 ngày hợp BMI của mình",
  "Trưa nay lỡ ăn ngoài hơi nhiều, tối đổi món nhẹ",
  "Kiểm tra tuần này đã đủ Đạm, Sắt, Canxi chưa",
  "Gợi ý vài món chay ngoài quán thanh đạm, giàu đạm thực vật",
] as const

/** Lets the page send a written request as if the user had typed it, keeping retry working. */
export type PlannerChatHandle = { ask: (text: string) => void }

export type MealAskContext = { title: string; day: Weekday; section: MealSection }

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
  savedAvoided = [],
  profileLoading = false,
  profileError = false,
  askContext,
  clearAskContext,
  onOpenWeek,
  onStartVoice,
  voiceDisabled = false,
  leading,
  trailing,
  handle,
}: {
  handle?: Ref<PlannerChatHandle>
  /** Shown before the logo, e.g. a back button. */
  leading?: ReactNode
  /** Shown at the end of the header, e.g. a collapse button. */
  trailing?: ReactNode
  chat: MealPlannerChat
  savedAvoided?: string[]
  profileLoading?: boolean
  profileError?: boolean
  askContext?: MealAskContext | null
  clearAskContext?: () => void
  /** Shows a week the assistant changed on the calendar. */
  onOpenWeek?: (weekStart: string) => void
  /** Starts a live voice conversation from the chat composer. */
  onStartVoice?: () => void
  voiceDisabled?: boolean
}) {
  const { messages, busy, waiting, pendingId, streamingId, error, send, reset } = chat
  const [input, setInput] = useState("")
  const [inputError, setInputError] = useState("")
  const [historyOpen, setHistoryOpen] = useState(false)
  /** The user message the rewind dialog asks about. */
  const [rewindTarget, setRewindTarget] = useState<string | null>(null)
  const [rewindNotice, setRewindNotice] = useState<string | null>(null)
  /** A message typed while the assistant was still working; it goes out when the turn ends. */
  const [queued, setQueued] = useState<{ payload: string; original: string } | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const pending = useRef<string | null>(null)
  const pendingAfterCount = useRef<number | null>(null)
  const showSuggestions = messages.length === 1 && !busy && !error && !chat.loadingThreadId

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" })
  }, [messages, waiting])

  useEffect(() => {
    if (askContext) {
      requestAnimationFrame(() => textarea.current?.focus())
    }
  }, [askContext])

  useEffect(() => {
    if (error && pending.current && !input.trim()) {
      setInput(pending.current)
    }
    if (!busy && !error && pending.current && pendingAfterCount.current !== null && messages.length > pendingAfterCount.current && messages.at(-1)?.role === "assistant") {
      pending.current = null
      pendingAfterCount.current = null
      clearAskContext?.()
    }
  }, [busy, error, messages, input, clearAskContext])

  // Sends the queued message once the turn ends; the timer keeps a re-render from sending it twice.
  useEffect(() => {
    if (busy || error || !queued) return
    const timer = setTimeout(() => {
      setQueued(null)
      sendQuestion(queued.payload, queued.original)
    }, 0)
    return () => clearTimeout(timer)
  }, [busy, error, queued, sendQuestion])

  function chooseSuggestion(index: number) {
    sendQuestion(SUGGESTIONS[index], SUGGESTIONS[index])
  }

  function sendQuestion(payload: string, original: string) {
    setRewindNotice(null)
    pending.current = original
    pendingAfterCount.current = messages.length
    setInput("")
    setInputError("")
    send(payload)
  }

  useImperativeHandle(handle, () => ({
    ask: (text: string) => {
      if (busy) {
        setInput(text)
        return
      }
      sendQuestion(text, text)
    },
  }))

  function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    // The assistant plans one week, so it waits until the week on screen has loaded.
    if (!chat.weekStart) return
    const text = input.trim()
    if (!text) {
      setInputError("Nhập câu hỏi")
      return
    }
    if (text.length > MAX_PLANNER_MESSAGE_LENGTH) {
      setInputError(`Tin nhắn tối đa ${MAX_PLANNER_MESSAGE_LENGTH} ký tự`)
      return
    }
    const context = askContext
      ? `Về món ${askContext.title} ở ${DAY_LABELS[askContext.day]}, bữa ${SECTION_LABELS[askContext.section].toLowerCase()}: `
      : ""
    // The API reads the saved dietary profile itself on every turn, so the
    // question goes out as typed instead of carrying the profile along.
    const payload = `${context}${text}`
    if (payload.length > MAX_PLANNER_MESSAGE_LENGTH) {
      setInputError(`Tin nhắn tối đa ${MAX_PLANNER_MESSAGE_LENGTH} ký tự. Hãy rút ngắn nội dung.`)
      return
    }
    if (busy) {
      // Like Claude Code: keep typing while the assistant works; this goes out next.
      setQueued({ payload, original: text })
      setInput("")
      setInputError("")
      return
    }
    sendQuestion(payload, text)
  }

  async function confirmRewind() {
    const target = rewindTarget
    setRewindTarget(null)
    if (!target) return
    const result = await chat.rewind(target)
    if (!result) return
    pending.current = null
    pendingAfterCount.current = null
    setInputError("")
    setInput(result.text)
    setRewindNotice(rewindSummary(result.weeks))
    requestAnimationFrame(() => textarea.current?.focus())
  }

  function handleNewThread() {
    reset()
    setRewindNotice(null)
    setInput("")
    setInputError("")
    pending.current = null
    pendingAfterCount.current = null
  }

  async function handleSelectThread(id: string) {
    setInput("")
    setInputError("")
    pending.current = null
    pendingAfterCount.current = null
    setHistoryOpen(false)
    await chat.selectThread(id)
  }

  let avoidedSummary = "Chưa khai báo"
  if (profileLoading) avoidedSummary = "Đang tải…"
  else if (profileError) avoidedSummary = "Chưa tải được hồ sơ"
  else if (savedAvoided.length > 0) avoidedSummary = savedAvoided.join(", ")

  return (
    <div className="flex h-[calc(100dvh-4.5rem)] min-h-[24rem] min-w-0 flex-col bg-background lg:h-full">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-card px-3 sm:px-4">
        {leading}
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-secondary"><LogoMark className="size-7" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-base font-bold leading-tight">Trợ lý Vedora</h2>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {chat.activeThread ? chat.activeThread.title : "Cùng bạn chọn món và lên thực đơn"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Lịch sử đoạn chat"
          title="Lịch sử đoạn chat"
          onClick={() => setHistoryOpen(true)}
        >
          <HistoryIcon aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Đoạn chat mới"
          title="Đoạn chat mới"
          onClick={handleNewThread}
        >
          <MessageSquarePlusIcon aria-hidden />
        </Button>
        {trailing}
      </header>

      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-2 text-xs sm:px-5">
        <p className="min-w-0 truncate text-muted-foreground" title={avoidedSummary}>
          <span className="font-semibold text-foreground">Kiêng/Dị ứng:</span> {avoidedSummary}
        </p>
        <Link
          href={DIETARY_PATH}
          className="shrink-0 font-semibold text-primary underline-offset-4 hover:underline focus-visible:underline"
        >
          Chỉnh hồ sơ
        </Link>
      </div>

      <div aria-label="Cuộc trò chuyện" aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-4 py-5 sm:px-5">
        {chat.loadingThreadId && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner aria-hidden /> Đang tải lịch sử đoạn chat…
          </p>
        )}
        {messages.map((message) => {
          const text = messageText(message)
          const changes = messagePlanChanges(message)
          const questions = messageQuestions(message)
          const restaurantDishes = messageRestaurantDishes(message)
          const noteUpdates = messageProfileNoteUpdates(message)
          const pending = message.id === pendingId
          if (
            !text &&
            changes.length === 0 &&
            questions.length === 0 &&
            restaurantDishes.length === 0 &&
            noteUpdates.length === 0 &&
            !pending &&
            !hasTrace(message)
          ) {
            return null
          }
          if (message.role !== "assistant") {
            return (
              <UserMessage
                key={message.id}
                text={text}
                canRewind={!busy && chat.rewindingId === null}
                rewinding={chat.rewindingId === message.id}
                onRewind={() => setRewindTarget(message.id)}
              />
            )
          }
          return (
            <AssistantMessage key={message.id}>
              <AgentTrace message={message} pending={pending} />
              {text && <Bubble variant="ghost"><BubbleContent><Streamdown caret="block" isAnimating={message.id === streamingId} controls={false} disallowedElements={UNSAFE_ELEMENTS} unwrapDisallowed>{text}</Streamdown></BubbleContent></Bubble>}
              {changes.map((change) => (
                <PlanChangeCard
                  key={change.id}
                  change={change}
                  currentWeek={chat.weekStart}
                  onShowWeek={onOpenWeek}
                />
              ))}
              {noteUpdates.map((update) => (
                <ProfileNoteCard key={update.id} update={update} />
              ))}
              {!pending && restaurantDishes.length > 0 && (
                <RestaurantDishCards dishes={restaurantDishes} />
              )}
              {!pending && message.id !== streamingId && <MessageSources message={message} />}
              {questions.map((question) => (
                <QuestionCard
                  key={question.toolCallId}
                  question={question}
                  open={chat.openQuestion?.toolCallId === question.toolCallId}
                  disabled={busy || !chat.weekStart}
                  onAnswer={(answer) => {
                    setRewindNotice(null)
                    chat.answerQuestion(question.toolCallId, answer)
                  }}
                />
              ))}
              {chat.openWebSearchRequest && message.id === messages.at(-1)?.id && (
                <WebSearchConsent
                  reason={chat.openWebSearchRequest.reason}
                  disabled={busy || !chat.weekStart}
                  onAnswer={(approved) => {
                    const request = chat.openWebSearchRequest
                    if (request) chat.answerWebSearch(request.toolCallId, approved)
                  }}
                />
              )}
            </AssistantMessage>
          )
        })}
        {chat.historyError && !historyOpen && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{chat.historyError}</p>}
        {rewindNotice && <p role="status" className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground">{rewindNotice}</p>}
        {waiting && !pendingId && <AssistantMessage><span className="shimmer text-sm text-muted-foreground motion-reduce:shimmer-none">Đang suy nghĩ…</span></AssistantMessage>}
        {error && <AssistantMessage><div role="alert" className="space-y-2 text-sm text-destructive"><p>{error} Tin nhắn vẫn ở ô nhập để bạn thử lại.</p><Link href="/billing" target="_blank" rel="noopener noreferrer" className="inline-block text-primary underline underline-offset-4">Xem gói và hạn mức AI</Link><Button variant="outline" size="sm" onClick={() => submit()} disabled={!input.trim() || busy}><RotateCcwIcon aria-hidden /> Thử lại</Button></div></AssistantMessage>}

        {showSuggestions && <BubbleGroup aria-label="Gợi ý">{SUGGESTIONS.map((suggestion, index) => <Bubble key={suggestion} variant="outline"><BubbleContent render={<button type="button" />} onClick={() => chooseSuggestion(index)}>{suggestion}</BubbleContent></Bubble>)}</BubbleGroup>}
        <div ref={end} aria-hidden className="h-px shrink-0" />
      </div>

      <div className="z-10 shrink-0 border-t border-border bg-card/95 px-4 py-3 shadow-[0_-8px_22px_rgba(20,38,26,0.04)] backdrop-blur-lg sm:px-5">
        {askContext && <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs text-primary"><span className="truncate">{DAY_LABELS[askContext.day]} · {SECTION_LABELS[askContext.section]} · {askContext.title}</span><button type="button" aria-label="Bỏ món đính kèm" onClick={clearAskContext} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"><XIcon aria-hidden className="size-3.5" /></button></div>}
        {queued && (
          <div role="status" className="mb-2 flex max-w-full items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
            <span className="min-w-0 flex-1 truncate">
              Sẽ gửi khi trợ lý xong: <span className="text-foreground">{queued.original}</span>
            </span>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                setInput(queued.original)
                setQueued(null)
              }}
            >
              Sửa
            </Button>
          </div>
        )}
        <form onSubmit={submit}>
          <InputGroup>
            <InputGroupTextarea ref={textarea} value={input} onChange={(event) => { setInput(event.target.value); setInputError("") }} aria-label="Tin nhắn cho trợ lý" aria-invalid={Boolean(inputError)} placeholder="Hỏi về món chay hoặc yêu cầu đổi món…" maxLength={MAX_PLANNER_MESSAGE_LENGTH} rows={1} className="max-h-32 min-h-12" onKeyDown={(event) => { if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return; event.preventDefault(); submit() }} />
            <InputGroupAddon align="inline-end">{busy && !input.trim() ? (
                <InputGroupButton type="button" size="icon-sm" variant="default" aria-label="Dừng" title="Dừng" onClick={chat.stop}>
                  <SquareIcon aria-hidden />
                </InputGroupButton>
              ) : !busy && !input.trim() && onStartVoice ? (
                <InputGroupButton
                  type="button"
                  size="sm"
                  shape="pill"
                  variant="default"
                  aria-label="Trò chuyện bằng giọng nói"
                  title="Trò chuyện bằng giọng nói"
                  disabled={voiceDisabled}
                  onClick={onStartVoice}
                >
                  <AudioLinesIcon aria-hidden />
                  <span>Nói</span>
                </InputGroupButton>
              ) : (
                <InputGroupButton type="submit" size="icon-sm" variant="default" aria-label={busy ? "Gửi sau khi trợ lý xong" : "Gửi"} disabled={!chat.weekStart || !input.trim()}>
                  <ArrowUpIcon aria-hidden />
                </InputGroupButton>
              )}</InputGroupAddon>
          </InputGroup>
          {inputError && <p role="alert" className="mt-1 text-xs text-destructive">{inputError}</p>}
        </form>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[0.6875rem] leading-4 text-muted-foreground">
          <p>Đề xuất chỉ thay đổi thực đơn khi bạn lưu.</p>
          {chat.webSearchAllowed && (
            <p title="Bạn đã cho phép trợ lý tìm trên web trong đoạn chat này" className="flex items-center gap-1">
              <GlobeIcon aria-hidden className="size-3 shrink-0" /> Được tìm trên web
            </p>
          )}
        </div>
      </div>

      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="left" className="w-full sm:max-w-sm">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-border pr-8">
              <SheetHeader>
                <SheetTitle>Lịch sử đoạn chat</SheetTitle>
                <SheetDescription>Xem lại hoặc tiếp tục các cuộc trò chuyện trước</SheetDescription>
                <div className="pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      handleNewThread()
                      setHistoryOpen(false)
                    }}
                  >
                    <MessageSquarePlusIcon aria-hidden /> Đoạn chat mới
                  </Button>
                </div>
              </SheetHeader>
            </div>

            {chat.historyError && (
              <p role="alert" className="border-b border-border px-4 py-2 text-xs text-destructive">
                {chat.historyError}
              </p>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {chat.threadsLoading && chat.threads.length === 0 ? (
                <p role="status" className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
                  <Spinner aria-hidden /> Đang tải lịch sử đoạn chat…
                </p>
              ) : chat.threads.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Chưa có lịch sử đoạn chat nào. Hãy gửi tin nhắn đầu tiên để bắt đầu.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {chat.threads.map((thread) => {
                    const isActive = thread.id === chat.threadId
                    const isDeleting = chat.deletingThreadId === thread.id
                    const isLoading = chat.loadingThreadId === thread.id
                    return (
                      <li
                        key={thread.id}
                        className={cn(
                          "flex items-start gap-2 border-b border-border px-4 py-3 transition-colors",
                          isActive ? "bg-secondary/50" : "hover:bg-muted/40"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => void handleSelectThread(thread.id)}
                          disabled={isLoading || isDeleting}
                          className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-foreground">
                              {thread.title}
                            </span>
                            {isActive && <Badge variant="secondary">Đang mở</Badge>}
                            {isLoading && <Spinner aria-hidden />}
                          </div>
                          {thread.lastMessagePreview && (
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {thread.lastMessagePreview}
                            </p>
                          )}
                          <p className="mt-1.5 text-[0.6875rem] text-muted-foreground">
                            {thread.messageCount} tin nhắn · {formatThreadTime(thread.lastMessageAt)}
                          </p>
                        </button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Xóa đoạn chat ${thread.title}`}
                          disabled={isDeleting}
                          onClick={() => void chat.removeThread(thread.id)}
                        >
                          {isDeleting ? <Spinner aria-hidden /> : <Trash2Icon aria-hidden />}
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={rewindTarget !== null} onOpenChange={(open) => { if (!open) setRewindTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quay lại trước tin nhắn này?</AlertDialogTitle>
            <AlertDialogDescription>
              Thực đơn trở về như trước khi bạn gửi tin nhắn này, và tin nhắn này cùng mọi tin sau nó sẽ bị xóa khỏi đoạn chat. Nội dung tin nhắn được đưa lại vào ô nhập để bạn sửa và gửi lại.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmRewind()}>Quay lại</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/** What a rewind put back, in one sentence. */
function rewindSummary(weeks: { weekStart: string; restored: Weekday[]; skipped: Weekday[]; droppedDishes: number }[]) {
  let restored = 0
  let dropped = 0
  const skipped: string[] = []
  for (const week of weeks) {
    restored += week.restored.length
    dropped += week.droppedDishes
    for (const day of week.skipped) skipped.push(`${DAY_LABELS[day]} (tuần ${weekStartRangeLabel(week.weekStart)})`)
  }
  let summary = "Đã quay lại. Thực đơn không có thay đổi nào cần khôi phục."
  if (restored > 0) summary = `Đã quay lại và khôi phục thực đơn của ${restored} ngày.`
  if (skipped.length > 0) summary += ` ${skipped.join(", ")} đã qua nên giữ nguyên.`
  if (dropped > 0) summary += ` ${dropped} món cũ đã bị xóa hoặc nay nằm trong danh sách kiêng nên không thêm lại.`
  return summary
}

function UserMessage({ text, canRewind, rewinding, onRewind }: {
  text: string
  canRewind: boolean
  rewinding: boolean
  onRewind: () => void
}) {
  return (
    <Message align="end" className="group/user">
      <MessageContent>
        <Bubble align="end"><BubbleContent>{text}</BubbleContent></Bubble>
        <div
          data-rewinding={rewinding}
          className="flex justify-end opacity-0 transition-opacity group-hover/user:opacity-100 focus-within:opacity-100 data-[rewinding=true]:opacity-100 max-lg:opacity-100 motion-reduce:transition-none"
        >
          <Button
            variant="ghost"
            size="xs"
            disabled={!canRewind}
            onClick={onRewind}
            aria-label="Quay lại trước tin nhắn này"
          >
            {rewinding ? <Spinner aria-hidden /> : <Undo2Icon aria-hidden />}
            Quay lại
          </Button>
        </div>
      </MessageContent>
    </Message>
  )
}

/** Asks before the assistant may search the web, and says why web answers need checking. */
function WebSearchConsent({ reason, disabled, onAnswer }: {
  reason: string
  disabled: boolean
  onAnswer: (approved: boolean) => void
}) {
  return (
    <section aria-label="Xin phép tìm trên web" className="mt-2 flex flex-col gap-3 rounded-xl border border-border bg-card p-3 text-sm">
      <div className="flex items-start gap-2">
        <GlobeIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-semibold">Trợ lý muốn tìm thêm trên web</p>
          <p className="text-muted-foreground">{reason}</p>
        </div>
      </div>
      <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
        Thông tin trên web có thể sai, đã cũ hoặc không thống nhất giữa các nguồn, và Vedora không kiểm chứng. Trợ lý sẽ ghi rõ phần nào lấy từ web và kèm nguồn để bạn xem lại. Món trong thực đơn vẫn chỉ lấy từ Vedora.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={disabled} onClick={() => onAnswer(true)}>
          <CheckIcon aria-hidden /> Cho phép trong đoạn chat này
        </Button>
        <Button size="sm" variant="outline" disabled={disabled} onClick={() => onAnswer(false)}>
          <XIcon aria-hidden /> Không
        </Button>
      </div>
    </section>
  )
}

/** What the assistant saved to one week in this message, before and after. */
function leftOutLabel(problem: MealPlanProblem) {
  const day = DAY_LABELS[problem.day]
  if (problem.code === "UNKNOWN_RECIPE") return `${day}: món không còn trong kho`
  return `${day}: ${problem.recipes.join(", ")} (có ${problem.ingredients.join(", ")} bạn không ăn)`
}

/** The assistant rewrote the "Sở thích" or "Dị ứng" note in the dietary profile. */
function ProfileNoteCard({ update }: { update: ProfileNoteUpdate }) {
  const label = update.kind === "allergy" ? "Dị ứng" : "Sở thích"
  return (
    <article aria-label={`${label} đã cập nhật`} className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-start gap-2">
        <SparklesIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Đã cập nhật {label} trong hồ sơ</h3>
          <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{update.note ?? `Đã xoá hết mục ${label}.`}</p>
        </div>
        <Link href={DIETARY_PATH} className="shrink-0 text-xs font-semibold text-primary underline-offset-4 hover:underline">
          Chỉnh
        </Link>
      </div>
    </article>
  )
}

function PlanChangeCard({ change, currentWeek, onShowWeek }: {
  change: PlanChangeEntry
  /** The week on screen. */
  currentWeek: string | undefined
  /** Shows the change's week on the calendar. */
  onShowWeek?: (weekStart: string) => void
}) {
  const titles = (recipes: { title: string }[]) => recipes.map(({ title }) => title).join(", ")
  const clashes = change.problems.filter(({ code }) => code === "DAY_CONFLICT")
  const leftOut = change.problems.filter(({ code }) => code !== "DAY_CONFLICT")
  return (
    <article aria-label="Thực đơn đã cập nhật" className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-start gap-2">
        <CalendarCheckIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Đã cập nhật thực đơn</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Tuần {weekStartRangeLabel(change.weekStart)}{change.weekStart === currentWeek ? " · đang xem trên lịch" : ""}
          </p>
        </div>
        {onShowWeek && (
          <span className="shrink-0">
            <Button variant="link" size="xs" onClick={() => onShowWeek(change.weekStart)}>
              Xem lịch
            </Button>
          </span>
        )}
      </div>
      {change.days.map(({ day, sections }) => (
        <section key={day} className="mt-2.5 border-t border-border pt-2">
          <h4 className="text-xs font-semibold text-muted-foreground">{DAY_LABELS[day]}</h4>
          <dl className="mt-1 text-sm leading-6">
            {sections.map(({ section, recipes, previous }) => {
              const same = recipes.length === previous.length && recipes.every(({ id }, index) => id === previous[index].id)
              if (same) return null
              return (
                <div key={section} className="flex gap-3">
                  <dt className="w-10 shrink-0 text-muted-foreground">{SECTION_LABELS[section]}</dt>
                  <dd className="min-w-0">
                    {recipes.length > 0 ? titles(recipes) : <span className="text-muted-foreground">Để trống</span>}
                    {previous.length > 0 && <span className="text-muted-foreground"> · thay {titles(previous)}</span>}
                  </dd>
                </div>
              )
            })}
          </dl>
        </section>
      ))}
      {clashes.length > 0 && (
        <p className="mt-2 rounded-lg bg-amber-500/15 px-2.5 py-1.5 text-xs text-amber-800 dark:text-amber-300">
          Lưu ý: có món không nên ăn cùng ngày ({clashes.map(({ ingredients }) => ingredients.join(" + ")).join("; ")}).
        </p>
      )}
      {leftOut.length > 0 && (
        <p className="mt-2 rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
          Không thêm: {leftOut.map(leftOutLabel).join("; ")}.
        </p>
      )}
    </article>
  )
}

/** The assistant's question, with its options as buttons; only the newest one can still be answered. */
function QuestionCard({ question, open, disabled, onAnswer }: {
  question: UserQuestion
  open: boolean
  disabled: boolean
  onAnswer: (answer: string) => void
}) {
  const [picked, setPicked] = useState<string[]>([])
  const answered = question.answer !== undefined
  const canAnswer = open && !answered && !disabled

  function toggle(option: string) {
    setPicked((current) => (current.includes(option) ? current.filter((item) => item !== option) : [...current, option]))
  }

  function isChosen(option: string) {
    if (question.answer === undefined) return picked.includes(option)
    // A single answer is the option itself, which may contain ", " too.
    if (!question.multiple) return question.answer === option
    return question.answer.split(", ").includes(option)
  }

  return (
    <section aria-label="Câu hỏi của trợ lý" className="mt-2 flex w-full flex-col gap-2 rounded-xl border border-border bg-card p-3">
      <p className="text-sm font-semibold">{question.question}</p>
      <div className="flex flex-wrap gap-2">
        {question.options.map((option) => (
          <Button
            key={option}
            size="sm"
            variant={isChosen(option) ? "default" : "outline"}
            disabled={!canAnswer}
            aria-pressed={question.multiple ? isChosen(option) : undefined}
            onClick={() => (question.multiple ? toggle(option) : onAnswer(option))}
            className="h-auto min-h-8 max-w-full whitespace-normal text-left"
          >
            <span className="min-w-0 py-1.5 break-words">{option}</span>
          </Button>
        ))}
      </div>
      {question.multiple && canAnswer && (
        <Button size="sm" className="self-start" disabled={picked.length === 0} onClick={() => onAnswer(picked.join(", "))}>
          <CheckIcon aria-hidden /> Gửi lựa chọn
        </Button>
      )}
      {canAnswer && <p className="text-xs text-muted-foreground">Hoặc nhập câu trả lời khác ở ô bên dưới.</p>}
    </section>
  )
}

function RestaurantDishCards({ dishes }: { dishes: PlannerRestaurantDish[] }) {
  return (
    <section aria-label="Món gợi ý từ nhà hàng" className="mt-2 flex w-full flex-col gap-2">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <UtensilsIcon aria-hidden className="size-3.5" />
        Món từ nhà hàng trên Vedora
      </h3>
      <ul className="flex flex-col gap-2">
        {dishes.map((dish) => {
          const priceLabel = formatPriceVnd(dish.priceVnd)
          const menuHref = `${profilePath(dish.restaurant.pageUserId)}?tab=menu`
          const hasReviews =
            dish.restaurant.averageRating !== null && dish.restaurant.reviewCount > 0
          const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${dish.restaurant.name}, ${dish.restaurant.address}`)}`

          return (
            <li
              key={dish.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-card p-3"
            >
              {dish.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- external R2/S3 dish photo
                <img
                  src={dish.imageUrl}
                  alt={dish.name}
                  referrerPolicy="no-referrer"
                  className="size-14 shrink-0 rounded-lg border border-border object-cover"
                />
              ) : (
                <div className="flex size-14 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
                  <UtensilsIcon aria-hidden className="size-4" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Link href={menuHref} className="text-sm font-bold hover:underline">
                    {dish.name}
                  </Link>
                  {dish.category && <Badge variant="secondary">{dish.category}</Badge>}
                  {priceLabel && (
                    <span className="ml-auto text-xs font-semibold tabular-nums text-primary">
                      {priceLabel}
                    </span>
                  )}
                </div>

                {dish.avoidedMatches.length > 0 && (
                  <p className="mt-1 inline-block rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                    Lưu ý thành phần cần tránh: {dish.avoidedMatches.join(", ")}
                  </p>
                )}

                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <Link href={menuHref} className="font-medium text-foreground hover:underline">
                    {dish.restaurant.name}
                  </Link>
                  {hasReviews && dish.restaurant.averageRating !== null && (
                    <span className="inline-flex items-center gap-0.5 text-foreground">
                      <StarIcon aria-hidden className="size-3 fill-amber-400 text-amber-500" />
                      <span className="tabular-nums">
                        {formatRatingScore(dish.restaurant.averageRating)}
                      </span>
                      <span className="text-muted-foreground">
                        ({dish.restaurant.reviewCount})
                      </span>
                    </span>
                  )}
                </div>

                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <MapPinIcon aria-hidden className="size-3 shrink-0" />
                    <span className="truncate">{dish.restaurant.address}</span>
                  </span>
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
                  >
                    <NavigationIcon aria-hidden className="size-3" />
                    Chỉ đường
                  </a>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
