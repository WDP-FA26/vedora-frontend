"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { Controller, useForm } from "react-hook-form"
import { Streamdown } from "streamdown"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowUpIcon, RotateCcwIcon } from "lucide-react"

import { Bubble, BubbleContent, BubbleGroup } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import { Field, FieldError } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { Message, MessageContent, MessageHeader } from "@/components/ui/message"
import { Spinner } from "@/components/ui/spinner"
import {
  messageProposals,
  messageText,
  type MealPlannerChat,
  type Proposal,
  type ProposalStatus,
} from "@/features/meal-plan/hooks/use-meal-planner-chat"
import {
  DAY_LABELS,
  SECTION_LABELS,
  toDayInputs,
  type MealDayInput,
} from "@/features/meal-plan/meal-plan"
import {
  MAX_CHAT_MESSAGE_LENGTH,
  chatMessageSchema,
  type ChatMessageValues,
} from "@/features/nutrition-chat/schemas"
import { ApiError } from "@/features/shared/lib/api-client"
import { LogoMark } from "@/features/shared/components/wordmark"

const UNSAFE_ELEMENTS = ["img", "a"]

const SUGGESTIONS = [
  "Lên thực đơn cả tuần cho mình",
  "Mình chỉ có 30 phút nấu mỗi bữa",
  "Thực đơn thuần thực vật cần chú ý chất gì?",
]

function AssistantMessage({ children }: { children: ReactNode }) {
  return (
    <Message>
      <MessageContent>
        <MessageHeader>
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <LogoMark className="size-6" />
            Trợ lý Vedora
          </span>
        </MessageHeader>
        {children}
      </MessageContent>
    </Message>
  )
}

