"use client"

import { useEffect, useRef, useState } from "react"
import { $generateNodesFromMarkdownString } from "@lexical/markdown"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import {
  $getRoot,
  $getSelection,
  $isDecoratorNode,
  $isRangeSelection,
  $isRootNode,
  type LexicalNode,
} from "lexical"
import { ArrowUpIcon, CheckIcon, RotateCcwIcon, SparklesIcon, XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import { Message, MessageContent } from "@/components/ui/message"
import {
  $findRewriteTarget,
  $markAsInsertion,
  $pendingGroups,
  $resolveSuggestion,
  $suggestRewrite,
} from "@/features/blogs/editor/suggestions"
import { BLOG_TRANSFORMERS } from "@/features/blogs/editor/transformers"
import {
  AGENT_WELCOME,
  EDIT_PATTERN,
  QUICK_PROMPTS,
  mockReply,
  tidyText,
  type MockReply,
} from "@/features/blogs/lib/mock-writing-agent"

type Turn =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; reply: MockReply; group?: string }

const REPLY_DELAY_MS = 700

const EDIT_REPLIES = {
  done: "Mình đã gạch phần cũ và đề xuất câu mới ngay trong bài. Rê chuột lên phần được đánh dấu để chấp nhận hoặc bỏ.",
  unchanged: "Đoạn này đã gọn rồi, mình không thấy gì cần sửa thêm.",
  none: "Mình chưa thấy đoạn nào để chỉnh. Hãy viết vài câu, hoặc đặt con trỏ vào đoạn bạn muốn sửa nhé.",
} as const

const INSERT_REPLY =
  "Mình đã thêm phần mới vào bài, đánh dấu màu xanh. Rê chuột lên đó để chấp nhận hoặc bỏ."

/**
 * The writing assistant beside the editor. A mock for now: replies are canned
 * (see `mock-writing-agent.ts`), but its edits are real. They appear in the
 * post as suggestions (struck-out red text with green replacements) that the
 * author accepts or discards, from the post or from the chat. Lives inside the
 * `LexicalComposer` to reach the editor.
 */
