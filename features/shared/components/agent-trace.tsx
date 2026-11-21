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
  GlobeIcon,
  ImageIcon,
  LibraryIcon,
  SearchIcon,
  UtensilsIcon,
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
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { problemSchema, problemText } from "@/features/meal-plan/meal-plan"

// Mirror the inputs and outputs of vedora-api's agent tools.
const queryInputSchema = z.object({ query: z.string().optional() })
const knowledgeHitSchema = z.object({ title: z.string(), page: z.number(), text: z.string() })
// The tool answers `{ status: "ok", hits }`, or `{ status: "unavailable" }` when the search failed.
const knowledgeSearchSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ok"), hits: z.array(knowledgeHitSchema) }),
  z.object({ status: z.literal("unavailable") }),
])

function knowledgeSearchOf(output: unknown) {
  return knowledgeSearchSchema.safeParse(output).data
}
const recipesSchema = z.array(z.object({ id: z.string(), title: z.string() }))
const restaurantDishesSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    restaurant: z.object({ name: z.string() }),
  })
)
const proposalCheckSchema = z.object({ ok: z.boolean(), problems: z.array(problemSchema) })
const webSearchDecisionSchema = z.object({ approved: z.boolean() })
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

function editDraftTitle(isEdit: boolean, failed: boolean, rejected: boolean, done: boolean): string {
  if (failed) return isEdit ? "Không chỉnh được bản nháp thực đơn" : "Không kiểm tra được thực đơn"
  if (rejected) return isEdit ? "Chỉnh sửa chưa đạt, đổi món khác" : "Đề xuất chưa đạt, chọn lại món"
  if (done) return isEdit ? "Đã cập nhật bản nháp thực đơn" : "Đã kiểm tra thực đơn đề xuất"
  return isEdit ? "Đang cập nhật bản nháp thực đơn…" : "Đang kiểm tra thực đơn đề xuất"
}

function fillSlotsTitle(failed: boolean, rejected: boolean, done: boolean): string {
  if (failed) return "Không lên được thực đơn tự động"
  if (rejected) return "Đề xuất chưa đạt, chọn lại món"
  if (done) return "Đã chọn món vào bản nháp"
  return "Đang chọn món cho thực đơn…"
}

