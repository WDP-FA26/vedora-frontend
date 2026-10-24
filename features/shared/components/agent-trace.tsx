"use client"

import type { ReactNode } from "react"
import {
  getToolName,
  isToolUIPart,
  type DynamicToolUIPart,
  type ToolUIPart,
  type UIMessage,
} from "ai"
import {
  BookOpenIcon,
  BrainIcon,
  CalendarCheckIcon,
  FileTextIcon,
  ImageIcon,
  LibraryIcon,
  SearchIcon,
  WrenchIcon,
} from "lucide-react"
import { z } from "zod"

import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace"
import { problemSchema, problemText } from "@/features/meal-plan/meal-plan"

// Mirror the inputs and outputs of vedora-api's agent tools.
const queryInputSchema = z.object({ query: z.string().optional() })
const knowledgeHitsSchema = z.array(
  z.object({ title: z.string(), page: z.number(), text: z.string() })
)
const recipesSchema = z.array(z.object({ id: z.string(), title: z.string() }))
const proposalCheckSchema = z.object({ ok: z.boolean(), problems: z.array(problemSchema) })
const imageResultSchema = z.union([z.object({ url: z.string() }), z.object({ error: z.string() })])

const IMAGE_ERRORS: Record<string, string> = {
  IMAGE_QUOTA_EXCEEDED: "Hết lượt tạo ảnh hôm nay",
  IMAGE_PROMPT_REFUSED: "Không thể tạo ảnh này",
  IMAGE_NOT_OWNED: "Chỉ sửa được ảnh của bạn",
}

type Step = {
  key: string
  status?: "running" | "error"
  icon: ReactNode
  title: string
  description?: string
  detail?: ReactNode
}

function quoted(query: string | undefined) {
  return query ? ` “${query}”` : ""
}

function toolStep(part: ToolUIPart | DynamicToolUIPart): Step {
  const name = getToolName(part)
  const query = queryInputSchema.safeParse(part.input).data?.query?.trim()
  const done = part.state === "output-available"
  const failed = part.state === "output-error" || part.state === "output-denied"
  const status = failed ? "error" : done ? undefined : "running"
  const key = part.toolCallId

  if (name === "searchKnowledge") {
    const hits = done ? (knowledgeHitsSchema.safeParse(part.output).data ?? []) : []
    return {
      key,
      status,
      icon: <BookOpenIcon />,
      title: failed
        ? `Không tra cứu được${quoted(query)}`
        : done
          ? `Đã tra cứu tài liệu${quoted(query)}`
          : `Đang tra cứu tài liệu${quoted(query)}`,
      description: done ? (hits.length > 0 ? `${hits.length} đoạn` : "Không có kết quả") : undefined,
      detail:
        hits.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {hits.map(({ title, page, text }, index) => (
              <li key={index}>
                <span className="text-foreground">{title}</span> · tr. {page}
                <p className="line-clamp-2 text-xs">{text}</p>
              </li>
            ))}
          </ul>
        ) : undefined,
    }
  }

  if (name === "searchRecipes") {
    const recipes = done ? (recipesSchema.safeParse(part.output).data ?? []) : []
    const target = query ? `tìm món${quoted(query)}` : "xem danh sách món"
    return {
      key,
      status,
      icon: <SearchIcon />,
      title: failed ? `Không ${target} được` : done ? `Đã ${target}` : `Đang ${target}`,
      description: done ? `${recipes.length} món` : undefined,
      detail:
        recipes.length > 0 ? <p>{recipes.map(({ title }) => title).join(", ")}</p> : undefined,
    }
  }

  if (name === "proposeMealPlan") {
    const check = done ? proposalCheckSchema.safeParse(part.output).data : undefined
    const rejected = check !== undefined && !check.ok
    return {
      key,
      status: rejected ? "error" : status,
      icon: <CalendarCheckIcon />,
      title: failed
        ? "Không kiểm tra được thực đơn"
        : rejected
          ? "Đề xuất chưa đạt, chọn lại món"
          : done
            ? "Đã kiểm tra thực đơn đề xuất"
            : "Đang kiểm tra thực đơn đề xuất",
      detail: rejected ? (
        <ul className="flex list-disc flex-col gap-1 pl-4">
          {check.problems.map((problem, index) => (
            <li key={index}>{problemText(problem)}</li>
          ))}
        </ul>
      ) : undefined,
    }
  }

  if (name === "generateImage" || name === "editImage") {
    const result = done ? imageResultSchema.safeParse(part.output).data : undefined
    const error = result && "error" in result ? (IMAGE_ERRORS[result.error] ?? "Tạo ảnh không thành công") : undefined
    const verb = name === "generateImage" ? "tạo ảnh minh hoạ" : "chỉnh ảnh"
    return {
      key,
      status: error || failed ? "error" : status,
      icon: <ImageIcon />,
      title: failed ? `Không ${verb} được` : done ? `Đã ${verb}` : `Đang ${verb}…`,
      description: error,
    }
  }

  return {
    key,
    status,
    icon: <WrenchIcon />,
    title: failed ? `Lỗi khi dùng ${name}` : done ? `Đã dùng ${name}` : `Đang dùng ${name}`,
  }
}

