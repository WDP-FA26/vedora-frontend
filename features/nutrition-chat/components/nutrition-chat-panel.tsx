"use client"

import type { ReactNode } from "react"
import { Controller, useForm } from "react-hook-form"
import { Streamdown } from "streamdown"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowUpIcon, RotateCcwIcon, XIcon } from "lucide-react"

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
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { PopoverDescription, PopoverTitle } from "@/components/ui/popover"
import { LogoMark } from "@/features/shared/components/wordmark"
import {
  messageText,
  useNutritionChat,
} from "@/features/nutrition-chat/hooks/use-nutrition-chat"
import { SUGGESTIONS } from "@/features/nutrition-chat/lib/suggestions"
import {
  MAX_CHAT_MESSAGE_LENGTH,
  chatMessageSchema,
  type ChatMessageValues,
} from "@/features/nutrition-chat/schemas"

// replies can carry injected content: an image would load (and leak data to) any
// URL without a click, and a link could phish; links keep their text
const UNSAFE_ELEMENTS = ["img", "a"]

const ASSISTANT_NAME = "Trợ lý dinh dưỡng"

/** Name above, plain text below, like a support-agent transcript. */
function AssistantMessage({ children }: { children: ReactNode }) {
  return (
    <Message>
      <MessageContent>
        <MessageHeader>
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <LogoMark className="size-6" />
            {ASSISTANT_NAME}
          </span>
        </MessageHeader>
        <Bubble variant="ghost">
          <BubbleContent>{children}</BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  )
}

/** Body of the pet's chat popover: header, conversation and composer. */
export function NutritionChatPanel({ onClose }: { onClose: () => void }) {
  const { messages, busy, thinking, searching, streamingId, error, send, reset } = useNutritionChat()
  const form = useForm<ChatMessageValues>({
    resolver: zodResolver(chatMessageSchema),
    defaultValues: { text: "" },
  })
  const showSuggestions = messages.length === 1 && !busy && !error

  const onSubmit = form.handleSubmit(({ text }) => {
    if (busy) return
    send(text)
    form.reset()
  })

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <header className="-mx-2.5 flex items-center gap-2 border-b border-border px-2.5 pb-2.5">
        <PopoverTitle className="min-w-0 flex-1">Hỏi đáp dinh dưỡng</PopoverTitle>
        <Button variant="ghost" size="icon-sm" aria-label="Bắt đầu lại" onClick={reset}>
          <RotateCcwIcon />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Đóng" onClick={onClose}>
          <XIcon />
        </Button>
      </header>

      <MessageScrollerProvider autoScroll defaultScrollPosition="end">
        <MessageScroller className="flex-1">
          <MessageScrollerViewport aria-label="Cuộc trò chuyện" scrollbar="hidden">
            <MessageScrollerContent>
              {messages.map((message) => {
                const text = messageText(message)
                // the reply's first chunk can be empty; the spinner covers it
                if (!text) return null
                return (
                <MessageScrollerItem
                  key={message.id}
                  messageId={message.id}
                  scrollAnchor={message.role === "user"}
                >
                  {message.role === "assistant" ? (
                    <AssistantMessage>
                      <Streamdown
                        caret="block"
                        isAnimating={message.id === streamingId}
                        controls={false}
                        disallowedElements={UNSAFE_ELEMENTS}
                        unwrapDisallowed
                      >
                        {text}
                      </Streamdown>
                    </AssistantMessage>
                  ) : (
                    <Message align="end">
                      <MessageContent>
                        <Bubble align="end">
                          <BubbleContent>{text}</BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>
                  )}
                </MessageScrollerItem>
                )
              })}
              {thinking && (
                <MessageScrollerItem>
                  <AssistantMessage>
                    <span className="shimmer text-muted-foreground motion-reduce:shimmer-none">
                      {searching ? "Đang tra cứu tài liệu…" : "Đang suy nghĩ…"}
                    </span>
                  </AssistantMessage>
                </MessageScrollerItem>
              )}
              {error && (
                <MessageScrollerItem>
                  <AssistantMessage>
                    <span className="text-destructive">{error}</span>
                  </AssistantMessage>
                </MessageScrollerItem>
              )}
              {showSuggestions && (
                <MessageScrollerItem>
                  <BubbleGroup aria-label="Câu hỏi gợi ý">
                    {SUGGESTIONS.map((suggestion) => (
                      <Bubble key={suggestion} variant="outline">
                        <BubbleContent
                          render={<button type="button" />}
                          onClick={() => send(suggestion)}
                        >
                          {suggestion}
                        </BubbleContent>
                      </Bubble>
                    ))}
                  </BubbleGroup>
                </MessageScrollerItem>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      <form onSubmit={onSubmit}>
        <Controller
          name="text"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <InputGroup>
                <InputGroupTextarea
                  {...field}
                  aria-label="Câu hỏi về dinh dưỡng"
                  aria-invalid={fieldState.invalid}
                  placeholder="Hỏi về dinh dưỡng…"
                  maxLength={MAX_CHAT_MESSAGE_LENGTH}
                  rows={1}
                  className="max-h-28 min-h-0"
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return
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
      <PopoverDescription className="text-center">
        Chỉ mang tính tham khảo, không thay thế bác sĩ
      </PopoverDescription>
    </div>
  )
}
