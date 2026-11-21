"use client"

import { useEffect, useImperativeHandle, useRef, useState, type FormEvent, type Ref } from "react"
import {
  ArrowUpIcon,
  CheckIcon,
  ExternalLinkIcon,
  GlobeIcon,
  MinusIcon,
  RotateCcwIcon,
  SparklesIcon,
  VideoIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/features/auth/hooks/use-auth"
import {
  RecipeVideoPicker,
  type PickedVideo,
} from "@/features/recipes/components/recipe-video-picker"
import { requestRecipeDraft, type RecipeDraftSource } from "@/features/recipes/lib/recipes-api"
import type { DraftRecipe, Ingredient, RecipeFormValues } from "@/features/recipes/schemas"
import { ApiError } from "@/features/shared/lib/api-client"
import { LogoMark } from "@/features/shared/components/wordmark"
import { cn } from "@/lib/utils"

const MAX_TEXT_LENGTH = 20000

export type RecipeAiHandle = {
  openWithAi: () => void
  openChat: () => void
  pickVideo: () => void
}

type AdminChatMessage = {
  id: string
  role: "user" | "assistant"
  text: string
  failed?: boolean
  draft?: DraftRecipe
  applied?: boolean
}

function messageBubbleClass(msg: AdminChatMessage): string {
  if (msg.role === "user") return "bg-primary text-primary-foreground rounded-br-sm"
  if (msg.failed) {
    return "border border-destructive/30 bg-destructive/5 text-destructive rounded-bl-sm"
  }
  return "border border-border bg-background text-foreground rounded-bl-sm"
}

function buildSnapshotText(values: RecipeFormValues, catalog: readonly Ingredient[]): string | null {
  const title = values.title.trim()
  const ingredientLines = values.ingredients
    .map((item) => {
      const name = catalog.find((entry) => entry.id === item.ingredientId)?.name ?? item.draftName
      if (!name) return ""
      const amount = [item.quantity, item.unit].filter(Boolean).join(" ")
      const tail = item.note ? ` (${item.note})` : ""
      return `- ${amount ? `${amount} ` : ""}${name}${tail}`
    })
    .filter(Boolean)
  const stepLines = values.steps
    .map((step, index) => (step.text.trim() ? `${index + 1}. ${step.text.trim()}` : ""))
    .filter(Boolean)

  if (!title && ingredientLines.length === 0 && stepLines.length === 0) return null

  const parts: string[] = [
    "[Công thức hiện tại trên form]",
    `Tên món: ${title || "Chưa đặt tên"}`,
    `Khẩu phần: ${values.servings || "2"}`,
  ]
  if (values.description.trim()) parts.push(`Mô tả: ${values.description.trim()}`)
  if (values.caloriesPerServing.trim()) {
    parts.push(`Kcal/suất đang nhập: ${values.caloriesPerServing.trim()}`)
  }
  if (ingredientLines.length > 0) {
    parts.push(`Nguyên liệu:\n${ingredientLines.join("\n")}`)
  }
  if (stepLines.length > 0) {
    parts.push(`Các bước:\n${stepLines.join("\n")}`)
  }
  return parts.join("\n")
}

function failureMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return "Không gọi được AI. Kiểm tra mạng rồi thử lại nhé."
  if (error.code === "EMPTY_RECIPE_SOURCE") {
    const waiting = Number(error.details?.untranscribedVideos ?? 0)
    if (waiting > 0) {
      return "Bài đăng chưa có chữ, và video vẫn đang được tạo phụ đề. Thử lại sau ít phút."
    }
    return "Bài đăng không có chữ hay lời nói nào để AI đọc."
  }
  if (error.status === 404) return "Không tìm thấy bài đăng hoặc video này nữa."
  if (error.status === 502) return "AI đang bận hoặc trả lời quá lâu. Thử lại nhé."
  return "AI chưa xử lý được. Thử lại nhé."
}

/**
 * Floating bottom-right AI assistant bubble & panel for recipe admins.
 * Extracts recipes from linked posts/videos/captions, searches the web for calories
 * with clickable sources, and lets the admin chat interactively to refine fields.
 */
