"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useChat } from "@ai-sdk/react"
import { APICallError, DefaultChatTransport, isToolUIPart, type UIMessage } from "ai"

import { useAuth } from "@/features/auth/hooks/use-auth"
import {
  DAY_LABELS,
  MEAL_PLANNER_CHAT_URL,
  proposalSchema,
  SECTION_LABELS,
  type MealPlanProposal,
} from "@/features/meal-plan/meal-plan"

/** Mirror `MealPlannerChatDto` in vedora-api. */
const CONTEXT_MESSAGES = 10
const MAX_TEXT_LENGTH = 4000

export type ProposalStatus = "applied" | "dismissed"
type Statuses = Record<string, ProposalStatus>

export interface Proposal extends MealPlanProposal {
  id: string
}

/** vedora-api marks its fixed refusals with `{ refused: true }`. */
type PlannerMessage = UIMessage<{ refused?: boolean }>

const WELCOME: PlannerMessage = {
  id: "welcome",
  role: "assistant",
  parts: [
    {
      type: "text",
      text: "Chào bạn! Mình lên thực đơn tuần theo những gì bạn không ăn, không xếp các nguyên liệu kỵ nhau vào cùng một ngày, và trả lời câu hỏi về dinh dưỡng thực vật. Bạn muốn bắt đầu thế nào?",
    },
  ],
}

export function messageText(message: UIMessage) {
  // the planner may speak before and after using a tool: keep those apart
  return message.parts
    .flatMap((part) => (part.type === "text" && part.text ? [part.text] : []))
    .join("\n\n")
}

/** The proposals the planner showed in this message; rejected ones never reach the user. */
export function messageProposals(message: UIMessage): Proposal[] {
  return message.parts.flatMap((part) => {
    if (part.type !== "tool-proposeMealPlan" || part.state !== "output-available") return []
    const proposal = proposalSchema.safeParse(part.output)
    return proposal.success && proposal.data.ok
      ? [{ ...proposal.data, id: part.toolCallId }]
      : []
  })
}

// The API takes plain text turns, so a proposal rides along as a note the
// planner can read: what it offered and whether the user took it.
function contextText(message: UIMessage, statuses: Statuses) {
  const notes = messageProposals(message).map((proposal) => {
    const meals = proposal.days
      .map(({ day, sections }) => {
        const filled = sections
          .filter(({ recipes }) => recipes.length > 0)
          .map(
            ({ section, recipes }) =>
              `${SECTION_LABELS[section].toLowerCase()}: ${recipes.map(({ title, id }) => `${title} (id ${id})`).join(", ")}`
          )
        return `${DAY_LABELS[day]} (${filled.length > 0 ? filled.join("; ") : "trống"})`
      })
      .join(" | ")
    const status =
      statuses[proposal.id] === "applied"
        ? "người dùng đã áp dụng"
        : statuses[proposal.id] === "dismissed"
          ? "người dùng đã bỏ qua"
          : "chưa áp dụng"
    return `[Đề xuất (${status}): ${meals}]`
  })
  return [messageText(message), ...notes].filter(Boolean).join("\n").slice(0, MAX_TEXT_LENGTH)
}

// a refused request must not ride along as context for the next message
function withoutRefusals(messages: PlannerMessage[]) {
  return messages.filter(
    (message, index) => !message.metadata?.refused && !messages[index + 1]?.metadata?.refused
  )
}

const transport = new DefaultChatTransport<PlannerMessage>({
  api: MEAL_PLANNER_CHAT_URL,
  prepareSendMessagesRequest: ({ messages, headers, body }) => {
    const statuses = (body?.statuses ?? {}) as Statuses
    return {
      headers,
      body: {
        messages: withoutRefusals(messages.filter((message) => message.id !== WELCOME.id))
          .map((message) => ({ role: message.role, text: contextText(message, statuses) }))
          .filter((message) => message.text)
          .slice(-CONTEXT_MESSAGES),
      },
    }
  },
})

function errorMessage(error: Error) {
  if (APICallError.isInstance(error) && error.statusCode === 429) {
    return "Bạn gửi hơi nhanh. Đợi một chút rồi nhắn tiếp nhé."
  }
  if (APICallError.isInstance(error) && error.statusCode === 503) {
    return "Trợ lý đang tạm nghỉ. Bạn quay lại sau nhé."
  }
  if (error.message === "RATE_LIMITED") {
    return "Trợ lý đang quá tải. Bạn thử lại sau ít phút nhé."
  }
  return "Mình chưa trả lời được. Thử lại nhé."
}

/** The conversation with vedora-api's `POST /meal-plan/chat`. */
export function useMealPlannerChat() {
  const router = useRouter()
  const { accessToken } = useAuth()
  const [statuses, setStatuses] = useState<Statuses>({})

  const { messages, status, error, sendMessage, setMessages, stop, clearError } = useChat<PlannerMessage>({
    transport,
    messages: [WELCOME],
    onError: (error) => {
      if (APICallError.isInstance(error) && error.statusCode === 401) router.refresh()
    },
  })

  const busy = status === "submitted" || status === "streaming"
  const last = messages.at(-1)
  const runningTool =
    busy && last?.role === "assistant"
      ? last.parts.find((part) => isToolUIPart(part) && part.state !== "output-available")
      : undefined
  const working = runningTool !== undefined
  const replying = busy && last?.role === "assistant" && messageText(last) !== "" && !working

  return {
    messages,
    busy,
    /** Nothing readable is streaming yet: the planner is thinking or using a tool. */
    waiting: busy && !replying,
    working,
    /** The planner is reading the nutrition documents rather than picking dishes. */
    researching: runningTool?.type === "tool-searchKnowledge",
    streamingId: replying ? last.id : null,
    /** Only the newest proposal can still be applied. */
    latestProposalId: messages.flatMap(messageProposals).at(-1)?.id ?? null,
    statuses,
    setProposalStatus: (id: string, next: ProposalStatus) =>
      setStatuses((current) => ({ ...current, [id]: next })),
    error: error ? errorMessage(error) : null,
    send: (text: string) =>
      void sendMessage(
        { text },
        {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
          body: { statuses },
        }
      ),
    reset: () => {
      void stop()
      clearError()
      setStatuses({})
      setMessages([WELCOME])
    },
  }
}

export type MealPlannerChat = ReturnType<typeof useMealPlannerChat>