/** The tool calls of an assistant message, in the order they happened. */
function traceSteps(message: UIMessage): Step[] {
  return message.parts.flatMap((part) => (isToolUIPart(part) ? [toolStep(part)] : []))
}

export function hasTrace(message: UIMessage) {
  return traceSteps(message).length > 0
}

function StepLine({ step }: { step: Step }) {
  return (
    <TraceLine status={step.status}>
      <TraceIcon>{step.icon}</TraceIcon>
      <TraceTitle>{step.title}</TraceTitle>
      {step.description && <TraceDescription>{step.description}</TraceDescription>}
    </TraceLine>
  )
}

function CollapsibleStep({ step }: { step: Step }) {
  return (
    <TraceCollapsible>
      <TraceCollapsibleTrigger>
        <StepLine step={step} />
      </TraceCollapsibleTrigger>
      <TraceCollapsibleContent>{step.detail}</TraceCollapsibleContent>
    </TraceCollapsible>
  )
}

/**
 * The assistant's tool calls above its reply. `pending` adds a
 * thinking row while the agent works between steps.
 */
export function AgentTrace({ message, pending = false }: { message: UIMessage; pending?: boolean }) {
  const steps = traceSteps(message)
  const idle = pending && !steps.some(({ status }) => status === "running")
  if (steps.length === 0 && !idle) return null
  return (
    <Trace className="mb-2">
      {steps.map((step) =>
        step.detail ? (
          <CollapsibleStep key={step.key} step={step} />
        ) : (
          <StepLine key={step.key} step={step} />
        )
      )}
      {idle && (
        <TraceLine status="running">
          <TraceIcon>
            <BrainIcon />
          </TraceIcon>
          <TraceTitle>Đang suy nghĩ…</TraceTitle>
        </TraceLine>
      )}
    </Trace>
  )
}

/** The documents the knowledge searches returned, grouped by file. */
function messageSources(message: UIMessage) {
  const pages = new Map<string, Set<number>>()
  for (const part of message.parts) {
    if (!isToolUIPart(part) || getToolName(part) !== "searchKnowledge") continue
    if (part.state !== "output-available") continue
    for (const { title, page } of knowledgeHitsSchema.safeParse(part.output).data ?? []) {
      pages.set(title, (pages.get(title) ?? new Set()).add(page))
    }
  }
  return [...pages].map(([title, found]) => ({
    title,
    pages: [...found].sort((a, b) => a - b),
  }))
}

export function AgentSources({ message }: { message: UIMessage }) {
  const sources = messageSources(message)
  if (sources.length === 0) return null
  return (
    <Trace className="mt-2">
      <TraceCollapsible>
        <TraceCollapsibleTrigger>
          <TraceLine>
            <TraceIcon>
              <LibraryIcon />
            </TraceIcon>
            <TraceTitle>Nguồn đã tra cứu</TraceTitle>
            <TraceDescription>{sources.length} tài liệu</TraceDescription>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          <Trace>
            {sources.map(({ title, pages }) => (
              <TraceLine key={title}>
                <TraceIcon>
                  <FileTextIcon />
                </TraceIcon>
                <TraceTitle>{title}</TraceTitle>
                <TraceDescription>tr. {pages.join(", ")}</TraceDescription>
              </TraceLine>
            ))}
          </Trace>
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  )
}