export function RecipeAiFill({
  handle,
  postId,
  hasContent,
  catalog,
  getFormSnapshot,
  onFill,
  onLinkPost,
}: {
  handle?: Ref<RecipeAiHandle>
  postId: string | null
  hasContent: boolean
  catalog: readonly Ingredient[]
  getFormSnapshot: () => RecipeFormValues
  onFill: (recipe: DraftRecipe) => void
  onLinkPost: (postId: string) => void
}) {
  const { accessToken } = useAuth()
  const [open, setOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const [reading, setReading] = useState(false)
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<AdminChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Chào Admin! Mình có thể đọc công thức từ bài đăng/video, dán caption của bạn hoặc tra web để tính Kcal kèm nguồn tham khảo.",
    },
  ])
  const scrollEnd = useRef<HTMLDivElement>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      scrollEnd.current?.scrollIntoView({ block: "end" })
    }
  }, [open, messages, reading])

  function applyDraftToForm(draft: DraftRecipe, messageId?: string) {
    onFill(draft)
    if (messageId) {
      setMessages((current) =>
        current.map((item) => (item.id === messageId ? { ...item, applied: true } : item))
      )
    }
  }

  async function runDraft({
    source,
    userLabel,
    autoApplyWhenEmpty,
  }: {
    source: RecipeDraftSource
    userLabel: string
    autoApplyWhenEmpty: boolean
  }) {
    if (!accessToken || reading) return
    setOpen(true)
    const userMsg: AdminChatMessage = {
      id: `user-${crypto.randomUUID()}`,
      role: "user",
      text: userLabel,
    }
    setMessages((current) => [...current, userMsg])
    setReading(true)

    try {
      const response = await requestRecipeDraft(accessToken, source)
      const waiting =
        response.untranscribedVideos > 0
          ? " Một số video chưa có phụ đề nên AI chưa nghe được."
          : ""

      if (!response.recipe) {
        setMessages((current) => [
          ...current,
          {
            id: `assistant-${crypto.randomUUID()}`,
            role: "assistant",
            failed: true,
            text: `AI chưa trích xuất được công thức rõ ràng từ nội dung này.${waiting}`,
          },
        ])
        return
      }

      const recipe = response.recipe
      const shouldAutoApply = autoApplyWhenEmpty && !hasContent
      if (shouldAutoApply) onFill(recipe)

      const unmatched = recipe.ingredients.filter((item) => !item.match).length
      const summaryParts = [
        shouldAutoApply
          ? `Mình đã điền sẵn “${recipe.title}” vào biểu mẫu.`
          : `Mình đã chuẩn bị xong bản đề xuất cho “${recipe.title}”.`,
      ]
      if (recipe.calorieNote) summaryParts.push(recipe.calorieNote)
      if (unmatched > 0) {
        summaryParts.push(
          `Lưu ý: có ${unmatched} nguyên liệu chưa khớp danh mục, sau khi áp dụng bạn nhớ bấm “Tạo nguyên liệu” ở dòng đó nhé.`
        )
      }
      if (waiting) summaryParts.push(waiting.trim())

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${crypto.randomUUID()}`,
          role: "assistant",
          text: summaryParts.join(" "),
          draft: recipe,
          applied: shouldAutoApply,
        },
      ])
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${crypto.randomUUID()}`,
          role: "assistant",
          failed: true,
          text: failureMessage(error),
        },
      ])
    } finally {
      setReading(false)
    }
  }

  function handleOpenWithAi() {
    setOpen(true)
    if (reading) return
    if (postId) {
      void runDraft({
        source: { postId },
        userLabel: "Đọc công thức & tra web tính Kcal từ bài đăng đang gắn",
        autoApplyWhenEmpty: true,
      })
      return
    }
    const snapshot = buildSnapshotText(getFormSnapshot(), catalog)
    if (snapshot) {
      const prompt = `${snapshot}\n\n[Yêu cầu của Admin]\nHãy rà soát lại công thức trên, dùng web search ước tính Kcal cho 1 suất ăn và giải thích kèm nguồn tham khảo.`.slice(
        0,
        MAX_TEXT_LENGTH
      )
      void runDraft({
        source: { text: prompt },
        userLabel: "Tra web tính Kcal & rà soát công thức đang nhập",
        autoApplyWhenEmpty: false,
      })
      return
    }
    requestAnimationFrame(() => textarea.current?.focus())
  }

  useImperativeHandle(handle, () => ({
    openWithAi: handleOpenWithAi,
    openChat: () => {
      setOpen(true)
      requestAnimationFrame(() => textarea.current?.focus())
    },
    pickVideo: () => setPicking(true),
  }))

  function readVideo(video: PickedVideo) {
    onLinkPost(video.postId)
    void runDraft({
      source: { postId: video.postId, mediaId: video.mediaId },
      userLabel: "Đọc video vừa chọn & tra web tính Kcal cho món ăn",
      autoApplyWhenEmpty: true,
    })
  }

  function sendChatMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || reading) return
    setInput("")
    const snapshot = buildSnapshotText(getFormSnapshot(), catalog)
    const fullPrompt = snapshot
      ? `${snapshot}\n\n[Yêu cầu của Admin]\n${trimmed}`.slice(0, MAX_TEXT_LENGTH)
      : trimmed.slice(0, MAX_TEXT_LENGTH)
    void runDraft({
      source: { text: fullPrompt },
      userLabel: trimmed,
      autoApplyWhenEmpty: false,
    })
  }

  function resetChat() {
    if (reading) return
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        text: "Đã làm mới cuộc trò chuyện. Bạn có thể dán công thức, yêu cầu sửa món hoặc tra lại Kcal từ web bất kỳ lúc nào.",
      },
    ])
  }

  return (
    <>
      <RecipeVideoPicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={readVideo}
      />

      <div className="fixed right-4 bottom-4 z-40 sm:right-6 sm:bottom-6">
        {open ? (
          <section
            aria-label="Trợ lý AI hỗ trợ Admin"
            className="flex h-[min(34rem,calc(100dvh-2rem))] w-[min(26rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            <header className="flex shrink-0 items-center gap-2 border-b border-border bg-secondary/40 px-3.5 py-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-secondary">
                <LogoMark className="size-6" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold leading-tight">Trợ lý AI cho Admin</h2>
                <p className="truncate text-[0.6875rem] text-muted-foreground">
                  Điền công thức &amp; tra Kcal qua Web Search
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Làm mới hội thoại"
                disabled={reading}
                onClick={resetChat}
              >
                <RotateCcwIcon aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Thu gọn trợ lý"
                onClick={() => setOpen(false)}
              >
                <MinusIcon aria-hidden />
              </Button>
            </header>

            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex flex-wrap gap-1.5">
                {postId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={reading}
                    onClick={() =>
                      void runDraft({
                        source: { postId },
                        userLabel: "Đọc lại từ bài đăng đang gắn",
                        autoApplyWhenEmpty: false,
                      })
                    }
                  >
                    <SparklesIcon aria-hidden /> Đọc từ bài đăng
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={reading}
                  onClick={() => setPicking(true)}
                >
                  <VideoIcon aria-hidden /> Chọn video
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={reading}
                  onClick={() => {
                    const snapshot = buildSnapshotText(getFormSnapshot(), catalog)
                    if (!snapshot) {
                      requestAnimationFrame(() => textarea.current?.focus())
                      return
                    }
                    const prompt = `${snapshot}\n\n[Yêu cầu của Admin]\nChỉ dựa vào món và nguyên liệu trên form, hãy tra cứu web search để tính Kcal / 1 suất và nêu rõ nguồn tham khảo.`
                    void runDraft({
                      source: { text: prompt.slice(0, MAX_TEXT_LENGTH) },
                      userLabel: "Tra web tính Kcal cho món trên form",
                      autoApplyWhenEmpty: false,
                    })
                  }}
                >
                  <GlobeIcon aria-hidden /> Tra web tính Kcal
                </Button>
              </div>

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col gap-1.5 text-xs leading-5",
                    msg.role === "user" ? "items-end" : "items-start"
                  )}
                >
                  {msg.role === "assistant" && (
                    <span className="flex items-center gap-1.5 text-[0.6875rem] font-semibold text-foreground">
                      <LogoMark className="size-5" />
                      Trợ lý Vedora
                    </span>
                  )}
                  <div className={cn("max-w-[92%] rounded-2xl px-3 py-2", messageBubbleClass(msg))}>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>

                  {msg.draft && (
                    <div className="w-[95%] space-y-2 rounded-xl border border-border bg-secondary/25 p-2.5 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="font-semibold text-foreground">{msg.draft.title}</span>
                        {typeof msg.draft.caloriesPerServing === "number" && (
                          <Badge variant="secondary">
                            ~{msg.draft.caloriesPerServing} kcal/suất
                          </Badge>
                        )}
                      </div>
                      <p className="text-[0.6875rem] text-muted-foreground">
                        {msg.draft.servings ?? "?"} khẩu phần · {msg.draft.ingredients.length} nguyên liệu · {msg.draft.steps.length} bước
                      </p>

                      {msg.draft.calorieSources && msg.draft.calorieSources.length > 0 && (
                        <div className="space-y-1 border-t border-border pt-1.5">
                          <p className="flex items-center gap-1 text-[0.6875rem] font-semibold text-foreground">
                            <GlobeIcon aria-hidden className="size-3 text-primary" />
                            Nguồn tham khảo từ Web:
                          </p>
                          <ul className="space-y-1">
                            {msg.draft.calorieSources.map((src) => (
                              <li key={src.url} className="truncate">
                                <a
                                  href={src.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[0.6875rem] text-primary underline-offset-4 hover:underline"
                                >
                                  <ExternalLinkIcon aria-hidden className="size-3 shrink-0" />
                                  <span className="truncate">{src.title || src.url}</span>
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        <Button
                          type="button"
                          size="xs"
                          variant={msg.applied ? "outline" : "default"}
                          onClick={() => msg.draft && applyDraftToForm(msg.draft, msg.id)}
                        >
                          <CheckIcon aria-hidden />
                          {msg.applied ? "Đã điền vào form (Áp dụng lại)" : "Áp dụng vào biểu mẫu"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {reading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Spinner aria-hidden />
                  <span>AI đang đọc công thức &amp; tìm nguồn calo trên web…</span>
                </div>
              )}
              <div ref={scrollEnd} aria-hidden className="h-px shrink-0" />
            </div>

            <form
              onSubmit={sendChatMessage}
              className="shrink-0 border-t border-border bg-card p-3"
            >
              <InputGroup>
                <InputGroupTextarea
                  ref={textarea}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  maxLength={MAX_TEXT_LENGTH}
                  rows={2}
                  disabled={reading}
                  aria-label="Nhắn cho Trợ lý Admin"
                  placeholder="Dán công thức, nhờ sửa bước hoặc tính lại Kcal…"
                  className="max-h-24 min-h-10"
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) {
                      return
                    }
                    event.preventDefault()
                    sendChatMessage()
                  }}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    type="submit"
                    size="icon-sm"
                    variant="default"
                    aria-label="Gửi"
                    disabled={reading || !input.trim()}
                  >
                    {reading ? <Spinner aria-hidden /> : <ArrowUpIcon aria-hidden />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </form>
          </section>
        ) : (
          <Button
            type="button"
            variant="raised"
            shape="pill"
            size="pill"
            onClick={() => setOpen(true)}
            aria-label="Mở Trợ lý AI cho Admin"
          >
            {reading ? <Spinner aria-hidden /> : <LogoMark className="size-6 border border-primary-foreground/35" />}
            <span>{reading ? "AI đang xử lý…" : "Trợ lý AI"}</span>
          </Button>
        )}
      </div>
    </>
  )
}
