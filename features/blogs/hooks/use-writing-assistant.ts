"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useChat } from "@ai-sdk/react"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { mergeRegister } from "@lexical/utils"
import {
  APICallError,
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai"
import { COMMAND_PRIORITY_NORMAL } from "lexical"
import useSWR from "swr"

import { useAuth } from "@/features/auth/hooks/use-auth"
import {
  $applyInsertImage,
  $applyInsertMarkdown,
  $applyReplaceSelection,
  $applyReplaceText,
  $captureSelection,
  type Captured,
  type EditError,
} from "@/features/blogs/editor/assistant-edits"
import { markdownOf } from "@/features/blogs/editor/markdown"
import {
  $pendingGroups,
  RESOLVE_SUGGESTION_COMMAND,
  type SuggestionDecision,
} from "@/features/blogs/editor/suggestions"
import {
  BLOG_ASSISTANT_CHAT_URL,
  BLOG_ASSISTANT_QUOTA_URL,
  editorToolInputs,
  isEditorTool,
  MAX_ASSISTANT_MESSAGES,
  MAX_SELECTION_LENGTH,
  quotaSchema,
  type EditorTool,
  type EditorToolOutput,
} from "@/features/blogs/lib/writing-assistant"
import { MAX_BLOG_CONTENT_LENGTH, MAX_BLOG_TITLE_LENGTH } from "@/features/blogs/schemas"
import { sendJson } from "@/features/shared/lib/api-client"

export type AssistantMessage = UIMessage<{ refused?: boolean }>

type ToolCall = { toolName: string; toolCallId: string; input: unknown }

function withoutRefusals(messages: AssistantMessage[]) {
  return messages.filter(
    (message, index) => !message.metadata?.refused && !messages[index + 1]?.metadata?.refused
  )
}

const transport = new DefaultChatTransport<AssistantMessage>({
  api: BLOG_ASSISTANT_CHAT_URL,
  prepareSendMessagesRequest: ({ id, messages, trigger, messageId, headers, body }) => ({
    headers,
    body: {
      ...body,
      id,
      trigger,
      ...(messageId ? { messageId } : {}),
      messages: withoutRefusals(messages).slice(-MAX_ASSISTANT_MESSAGES),
    },
  }),
})

function errorMessage(error: Error) {
  if (APICallError.isInstance(error) && error.statusCode === 429) {
    return error.responseBody?.includes("AI_QUOTA_EXCEEDED")
      ? "Bạn đã dùng hết lượt AI dùng chung. Xem gói của bạn để biết thời gian đặt lại hoặc chọn gói mới."
      : "Bạn gửi hơi nhanh. Đợi một chút rồi nhắn tiếp nhé."
  }
  if (APICallError.isInstance(error) && error.statusCode === 503) {
    return "Trợ lý đang tạm nghỉ. Bạn quay lại sau nhé."
  }
  if (APICallError.isInstance(error) && error.statusCode === 400) {
    return "Cuộc trò chuyện bị lỗi. Bấm “Bắt đầu lại” để tiếp tục."
  }
  if (APICallError.isInstance(error) && error.statusCode === 409)
    return "Yêu cầu đã được xử lý hoặc phiên tiếp nối đã hết hạn. Kiểm tra kết quả hoặc bắt đầu yêu cầu mới."
  if (error.message === "RATE_LIMITED") {
    return "Trợ lý đang quá tải. Bạn thử lại sau ít phút nhé."
  }
  return "Mình chưa trả lời được. Thử lại nhé."
}

export function useWritingAssistant({
  title,
  blogId,
  onPickTitle,
}: {
  title: string
  blogId: () => string | null
  onPickTitle: (title: string) => void
}) {
  const [editor] = useLexicalComposerContext()
  const router = useRouter()
  const { accessToken } = useAuth()

  const latest = useRef({ accessToken, title, blogId })
  useEffect(() => {
    latest.current = { accessToken, title, blogId }
  })
  const captured = useRef<Captured>({ selection: null, caretBlock: null })
  const waiting = useRef(new Map<string, { tool: EditorTool; toolCallId: string }>())
  const decisions = useRef(new Map<string, SuggestionDecision>())
  const [groups, setGroups] = useState<Record<string, string>>({})
  const [pendingGroups, setPendingGroups] = useState<ReadonlySet<string>>(new Set())
  const [selectedText, setSelectedText] = useState("")

  const quota = useSWR(
    accessToken ? [BLOG_ASSISTANT_QUOTA_URL, accessToken] : null,
    ([url, token]: [string, string]) => sendJson(quotaSchema, url, token)
  )

  const chat = useChat<AssistantMessage>({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onToolCall: ({ toolCall }) => applyTool(toolCall),
    onFinish: () => void quota.mutate(),
    onError: (error) => {
      if (APICallError.isInstance(error) && error.statusCode === 401) router.refresh()
      void quota.mutate()
    },
  })
  const addToolOutput = useRef(chat.addToolOutput)
  useEffect(() => {
    addToolOutput.current = chat.addToolOutput
  })

  function requestOptions({ withSelection = false, title = latest.current.title } = {}) {
    const { accessToken: token, blogId: currentBlog } = latest.current
    const selection = withSelection
      ? captured.current.selection?.text.slice(0, MAX_SELECTION_LENGTH)
      : undefined
    const blog = currentBlog()
    return {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: {
        editor: {
          title: title.slice(0, MAX_BLOG_TITLE_LENGTH),
          content: markdownOf(editor.getEditorState()).slice(0, MAX_BLOG_CONTENT_LENGTH),
          ...(selection ? { selection } : {}),
        },
        ...(blog ? { blogId: blog } : {}),
      },
    }
  }

  function answer(
    tool: EditorTool,
    toolCallId: string,
    output: EditorToolOutput,
    options = requestOptions()
  ) {
    void addToolOutput.current({ tool, toolCallId, output, options })
  }

  const latestAnswer = useRef(answer)
  useEffect(() => {
    latestAnswer.current = answer
  })

  function applyTool(toolCall: ToolCall) {
    const { toolName: tool, toolCallId } = toolCall
    if (!isEditorTool(tool) || tool === "setTitle" || tool === "insertImage") return
    const group = crypto.randomUUID()
    let error: EditError | null = "NOT_FOUND"
    try {
      editor.update(
        () => {
          if (tool === "replaceSelection") {
            const input = editorToolInputs.replaceSelection.safeParse(toolCall.input)
            if (input.success)
              error = $applyReplaceSelection(captured.current, input.data.markdown, group)
          } else if (tool === "replaceText") {
            const input = editorToolInputs.replaceText.safeParse(toolCall.input)
            if (input.success) error = $applyReplaceText(input.data.find, input.data.replace, group)
          } else {
            const input = editorToolInputs.insertMarkdown.safeParse(toolCall.input)
            if (input.success) {
              const { markdown, position, after } = input.data
              error = $applyInsertMarkdown(markdown, position, after, captured.current, group)
            }
          }
        },
        { discrete: true }
      )
    } catch (cause) {
      console.error(cause)
      error = "NOT_FOUND"
    }
    if (error) {
      answer(tool, toolCallId, { applied: false, error })
      return
    }
    if (!editor.getEditorState().read($pendingGroups).has(group)) {
      answer(tool, toolCallId, { applied: false, error: "NOT_FOUND" })
      return
    }
    waiting.current.set(group, { tool, toolCallId })
    setGroups((current) => ({ ...current, [toolCallId]: group }))
  }

  useEffect(
    () =>
      mergeRegister(
        editor.registerCommand(
          RESOLVE_SUGGESTION_COMMAND,
          ({ group, decision }) => {
            decisions.current.set(group, decision)
            return false
          },
          COMMAND_PRIORITY_NORMAL
        ),
        editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
          setSelectedText(editorState.read(() => $captureSelection().selection?.text ?? ""))
          if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return
          const pending = editorState.read($pendingGroups)
          setPendingGroups((previous) =>
            previous.size === pending.size && [...pending].every((group) => previous.has(group))
              ? previous
              : pending
          )
          for (const [group, { tool, toolCallId }] of waiting.current) {
            if (pending.has(group)) continue
            waiting.current.delete(group)
            const decision = decisions.current.get(group)
            decisions.current.delete(group)
            latestAnswer.current(
              tool,
              toolCallId,
              decision ? { applied: decision === "accept" } : { applied: false, error: "STALE" }
            )
          }
        })
      ),
    [editor]
  )

  const busy = chat.status === "submitted" || chat.status === "streaming"
  const last = chat.messages.at(-1)
  const awaitingAuthor =
    last?.role === "assistant" &&
    last.parts.some(
      (part) =>
        isToolUIPart(part) && isEditorTool(getToolName(part)) && part.state === "input-available"
    )

  return {
    messages: chat.messages,
    status: chat.status,
    busy,
    awaitingAuthor,
    error: chat.error ? errorMessage(chat.error) : null,
    quota: quota.data ?? null,
    selectedText,
    groupOf: (toolCallId: string) => groups[toolCallId] as string | undefined,
    isPending: (group: string) => pendingGroups.has(group),
    resolve: (group: string, decision: SuggestionDecision) =>
      editor.dispatchCommand(RESOLVE_SUGGESTION_COMMAND, { group, decision }),
    decideTitle: (toolCallId: string, title: string, accept: boolean) => {
      if (accept) onPickTitle(title.slice(0, MAX_BLOG_TITLE_LENGTH))
      answer("setTitle", toolCallId, { applied: accept }, requestOptions(accept ? { title } : {}))
    },
    decideImage: (toolCallId: string, input: unknown, accept: boolean) => {
      const image = editorToolInputs.insertImage.safeParse(input)
      if (!accept || !image.success) {
        answer("insertImage", toolCallId, { applied: false })
        return
      }
      let error: EditError | null = null
      try {
        editor.update(
          () => {
            const { url, alt, position, after, replaces } = image.data
            error = $applyInsertImage(url, alt, position, after, replaces, captured.current)
          },
          { discrete: true }
        )
      } catch (cause) {
        console.error(cause)
        error = "NOT_FOUND"
      }
      answer("insertImage", toolCallId, error ? { applied: false, error } : { applied: true })
    },
    send: (text: string) => {
      captured.current = editor.getEditorState().read($captureSelection)
      chat.clearError()
      void chat.sendMessage({ text }, requestOptions({ withSelection: true }))
    },
    retry: () => {
      chat.clearError()
      void chat.regenerate(requestOptions())
    },
    reset: () => {
      void chat.stop()
      chat.clearError()
      waiting.current.clear()
      decisions.current.clear()
      setGroups({})
      chat.setMessages([])
    },
  }
}

export type WritingAssistant = ReturnType<typeof useWritingAssistant>
