"use client"

import { useState } from "react"
import { CheckIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { useModerateAdminPost } from "@/features/admin/hooks/use-admin-posts"
import { useCategoryLabel } from "@/features/admin/hooks/use-category-label"
import type { AdminPostDetail } from "@/features/admin/schemas"
import { formatPostDateLong } from "@/features/shared/lib/format"

export const CATEGORY_LABELS: Record<string, string> = {
  allow: "Không vi phạm",
  sexual: "Nội dung nhạy cảm",
  violence: "Bạo lực",
  hate: "Thù ghét",
  harassment: "Quấy rối",
  self_harm: "Tự hại",
  illegal: "Bất hợp pháp",
  spam: "Spam",
}

function percent(score: number) {
  return `${Math.round(score * 100)}%`
}

/**
 * What the automated check decided and why, with the admin's call on a post
 * that is held for review or was rejected.
 */
export function ModerationPanel({ post }: { post: AdminPostDetail }) {
  const moderate = useModerateAdminPost()
  const labelOf = useCategoryLabel()
  const [note, setNote] = useState("")
  const [pending, setPending] = useState<"APPROVE" | "REJECT" | null>(null)
  const [failed, setFailed] = useState(false)
  const { moderation } = post
  if (!moderation) {
    return (
      <p className="text-muted-foreground">
        Bài này chưa được chấm điểm vi phạm tự động (đăng trước khi có kiểm duyệt).
      </p>
    )
  }

  const decidable = post.status === "PENDING_REVIEW" || post.status === "REJECTED"
  const scores = Object.entries(moderation.scores ?? {})
    .sort(([, left], [, right]) => right - left)

  async function decide(decision: "APPROVE" | "REJECT") {
    setFailed(false)
    setPending(decision)
    try {
      await moderate(post.id, decision, note.trim())
      setNote("")
    } catch {
      setFailed(true)
    } finally {
      setPending(null)
    }
  }

  return (
    <section aria-label="Kiểm duyệt tự động" className="flex flex-col gap-3 border-b pb-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-medium">Kiểm duyệt tự động</h3>
        {moderation.violationScore !== null && (
          <p className="text-muted-foreground">
            Khả năng vi phạm{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {percent(moderation.violationScore)}
            </span>
          </p>
        )}
      </div>

      {scores.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {scores.map(([category, score]) => (
            <li key={category} className="flex items-center gap-3">
              <span className="w-36 shrink-0">{labelOf(category)}</span>
              <div
                role="meter"
                aria-label={labelOf(category)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(score * 100)}
                className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
              >
                <div className="h-full rounded-full bg-primary" style={{ width: percent(score) }} />
              </div>
              <span className="w-10 text-right tabular-nums">{percent(score)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">
          {moderation.verdict === "allow"
            ? "Không phát hiện vi phạm."
            : `Nhóm nghi ngờ: ${labelOf(moderation.verdict)}.`}
        </p>
      )}

      {moderation.reviewedAt && (
        <p className="text-muted-foreground">
          Đã được quản trị viên xem xét lúc {formatPostDateLong(moderation.reviewedAt)}
          {moderation.reviewNote ? ` — ${moderation.reviewNote}` : "."}
        </p>
      )}

      {decidable && (
        <div className="flex flex-col gap-2">
          <Textarea
            value={note}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ghi chú cho quyết định (không bắt buộc)"
            aria-label="Ghi chú quyết định"
          />
          {failed && (
            <p role="alert" className="text-sm text-destructive">
              Không lưu được quyết định. Thử lại nhé.
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="destructive"
              disabled={pending !== null || post.status === "REJECTED"}
              onClick={() => void decide("REJECT")}
            >
              {pending === "REJECT" ? <Spinner aria-hidden /> : <XIcon aria-hidden />}
              Từ chối
            </Button>
            <Button disabled={pending !== null} onClick={() => void decide("APPROVE")}>
              {pending === "APPROVE" ? <Spinner aria-hidden /> : <CheckIcon aria-hidden />}
              Cho phép đăng
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
