"use client"

import { useState } from "react"
import { SparklesIcon, VideoIcon } from "lucide-react"

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
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/features/auth/hooks/use-auth"
import {
  RecipeVideoPicker,
  type PickedVideo,
} from "@/features/recipes/components/recipe-video-picker"
import { requestRecipeDraft, type RecipeDraftSource } from "@/features/recipes/lib/recipes-api"
import type { DraftRecipe } from "@/features/recipes/schemas"
import { ApiError } from "@/features/shared/lib/api-client"

const MAX_TEXT_LENGTH = 20000

/**
 * Lets AI read the linked post (its caption and video transcripts), a video the
 * admin picks, or a pasted caption, and hands the recipe it found to `onFill`.
 * Picking a video links its post through `onLinkPost`. Asks first when the
 * form already has content, since filling replaces it.
 */
export function RecipeAiFill({
  postId,
  hasContent,
  onFill,
  onLinkPost,
}: {
  postId: string | null
  hasContent: boolean
  onFill: (recipe: DraftRecipe) => void
  onLinkPost: (postId: string) => void
}) {
  const { accessToken } = useAuth()
  const [text, setText] = useState("")
  const [reading, setReading] = useState(false)
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null)
  /** A draft waiting for the admin to confirm it may replace the form, with its note. */
  const [pending, setPending] = useState<{ recipe: DraftRecipe; note: string } | null>(null)
  const [picking, setPicking] = useState(false)

  function readVideo(video: PickedVideo) {
    onLinkPost(video.postId)
    void read({ postId: video.postId, mediaId: video.mediaId })
  }

  function apply(recipe: DraftRecipe, note: string) {
    onFill(recipe)
    const unmatched = recipe.ingredients.filter((item) => !item.match).length
    const done =
      unmatched === 0
        ? "Đã điền xong. Xem lại trước khi lưu nhé."
        : `Đã điền xong. Còn ${unmatched} nguyên liệu chưa có trong danh mục, bấm “Tạo nguyên liệu” ở từng dòng.`
    setMessage({ text: `${done}${note}`, failed: false })
  }

  async function read(source: RecipeDraftSource) {
    if (!accessToken) return
    setReading(true)
    setMessage(null)
    try {
      const draft = await requestRecipeDraft(accessToken, source)
      const waiting =
        draft.untranscribedVideos > 0
          ? " Một số video chưa có phụ đề nên AI chưa nghe được, thử lại sau ít phút."
          : ""
      if (!draft.recipe) {
        setMessage({
          text: `AI không tìm thấy công thức nào trong nội dung này.${waiting}`,
          failed: true,
        })
        return
      }
      if (hasContent) {
        setPending({ recipe: draft.recipe, note: waiting })
      } else {
        apply(draft.recipe, waiting)
      }
    } catch (error) {
      setMessage({ text: failureMessage(error), failed: true })
    } finally {
      setReading(false)
    }
  }

  const trimmed = text.trim()

  return (
    <section
      aria-label="Điền bằng AI"
      className="flex flex-col gap-3 rounded-2xl border bg-muted/40 p-4"
    >
      {postId ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            AI đọc caption và lời nói trong video của bài đăng gốc để điền công thức.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="action"
              disabled={reading}
              onClick={() => setPicking(true)}
            >
              <VideoIcon aria-hidden />
              Chọn video khác
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={reading}
              onClick={() => void read({ postId })}
            >
              {reading ? <Spinner aria-hidden /> : <SparklesIcon aria-hidden />}
              {reading ? "AI đang đọc…" : "Điền bằng AI"}
            </Button>
          </div>
        </div>
      ) : (
        <Field>
          <FieldLabel htmlFor="recipe-ai-text">Điền bằng AI từ caption</FieldLabel>
          <Textarea
            id="recipe-ai-text"
            rows={3}
            value={text}
            maxLength={MAX_TEXT_LENGTH}
            onChange={(event) => setText(event.target.value)}
            placeholder="Dán caption hoặc công thức, ví dụ: Đậu hũ sốt cà chua cho 2 người: 300g đậu hũ non, 2 quả cà chua…"
          />
          <FieldDescription>
            AI điền tên món, nguyên liệu, lượng và các bước. Không có gì được lưu cho đến khi bạn
            bấm lưu.
          </FieldDescription>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={reading || !trimmed}
              onClick={() => void read({ text: trimmed })}
            >
              {reading ? <Spinner aria-hidden /> : <SparklesIcon aria-hidden />}
              {reading ? "AI đang đọc…" : "Điền bằng AI"}
            </Button>
            <Button
              size="sm"
              variant="action"
              disabled={reading}
              onClick={() => setPicking(true)}
            >
              <VideoIcon aria-hidden />
              Hoặc chọn video có sẵn
            </Button>
          </div>
        </Field>
      )}

      {message && (
        <p
          role={message.failed ? "alert" : "status"}
          className={message.failed ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
        >
          {message.text}
        </p>
      )}

      <RecipeVideoPicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={readVideo}
      />

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Thay nội dung đang có?</AlertDialogTitle>
            <AlertDialogDescription>
              AI sẽ thay tên món, mô tả, nguyên liệu và các bước bằng những gì đọc được. Ảnh món
              được giữ nguyên.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Giữ nội dung cũ</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending) apply(pending.recipe, pending.note)
                setPending(null)
              }}
            >
              Thay bằng bản AI
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
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
  return "AI chưa điền được. Thử lại nhé."
}
