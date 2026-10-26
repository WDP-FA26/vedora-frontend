"use client"

import { useEffect, useRef, useState } from "react"
import { Streamdown } from "streamdown"
import { getToolName, isToolUIPart, type ToolUIPart, type DynamicToolUIPart } from "ai"
import { ArrowUpIcon, CheckIcon, RotateCcwIcon, SparklesIcon, XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import { Message, MessageContent } from "@/components/ui/message"
import {
  useWritingAssistant,
  type AssistantMessage,
  type WritingAssistant,
} from "@/features/blogs/hooks/use-writing-assistant"
import {
  AGENT_WELCOME,
  EDIT_ERRORS,
  EDIT_LABELS,
  editorToolInputs,
  editorToolOutputSchema,
  isEditorTool,
  MAX_ASSISTANT_MESSAGE_LENGTH,
  QUICK_PROMPTS,
  type EditorTool,
} from "@/features/blogs/lib/writing-assistant"
import { AgentTrace } from "@/features/shared/components/agent-trace"

const UNSAFE_ELEMENTS = ["img", "a"]

type ToolPart = ToolUIPart | DynamicToolUIPart

/** The message without its editor tools, which show as cards instead of trace lines. */
function serverSteps(message: AssistantMessage): AssistantMessage {
  return {
    ...message,
    parts: message.parts.filter((part) => !(isToolUIPart(part) && isEditorTool(getToolName(part)))),
  }
}

/** How the author's decision on an editor tool went, once it has an output. */
function outcome(part: ToolPart) {
  if (part.state === "output-error") return "Không áp dụng được"
  if (part.state !== "output-available") return null
  const output = editorToolOutputSchema.safeParse(part.output).data
  if (!output) return null
  if (output.applied) return "Đã chấp nhận"
  return output.error ? EDIT_ERRORS[output.error] : "Đã bỏ"
}

function DecisionButtons({
  onAccept,
  onDiscard,
  acceptLabel = "Chấp nhận",
}: {
  onAccept: () => void
  onDiscard: () => void
  acceptLabel?: string
}) {
  return (
    <>
      <Button size="xs" variant="outline" onClick={onAccept}>
        <CheckIcon data-icon="inline-start" />
        {acceptLabel}
      </Button>
      <Button size="xs" variant="ghost" onClick={onDiscard}>
        <XIcon data-icon="inline-start" />
        Bỏ
      </Button>
    </>
  )
}

/** One change the agent proposed: where it stands and, while pending, its buttons. */
function EditCard({ part, assistant }: { part: ToolPart; assistant: WritingAssistant }) {
  const tool = getToolName(part) as EditorTool
  const done = outcome(part)
  const streaming = part.state === "input-streaming"

  let detail: React.ReactNode = null
  let actions: React.ReactNode = null
  if (tool === "setTitle") {
    const input = editorToolInputs.setTitle.safeParse(part.input).data
    if (input) detail = <p className="text-sm font-semibold">{input.title}</p>
    if (input && part.state === "input-available") {
      actions = (
        <DecisionButtons
          acceptLabel="Dùng tiêu đề này"
          onAccept={() => assistant.decideTitle(part.toolCallId, input.title, true)}
          onDiscard={() => assistant.decideTitle(part.toolCallId, input.title, false)}
        />
      )
    }
  } else if (tool === "insertImage") {
    const input = editorToolInputs.insertImage.safeParse(part.input).data
    if (input) {
      detail = (
        // eslint-disable-next-line @next/next/no-img-element -- images from the blogs bucket
        <img
          src={input.url}
          alt={input.alt}
          referrerPolicy="no-referrer"
          className="max-h-48 w-full rounded-lg object-cover"
        />
      )
    }
    if (part.state === "input-available") {
      actions = (
        <DecisionButtons
          acceptLabel="Chèn vào bài"
          onAccept={() => assistant.decideImage(part.toolCallId, part.input, true)}
          onDiscard={() => assistant.decideImage(part.toolCallId, part.input, false)}
        />
      )
    }
  } else {
    const group = assistant.groupOf(part.toolCallId)
    if (group && part.state === "input-available" && assistant.isPending(group)) {
      actions = (
        <DecisionButtons
          onAccept={() => assistant.resolve(group, "accept")}
          onDiscard={() => assistant.resolve(group, "discard")}
        />
      )
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-background p-2 pl-3">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{EDIT_LABELS[tool]}</p>
        {streaming && <span className="pr-1 text-xs text-muted-foreground">Đang soạn…</span>}
        {done && <span className="pr-1 text-xs text-muted-foreground">{done}</span>}
        {!detail && actions}
      </div>
      {detail}
      {detail && actions && <div className="flex justify-end gap-1">{actions}</div>}
    </div>
  )
}

function AssistantTurn({
  message,
  assistant,
  animating,
}: {
  message: AssistantMessage
  assistant: WritingAssistant
  animating: boolean
}) {
  return (
    <Message>
      <MessageContent>
        <AgentTrace message={serverSteps(message)} pending={animating} />
        {message.parts.map((part, index) => {
          if (part.type === "text") {
            return part.text ? (
              <Bubble key={index} variant="ghost">
                <BubbleContent>
                  <Streamdown
                    caret="block"
                    isAnimating={animating}
                    controls={false}
                    disallowedElements={UNSAFE_ELEMENTS}
                    unwrapDisallowed
                  >
                    {part.text}
                  </Streamdown>
                </BubbleContent>
              </Bubble>
            ) : null
          }
          if (isToolUIPart(part) && isEditorTool(getToolName(part))) {
            return <EditCard key={part.toolCallId} part={part} assistant={assistant} />
          }
          return null
        })}
      </MessageContent>
    </Message>
  )
}

function messageText(message: AssistantMessage) {
  return message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n\n")
}

/**
 * The writing assistant beside the editor, talking to vedora-api's blog
 * agent. Its edits appear in the post as suggestions (struck-out red text
 * with green replacements) that the author accepts or discards, from the post
 * or from the chat; titles and images are approved here. Lives inside the
 * `LexicalComposer` to reach the editor.
 */
export function WritingAgentPanel({
  title,
  blogId,
  onPickTitle,
}: {
  title: string
  blogId: () => string | null
  onPickTitle: (title: string) => void
}) {
  const assistant = useWritingAssistant({ title, blogId, onPickTitle })
  const { messages, busy, awaitingAuthor, error, quota } = assistant
  const [draft, setDraft] = useState("")
  const end = useRef<HTMLDivElement>(null)
  const last = messages.at(-1)

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" })
  }, [messages, busy])

  const blocked = busy || awaitingAuthor
  const remaining = quota ? Math.max(0, quota.messages.limit - quota.messages.used) : null

  function send(text: string) {
    const prompt = text.trim()
    if (!prompt || blocked || prompt.length > MAX_ASSISTANT_MESSAGE_LENGTH) return
    setDraft("")
    assistant.send(prompt)
  }

  return (
    <aside
      aria-label="Trợ lý viết blog"
      className="hidden h-dvh w-[30%] shrink-0 flex-col border-l border-border bg-card lg:flex"
    >
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <SparklesIcon aria-hidden className="size-4 text-primary" />
        <h2 className="flex-1 text-sm font-semibold">Trợ lý viết blog</h2>
        {quota && (
          <Badge
            variant="secondary"
            title={`Ảnh minh hoạ: còn ${Math.max(0, quota.images.limit - quota.images.used)}/${quota.images.limit} hôm nay`}
          >
            Còn {remaining} lượt
          </Badge>
        )}
        <Button variant="ghost" size="icon-sm" aria-label="Bắt đầu lại" onClick={assistant.reset}>
          <RotateCcwIcon />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        <Message>
          <MessageContent>
            <Bubble variant="ghost">
              <BubbleContent>{AGENT_WELCOME}</BubbleContent>
            </Bubble>
          </MessageContent>
        </Message>

        {messages.map((message) =>
          message.role === "user" ? (
            <Message key={message.id} align="end">
              <MessageContent>
                <Bubble align="end">
                  <BubbleContent>{messageText(message)}</BubbleContent>
                </Bubble>
              </MessageContent>
            </Message>
          ) : (
            <AssistantTurn
              key={message.id}
              message={message}
              assistant={assistant}
              animating={busy && message.id === last?.id}
            />
          )
        )}
        {busy && last?.role === "user" && (
          <p role="status" className="text-sm text-muted-foreground">
            Đang suy nghĩ…
          </p>
        )}
        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-xl border border-destructive/40 px-3 py-2 text-sm">
            <p className="flex-1 text-destructive">{error}</p>
            <Button size="xs" variant="outline" onClick={assistant.retry}>
              Thử lại
            </Button>
          </div>
        )}
        <div ref={end} />
      </div>

      <div className="flex flex-col gap-2 border-t border-border p-3">
        {assistant.selectedText && (
          <p className="truncate rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground">
            Đoạn đang chọn: “{assistant.selectedText}”
          </p>
        )}
        {awaitingAuthor && (
          <p role="status" className="text-xs text-muted-foreground">
            Chấp nhận hoặc bỏ đề xuất để trợ lý làm tiếp.
          </p>
        )}
        {messages.length === 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((prompt) => (
              <li key={prompt}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => send(prompt)}
                  className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted"
                >
                  {prompt}
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            send(draft)
          }}
        >
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                send(draft)
              }
            }}
            rows={2}
            maxLength={MAX_ASSISTANT_MESSAGE_LENGTH}
            placeholder="Bôi đen một đoạn rồi nhờ trợ lý sửa, hoặc hỏi bất cứ điều gì…"
            aria-label="Tin nhắn cho trợ lý"
            className="min-h-0 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          />
          <Button
            type="submit"
            size="icon"
            shape="pill"
            aria-label="Gửi"
            disabled={blocked || draft.trim() === ""}
          >
            <ArrowUpIcon />
          </Button>
        </form>
      </div>
    </aside>
  )
}