/** The conversation with the planner. Its proposals are saved only when the user applies them. */
export function PlannerChat({
  chat,
  apply,
  openPlan,
}: {
  chat: MealPlannerChat
  apply: (days: MealDayInput[]) => Promise<void>
  openPlan: () => void
}) {
  const { messages, busy, waiting, working, researching, streamingId, error, send, reset } =
    chat
  const form = useForm<ChatMessageValues>({
    resolver: zodResolver(chatMessageSchema),
    defaultValues: { text: "" },
  })
  const end = useRef<HTMLDivElement>(null)
  const showSuggestions = messages.length === 1 && !busy && !error

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" })
  }, [messages, waiting])

  const onSubmit = form.handleSubmit(({ text }) => {
    if (busy) return
    send(text)
    form.reset()
  })

  return (
    <div className="flex flex-col gap-6 px-4 pt-4 sm:px-5 lg:h-[calc(100dvh-2.8125rem)] lg:min-h-0">
      <div
        aria-label="Cuộc trò chuyện"
        aria-live="polite"
        className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain pb-2"
      >
        {messages.map((message) => {
          const text = messageText(message)
          const proposals = messageProposals(message)
          if (!text && proposals.length === 0) return null
          return message.role === "assistant" ? (
            <AssistantMessage key={message.id}>
              {proposals.map((proposal) => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  status={chat.statuses[proposal.id]}
                  superseded={proposal.id !== chat.latestProposalId}
                  setStatus={(status) => chat.setProposalStatus(proposal.id, status)}
                  apply={apply}
                  openPlan={openPlan}
                />
              ))}
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
            </AssistantMessage>
          ) : (
            <Message key={message.id} align="end">
              <MessageContent>
                <Bubble align="end">
                  <BubbleContent>{text}</BubbleContent>
                </Bubble>
              </MessageContent>
            </Message>
          )
        })}
        {waiting && (
          <AssistantMessage>
            <span className="shimmer text-sm text-muted-foreground motion-reduce:shimmer-none">
              {researching
                ? "Đang tra cứu tài liệu…"
                : working
                  ? "Đang chọn món và kiểm tra thực đơn…"
                  : "Đang suy nghĩ…"}
            </span>
          </AssistantMessage>
        )}
        {error && (
          <AssistantMessage>
            <span role="alert" className="text-sm text-destructive">
              {error}
            </span>
          </AssistantMessage>
        )}
        {showSuggestions && (
          <BubbleGroup aria-label="Gợi ý">
            {SUGGESTIONS.map((suggestion) => (
              <Bubble key={suggestion} variant="outline">
                <BubbleContent render={<button type="button" />} onClick={() => send(suggestion)}>
                  {suggestion}
                </BubbleContent>
              </Bubble>
            ))}
          </BubbleGroup>
        )}
        <div ref={end} aria-hidden className="h-px shrink-0 scroll-mb-40" />
      </div>

      <div
        className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-4 flex scroll-mb-24 flex-col gap-2 border-t border-border/80 bg-card/95 px-4 pt-3 pb-4 shadow-[0_-8px_22px_rgba(20,38,26,0.04)] backdrop-blur-lg sm:bottom-0 sm:-mx-5 sm:px-5"
      >
        <form onSubmit={onSubmit}>
          <Controller
            name="text"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <InputGroup>
                  <InputGroupTextarea
                    {...field}
                    aria-label="Tin nhắn cho trợ lý"
                    aria-invalid={fieldState.invalid}
                    placeholder="Nhờ lên thực đơn, đổi món, hoặc hỏi về dinh dưỡng"
                    maxLength={MAX_CHAT_MESSAGE_LENGTH}
                    rows={1}
                    className="max-h-32 min-h-12"
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing)
                        return
                      event.preventDefault()
                      void onSubmit()
                    }}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      type="submit"
                      size="icon-sm"
                      variant="default"
                      aria-label="Gửi"
                      disabled={busy}
                    >
                      <ArrowUpIcon />
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </form>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Thực đơn chỉ đổi khi bạn bấm Áp dụng. Thông tin dinh dưỡng chỉ để tham khảo, không thay thế bác sĩ.
          </p>
          {messages.length > 1 && (
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcwIcon aria-hidden />
              Bắt đầu lại
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function ProposalCard({
  proposal,
  status,
  superseded,
  setStatus,
  apply,
  openPlan,
}: {
  proposal: Proposal
  status: ProposalStatus | undefined
  superseded: boolean
  setStatus: (status: ProposalStatus) => void
  apply: (days: MealDayInput[]) => Promise<void>
  openPlan: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState<"session" | "invalid" | "other" | null>(null)
  // only what changes: a day is sent whole, most of it usually as it was
  const days = proposal.days.map(({ day, sections }) => ({
    day,
    sections: sections.filter(
      ({ recipes, previous }) =>
        recipes.map(({ id }) => id).join() !== previous.map(({ id }) => id).join()
    ),
  }))
  const changed = days.filter(({ sections }) => sections.length > 0)

  async function accept() {
    setSaving(true)
    setFailed(null)
    try {
      await apply(toDayInputs(proposal))
      setStatus("applied")
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 0
      setFailed(status === 401 ? "session" : status === 409 ? "invalid" : "other")
    } finally {
      setSaving(false)
    }
  }

  return (
    <article
      aria-label="Đề xuất thực đơn"
      className="flex w-full flex-col gap-3 rounded-2xl border border-border p-3"
    >
      <h3 className="text-sm font-semibold">
        {changed.length > 0
          ? `Đề xuất cho ${changed.map(({ day }) => DAY_LABELS[day]).join(", ")}`
          : "Đề xuất giống thực đơn đang lưu"}
      </h3>
      <dl className="flex flex-col gap-3 text-sm">
        {changed.map(({ day, sections }) => (
          <div key={day} className="flex flex-col gap-1">
            <dt className="font-medium">{DAY_LABELS[day]}</dt>
            {sections.map(({ section, recipes, previous }) => {
              const removed = previous.filter(
                (old) => !recipes.some((recipe) => recipe.id === old.id)
              )
              return (
                <dd key={section} className="flex gap-3">
                  <span className="w-12 shrink-0 text-muted-foreground">
                    {SECTION_LABELS[section]}
                  </span>
                  <span className="min-w-0">
                    {recipes.length > 0
                      ? recipes.map(({ title }) => title).join(", ")
                      : "Để trống"}
                    {removed.length > 0 && (
                      <span className="text-muted-foreground">
                        {" "}
                        (bỏ <s>{removed.map(({ title }) => title).join(", ")}</s>)
                      </span>
                    )}
                  </span>
                </dd>
              )
            })}
          </div>
        ))}
      </dl>

      {status === "applied" ? (
        <p role="status" className="flex flex-wrap items-center gap-2 text-sm">
          Đã áp dụng vào thực đơn.
          <span className="lg:hidden">
            <Button variant="link" size="sm" onClick={openPlan}>
              Xem thực đơn
            </Button>
          </span>
        </p>
      ) : status === "dismissed" ? (
        <p role="status" className="text-sm text-muted-foreground">
          Đã bỏ qua. Thực đơn không đổi.
        </p>
      ) : superseded ? (
        <p className="text-sm text-muted-foreground">Đã có đề xuất mới hơn ở bên dưới.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={saving} onClick={() => void accept()}>
            {saving && <Spinner aria-hidden />}
            Áp dụng
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() => setStatus("dismissed")}
          >
            Bỏ qua
          </Button>
          {failed && (
            <p role="alert" className="text-sm text-destructive">
              {failed === "session"
                ? "Phiên đăng nhập vừa được làm mới. Bấm Áp dụng lần nữa nhé."
                : failed === "invalid"
                  ? "Thực đơn hoặc danh sách không ăn vừa đổi nên đề xuất này không còn hợp lệ. Nhờ trợ lý đề xuất lại nhé."
                  : "Không lưu được. Thử lại nhé."}
            </p>
          )}
        </div>
      )}
    </article>
  )
}
