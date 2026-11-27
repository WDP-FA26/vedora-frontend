"use client"

import { useEffect, useImperativeHandle, useRef, useState, type FormEvent, type ReactNode, type Ref } from "react"
import Link from "next/link"
import { Streamdown } from "streamdown"
import {
  ArrowUpIcon,
  AudioLinesIcon,
  GlobeIcon,
  HistoryIcon,
  MessageSquarePlusIcon,
  RotateCcwIcon,
  SquareIcon,
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
import { Bubble, BubbleContent, BubbleGroup } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { DIETARY_PATH } from "@/features/dietary/dietary"
import { ChatHistorySheet } from "@/features/meal-plan/components/chat/chat-history-sheet"
import {
  AssistantMessage,
  rewindSummary,
  UserMessage,
} from "@/features/meal-plan/components/chat/chat-messages"
import { PlanChangeCard } from "@/features/meal-plan/components/chat/tool-cards/plan-change-card"
import { QuestionCard } from "@/features/meal-plan/components/chat/tool-cards/question-card"
import { RestaurantDishCards } from "@/features/meal-plan/components/chat/tool-cards/restaurant-dish-cards"
import {
  BodyMetricsCard,
  MealLoggedCard,
  ProfileNoteCard,
} from "@/features/meal-plan/components/chat/tool-cards/status-update-cards"
import { WebSearchConsentCard } from "@/features/meal-plan/components/chat/tool-cards/web-search-consent-card"
import type { MealPlannerChat } from "@/features/meal-plan/hooks/use-meal-planner-chat"
import {
  messageBodyMetricUpdates,
  messageLoggedMeals,
  messagePlanChanges,
  messageProfileNoteUpdates,
  messageQuestions,
  messageRestaurantDishes,
  messageText,
  type PlannerRestaurantDish,
} from "@/features/meal-plan/lib/chat-message-parsers"
import { DAY_LABELS, SECTION_LABELS } from "@/features/meal-plan/lib/dates"
import type { MealSection, Weekday } from "@/features/meal-plan/schemas/meal-plan.schema"
import { AgentTrace, hasTrace, MessageSources } from "@/features/shared/components/agent-trace"
import { LogoMark } from "@/features/shared/components/wordmark"

const UNSAFE_ELEMENTS = ["img", "a"]
const MAX_PLANNER_MESSAGE_LENGTH = 4000
const SUGGESTIONS = [
  "Lên thực đơn 7 ngày hợp BMI của mình",
  "Trưa nay lỡ ăn ngoài hơi nhiều, tối đổi món nhẹ",
  "Kiểm tra tuần này đã đủ Đạm, Sắt, Canxi chưa",
  "Gợi ý vài món chay ngoài quán thanh đạm, giàu đạm thực vật",
] as const

export type PlannerChatHandle = { ask: (text: string) => void }
export type MealAskContext = { title: string; day: Weekday; section: MealSection }

export function PlannerChat({
  chat,
  savedAvoided = [],
  profileLoading = false,
  profileError = false,
  askContext,
  clearAskContext,
  onOpenWeek,
  onStartVoice,
  onLogRestaurantDish,
  onEditDietary,
  onOpenMealLog,
  onOpenBodyMetrics,
  voiceDisabled = false,
  leading,
  trailing,
  handle,
}: {
  handle?: Ref<PlannerChatHandle>
  leading?: ReactNode
  trailing?: ReactNode
  chat: MealPlannerChat
  savedAvoided?: string[]
  profileLoading?: boolean
  profileError?: boolean
  askContext?: MealAskContext | null
  clearAskContext?: () => void
  onOpenWeek?: (weekStart: string) => void
  onStartVoice?: () => void
  onLogRestaurantDish?: (dish: PlannerRestaurantDish) => void
  onEditDietary?: () => void
  onOpenMealLog?: (date?: string) => void
  onOpenBodyMetrics?: () => void
  voiceDisabled?: boolean
}) {
  const { messages, busy, waiting, pendingId, streamingId, error, send, reset } = chat
  const [input, setInput] = useState("")
  const [inputError, setInputError] = useState("")
  const [historyOpen, setHistoryOpen] = useState(false)
  const [rewindTarget, setRewindTarget] = useState<string | null>(null)
  const [rewindNotice, setRewindNotice] = useState<string | null>(null)
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
    if (
      !busy &&
      !error &&
      pending.current &&
      pendingAfterCount.current !== null &&
      messages.length > pendingAfterCount.current &&
      messages.at(-1)?.role === "assistant"
    ) {
      pending.current = null
      pendingAfterCount.current = null
      clearAskContext?.()
    }
  }, [busy, error, messages, input, clearAskContext])

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
    const payload = `${context}${text}`
    if (payload.length > MAX_PLANNER_MESSAGE_LENGTH) {
      setInputError(`Tin nhắn tối đa ${MAX_PLANNER_MESSAGE_LENGTH} ký tự. Hãy rút ngắn nội dung.`)
      return
    }
    if (busy) {
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
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-secondary">
          <LogoMark className="size-7" />
        </span>
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
        {onEditDietary ? (
          <button
            type="button"
            onClick={onEditDietary}
            className="shrink-0 font-semibold text-primary underline-offset-4 hover:underline focus-visible:underline"
          >
            Chỉnh hồ sơ
          </button>
        ) : (
          <Link
            href={DIETARY_PATH}
            className="shrink-0 font-semibold text-primary underline-offset-4 hover:underline focus-visible:underline"
          >
            Chỉnh hồ sơ
          </Link>
        )}
      </div>

      <div
        aria-label="Cuộc trò chuyện"
        aria-live="polite"
        className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-4 py-5 sm:px-5"
      >
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
          const loggedMeals = messageLoggedMeals(message)
          const bodyMetrics = messageBodyMetricUpdates(message)
          const pending = message.id === pendingId
          if (
            !text &&
            changes.length === 0 &&
            questions.length === 0 &&
            restaurantDishes.length === 0 &&
            noteUpdates.length === 0 &&
            loggedMeals.length === 0 &&
            bodyMetrics.length === 0 &&
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
              {text && (
                <Bubble variant="ghost">
                  <BubbleContent>
                    <Streamdown
                      caret="block"
                      isAnimating={message.id === streamingId}
                      controls={false}
                      disallowedElements={UNSAFE_ELEMENTS}
                      unwrapDisallowed
                    >
                      {text}
                    </Streamdown>
                  </BubbleContent>
                </Bubble>
              )}
              {changes.map((change) => (
                <PlanChangeCard
                  key={change.id}
                  change={change}
                  currentWeek={chat.weekStart}
                  onShowWeek={onOpenWeek}
                />
              ))}
              {noteUpdates.map((update) => (
                <ProfileNoteCard key={update.id} update={update} onEditDietary={onEditDietary} />
              ))}
              {loggedMeals.map((item) => (
                <MealLoggedCard key={item.id} item={item} onOpenMealLog={onOpenMealLog} />
              ))}
              {bodyMetrics.map((item) => (
                <BodyMetricsCard key={item.id} item={item} onOpenBodyMetrics={onOpenBodyMetrics} />
              ))}
              {!pending && restaurantDishes.length > 0 && (
                <RestaurantDishCards dishes={restaurantDishes} onLogDish={onLogRestaurantDish} />
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
                <WebSearchConsentCard
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
        {chat.historyError && !historyOpen && (
          <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {chat.historyError}
          </p>
        )}
        {rewindNotice && (
          <p role="status" className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
            {rewindNotice}
          </p>
        )}
        {waiting && !pendingId && (
          <AssistantMessage>
            <span className="shimmer text-sm text-muted-foreground motion-reduce:shimmer-none">
              Đang suy nghĩ…
            </span>
          </AssistantMessage>
        )}
        {error && (
          <AssistantMessage>
            <div role="alert" className="space-y-2 text-sm text-destructive">
              <p>{error} Tin nhắn vẫn ở ô nhập để bạn thử lại.</p>
              <Link
                href="/billing"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-primary underline underline-offset-4"
              >
                Xem gói và hạn mức AI
              </Link>
              <Button variant="outline" size="sm" onClick={() => submit()} disabled={!input.trim() || busy}>
                <RotateCcwIcon aria-hidden /> Thử lại
              </Button>
            </div>
          </AssistantMessage>
        )}

        {showSuggestions && (
          <BubbleGroup aria-label="Gợi ý">
            {SUGGESTIONS.map((suggestion, index) => (
              <Bubble key={suggestion} variant="outline">
                <BubbleContent render={<button type="button" />} onClick={() => chooseSuggestion(index)}>
                  {suggestion}
                </BubbleContent>
              </Bubble>
            ))}
          </BubbleGroup>
        )}
        <div ref={end} aria-hidden className="h-px shrink-0" />
      </div>

      <div className="z-10 shrink-0 border-t border-border bg-card/95 px-4 py-3 shadow-[0_-8px_22px_rgba(20,38,26,0.04)] backdrop-blur-lg sm:px-5">
        {askContext && (
          <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs text-primary">
            <span className="truncate">
              {DAY_LABELS[askContext.day]} · {SECTION_LABELS[askContext.section]} · {askContext.title}
            </span>
            <button
              type="button"
              aria-label="Bỏ món đính kèm"
              onClick={clearAskContext}
              className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <XIcon aria-hidden className="size-3.5" />
            </button>
          </div>
        )}
        {queued && (
          <div
            role="status"
            className="mb-2 flex max-w-full items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground"
          >
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
            <InputGroupTextarea
              ref={textarea}
              value={input}
              onChange={(event) => {
                setInput(event.target.value)
                setInputError("")
              }}
              aria-label="Tin nhắn cho trợ lý"
              aria-invalid={Boolean(inputError)}
              placeholder="Hỏi về món chay hoặc yêu cầu đổi món…"
              maxLength={MAX_PLANNER_MESSAGE_LENGTH}
              rows={1}
              className="max-h-32 min-h-12"
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) {
                  return
                }
                event.preventDefault()
                submit()
              }}
            />
            <InputGroupAddon align="inline-end">
              {busy && !input.trim() ? (
                <InputGroupButton
                  type="button"
                  size="icon-sm"
                  variant="default"
                  aria-label="Dừng"
                  title="Dừng"
                  onClick={chat.stop}
                >
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
                <InputGroupButton
                  type="submit"
                  size="icon-sm"
                  variant="default"
                  aria-label={busy ? "Gửi sau khi trợ lý xong" : "Gửi"}
                  disabled={!chat.weekStart || !input.trim()}
                >
                  <ArrowUpIcon aria-hidden />
                </InputGroupButton>
              )}
            </InputGroupAddon>
          </InputGroup>
          {inputError && (
            <p role="alert" className="mt-1 text-xs text-destructive">
              {inputError}
            </p>
          )}
        </form>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[0.6875rem] leading-4 text-muted-foreground">
          <p>Trợ lý tự lưu thay đổi vào lịch. Bấm Quay lại ở tin nhắn để hoàn tác.</p>
          {chat.webSearchAllowed && (
            <p title="Bạn đã cho phép trợ lý tìm trên web trong đoạn chat này" className="flex items-center gap-1">
              <GlobeIcon aria-hidden className="size-3 shrink-0" /> Được tìm trên web
            </p>
          )}
        </div>
      </div>

      <ChatHistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        threads={chat.threads}
        threadsLoading={chat.threadsLoading}
        activeThreadId={chat.threadId}
        loadingThreadId={chat.loadingThreadId}
        deletingThreadId={chat.deletingThreadId}
        historyError={chat.historyError}
        onNewThread={handleNewThread}
        onSelectThread={(id) => void handleSelectThread(id)}
        onRemoveThread={(id) => void chat.removeThread(id)}
      />

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