export function WritingAgentPanel({
  title,
  onPickTitle,
}: {
  title: string
  onPickTitle: (title: string) => void
}) {
  const [editor] = useLexicalComposerContext()
  const [turns, setTurns] = useState<Turn[]>([])
  const [thinking, setThinking] = useState(false)
  const [draft, setDraft] = useState("")
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" })
  }, [turns, thinking])
  useEffect(
    () =>
      editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
        // Selection-only updates change no suggestions.
        if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return
        const next = editorState.read(() => $pendingGroups())
        setPending((previous) =>
          previous.size === next.size && [...next].every((group) => previous.has(group)) ? previous : next
        )
      }),
    [editor]
  )

  /** Marks a rewrite of the block the author is in, and says how it went. */
  function suggestRewrite(group: string): keyof typeof EDIT_REPLIES {
    let outcome: keyof typeof EDIT_REPLIES = "none"
    editor.update(
      () => {
        const block = $findRewriteTarget()
        if (!block) return
        const from = block.getTextContent()
        const to = tidyText(from)
        if (to === from) {
          outcome = "unchanged"
          return
        }
        $suggestRewrite(block, to, group)
        outcome = "done"
      },
      { discrete: true }
    )
    return outcome
  }

  /** Marks new blocks after the one holding the caret, else at the end of the post. */
  function suggestInsertion(markdown: string, group: string) {
    editor.update(
      () => {
        const nodes = $generateNodesFromMarkdownString(markdown, BLOG_TRANSFORMERS)
        $markAsInsertion(nodes, group)
        const selection = $getSelection()
        const anchor = $isRangeSelection(selection) ? selection.anchor.getNode() : null
        if (anchor && !$isRootNode(anchor)) {
          const block = anchor.getTopLevelElementOrThrow()
          let previous: LexicalNode = block
          for (const node of nodes) {
            previous.insertAfter(node)
            previous = node
          }
          if (block.getTextContent() === "" && !$isDecoratorNode(block)) block.remove()
        } else {
          $getRoot().append(...nodes)
        }
      },
      { discrete: true }
    )
  }

  function answer(prompt: string): Turn {
    const id = crypto.randomUUID()
    const group = crypto.randomUUID()
    if (EDIT_PATTERN.test(prompt)) {
      const outcome = suggestRewrite(group)
      const done = outcome === "done"
      return {
        id,
        role: "assistant",
        reply: { text: EDIT_REPLIES[outcome], summary: done ? "Chỉnh câu văn" : undefined },
        group: done ? group : undefined,
      }
    }
    const reply = mockReply(prompt, title)
    if (reply.proposal) {
      suggestInsertion(reply.proposal.markdown, group)
      return {
        id,
        role: "assistant",
        reply: { text: INSERT_REPLY, summary: reply.proposal.summary },
        group,
      }
    }
    return { id, role: "assistant", reply }
  }

  function send(text: string) {
    const prompt = text.trim()
    if (!prompt || thinking) return
    setTurns((all) => [...all, { id: crypto.randomUUID(), role: "user", text: prompt }])
    setDraft("")
    setThinking(true)
    timer.current = setTimeout(() => {
      const turn = answer(prompt)
      setTurns((all) => [...all, turn])
      setThinking(false)
    }, REPLY_DELAY_MS)
  }

  function reset() {
    if (timer.current) clearTimeout(timer.current)
    setThinking(false)
    setTurns([])
  }

  function resolve(group: string, decision: "accept" | "discard") {
    editor.update(() => $resolveSuggestion(group, decision))
  }

  return (
    <aside
      aria-label="Trợ lý viết blog"
      className="hidden h-dvh w-[30%] shrink-0 flex-col border-l border-border bg-card lg:flex"
    >
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <SparklesIcon aria-hidden className="size-4 text-primary" />
        <h2 className="flex-1 text-sm font-semibold">Trợ lý viết blog</h2>
        <Badge variant="secondary" title="Chưa kết nối mô hình AI; câu trả lời là mẫu">
          Bản thử
        </Badge>
        <Button variant="ghost" size="icon-sm" aria-label="Bắt đầu lại" onClick={reset}>
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

        {turns.map((turn) =>
          turn.role === "user" ? (
            <Message key={turn.id} align="end">
              <MessageContent>
                <Bubble align="end">
                  <BubbleContent>{turn.text}</BubbleContent>
                </Bubble>
              </MessageContent>
            </Message>
          ) : (
            <Message key={turn.id}>
              <MessageContent>
                <Bubble variant="ghost">
                  <BubbleContent>{turn.reply.text}</BubbleContent>
                </Bubble>
                {turn.reply.titles && (
                  <ul className="flex flex-col gap-1.5">
                    {turn.reply.titles.map((option) => (
                      <li key={option}>
                        <button
                          type="button"
                          onClick={() => onPickTitle(option)}
                          className="w-full rounded-xl border border-border px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          {option}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {turn.group && turn.reply.summary && (
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-background p-2 pl-3">
                    <p className="min-w-0 flex-1 truncate text-sm font-medium">{turn.reply.summary}</p>
                    {pending.has(turn.group) ? (
                      <>
                        <Button size="xs" variant="outline" onClick={() => resolve(turn.group!, "accept")}>
                          <CheckIcon data-icon="inline-start" />
                          Chấp nhận
                        </Button>
                        <Button size="xs" variant="ghost" onClick={() => resolve(turn.group!, "discard")}>
                          <XIcon data-icon="inline-start" />
                          Bỏ
                        </Button>
                      </>
                    ) : (
                      <span className="pr-1 text-xs text-muted-foreground">Đã xử lý</span>
                    )}
                  </div>
                )}
              </MessageContent>
            </Message>
          )
        )}
        {thinking && (
          <p role="status" className="text-sm text-muted-foreground">
            Đang suy nghĩ…
          </p>
        )}
        <div ref={end} />
      </div>

      <div className="flex flex-col gap-2 border-t border-border p-3">
        {turns.length === 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((prompt) => (
              <li key={prompt}>
                <button
                  type="button"
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
            maxLength={500}
            placeholder="Nhờ trợ lý giúp bài viết…"
            aria-label="Tin nhắn cho trợ lý"
            className="min-h-0 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          />
          <Button type="submit" size="icon" shape="pill" aria-label="Gửi" disabled={thinking || draft.trim() === ""}>
            <ArrowUpIcon />
          </Button>
        </form>
      </div>
    </aside>
  )
}