function toolStep(part: ToolUIPart | DynamicToolUIPart): Step {
  const name = getToolName(part)
  const query = queryInputSchema.safeParse(part.input).data?.query?.trim()
  const done = part.state === "output-available"
  const failed = part.state === "output-error" || part.state === "output-denied"
  const status = failed ? "error" : done ? undefined : "running"
  const key = part.toolCallId

  if (name === "searchKnowledge") {
    const result = done ? knowledgeSearchOf(part.output) : undefined
    const hits = result?.status === "ok" ? result.hits : []
    // A search that could not run is not the same as one that found nothing.
    const unavailable = failed || result?.status === "unavailable"
    let title = `Đang tra cứu tài liệu${quoted(query)}`
    if (unavailable) title = `Không tra cứu được${quoted(query)}`
    else if (done) title = `Đã tra cứu tài liệu${quoted(query)}`

    let description: string | undefined
    if (done && !unavailable) description = hits.length > 0 ? `${hits.length} đoạn` : "Không có kết quả"

    return {
      key,
      status: unavailable ? "error" : status,
      icon: <BookOpenIcon />,
      title,
      description,
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

  if (name === "searchRestaurantDishes") {
    const dishes = done ? (restaurantDishesSchema.safeParse(part.output).data ?? []) : []
    const suffix = quoted(query)
    return {
      key,
      status,
      icon: <UtensilsIcon />,
      title: failed
        ? `Không tìm được món tại nhà hàng${suffix}`
        : done
          ? `Đã tìm món tại nhà hàng${suffix}`
          : `Đang tìm món tại nhà hàng${suffix}…`,
      description: done ? `${dishes.length} món` : undefined,
      detail:
        dishes.length > 0 ? (
          <p>{dishes.map((dish) => `${dish.name} · ${dish.restaurant.name}`).join(", ")}</p>
        ) : undefined,
    }
  }

  if (name === "proposeMealPlan" || name === "editDraft") {
    const check = done ? proposalCheckSchema.safeParse(part.output).data : undefined
    const rejected = check !== undefined && !check.ok && check.problems.length > 0
    return {
      key,
      status: rejected ? "error" : status,
      icon: <CalendarCheckIcon />,
      title: editDraftTitle(name === "editDraft", failed, rejected, done),
      detail: rejected ? (
        <ul className="flex list-disc flex-col gap-1 pl-4">
          {check.problems.map((problem, index) => (
            <li key={index}>{problemText(problem)}</li>
          ))}
        </ul>
      ) : undefined,
    }
  }

  if (name === "fillSlots" || name === "generateMealPlan") {
    const check = done ? proposalCheckSchema.safeParse(part.output).data : undefined
    const rejected = check !== undefined && !check.ok && check.problems.length > 0
    return {
      key,
      status: rejected ? "error" : status,
      icon: <CalendarCheckIcon />,
      title: fillSlotsTitle(failed, rejected, done),
      detail: rejected ? (
        <ul className="flex list-disc flex-col gap-1 pl-4">
          {check.problems.map((problem, index) => (
            <li key={index}>{problemText(problem)}</li>
          ))}
        </ul>
      ) : undefined,
    }
  }

  // It waits for the user's answer on the consent card, so it never shows as running.
  if (name === "requestWebSearch") {
    const decision = done ? webSearchDecisionSchema.safeParse(part.output).data : undefined
    let title = "Xin phép tìm trên web"
    if (decision?.approved === true) title = "Bạn đã cho phép tìm trên web"
    if (decision?.approved === false) title = "Bạn đã không cho phép tìm trên web"
    return { key, icon: <GlobeIcon />, title }
  }

  if (name === "getPlan") {
    return {
      key,
      status,
      icon: <CalendarCheckIcon />,
      title: failed
        ? "Không xem được thực đơn hiện tại"
        : done
          ? "Đã xem thực đơn hiện tại"
          : "Đang xem thực đơn hiện tại…",
    }
  }

  if (name === "getRecipe") {
    return {
      key,
      status,
      icon: <BookOpenIcon />,
      title: failed
        ? "Không xem được công thức"
        : done
          ? "Đã xem chi tiết công thức"
          : "Đang xem chi tiết công thức…",
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
function documentSources(message: UIMessage) {
  const pages = new Map<string, Set<number>>()
  for (const part of message.parts) {
    if (!isToolUIPart(part) || getToolName(part) !== "searchKnowledge") continue
    if (part.state !== "output-available") continue
    const result = knowledgeSearchOf(part.output)
    if (result?.status !== "ok") continue
    for (const { title, page } of result.hits) {
      pages.set(title, (pages.get(title) ?? new Set()).add(page))
    }
  }
  const documents: { title: string; pages: number[] }[] = []
  for (const [title, found] of pages) {
    documents.push({ title, pages: [...found].sort((a, b) => a - b) })
  }
  return documents
}

function hostname(url: string): string {
  if (!URL.canParse(url)) return url
  return new URL(url).hostname.replace(/^www\./, "")
}

/** The web pages a web search cited, once each, in the order they came. */
function webSources(message: UIMessage) {
  const byUrl = new Map<string, { url: string; title: string }>()
  for (const part of message.parts) {
    if (part.type !== "source-url" || byUrl.has(part.url)) continue
    if (!part.url.startsWith("https://") && !part.url.startsWith("http://")) continue
    byUrl.set(part.url, { url: part.url, title: part.title || hostname(part.url) })
  }
  return [...byUrl.values()]
}

/**
 * Everything a reply drew on: Vedora's documents and, when the user allowed
 * it, web pages. A small "Nguồn" button under the reply opens the list on
 * hover, focus or tap, so it also works on touch screens.
 */
export function MessageSources({ message }: { message: UIMessage }) {
  const documents = documentSources(message)
  const pages = webSources(message)
  const count = documents.length + pages.length
  if (count === 0) return null
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        closeDelay={200}
        render={<Button variant="tool" size="xs" className="mt-1 self-start" />}
      >
        {pages.length > 0 ? <GlobeIcon aria-hidden /> : <LibraryIcon aria-hidden />}
        Nguồn · {count}
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-80 max-w-[calc(100vw-2rem)]">
        <PopoverHeader>
          <PopoverTitle>Nguồn trợ lý đã tham khảo</PopoverTitle>
        </PopoverHeader>
        {documents.length > 0 && (
          <section aria-label="Tài liệu của Vedora" className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">Tài liệu của Vedora</p>
            <ul className="flex flex-col gap-1.5">
              {documents.map(({ title, pages: found }) => (
                <li key={title} className="flex min-w-0 items-start gap-2">
                  <FileTextIcon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block truncate">{title}</span>
                    <span className="block text-xs text-muted-foreground">tr. {found.join(", ")}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {pages.length > 0 && (
          <section aria-label="Trên web" className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">Trên web</p>
            <ul className="flex flex-col gap-1.5">
              {pages.map(({ url, title }) => (
                <li key={url} className="flex min-w-0 items-start gap-2">
                  <GlobeIcon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="block truncate underline-offset-4 hover:underline focus-visible:underline"
                    >
                      {title}
                    </a>
                    <span className="block truncate text-xs text-muted-foreground">{hostname(url)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
              Thông tin từ web có thể sai, đã cũ hoặc không thống nhất giữa các nguồn, và Vedora không kiểm chứng.
            </p>
          </section>
        )}
      </PopoverContent>
    </Popover>
  )
}
