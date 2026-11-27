"use client"

import { useState } from "react"
import { CheckIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { useModerateAdminPost } from "@/features/admin/hooks/use-admin-posts"
import { useCategoryLabel } from "@/features/admin/hooks/use-category-label"
import { ModerationEvidence } from "@/features/admin/components/content/moderation-evidence"
import { RiskLevelBadge } from "@/features/admin/components/moderation/risk-level-badge"
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
  provider_blocked: "Model từ chối đọc nội dung",
  moderation_failed: "Kiểm duyệt tự động lỗi, cần duyệt tay",
  manipulation: "Chèo lái AI",
}

const SYSTEM_VERDICTS = new Set(["provider_blocked", "moderation_failed"])

function verdictText(verdict: string, labelOf: (key: string) => string) {
  if (verdict === "allow") return "Không phát hiện vi phạm."
  if (SYSTEM_VERDICTS.has(verdict)) return `${labelOf(verdict)}.`
  return `Nhóm vi phạm: ${labelOf(verdict)}.`
}

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
        Bài này chưa được kiểm duyệt tự động (đăng trước khi có kiểm duyệt).
      </p>
    )
  }

  const decidable = post.status === "PENDING_REVIEW" || post.status === "REJECTED"

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
        <p className="flex items-center gap-2 text-muted-foreground">
          Mức rủi ro
          <RiskLevelBadge level={moderation.riskLevel} />
        </p>
      </div>

      <p className="text-muted-foreground">
        {verdictText(moderation.verdict, labelOf)}
      </p>

      <ModerationEvidence post={post} />

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
