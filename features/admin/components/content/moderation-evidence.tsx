"use client"

import { Badge } from "@/components/ui/badge"
import { useCategoryLabel } from "@/features/admin/hooks/use-category-label"
import type { AdminPostDetail, EvidenceItem, ModerationEvidence as Evidence } from "@/features/admin/schemas"

const FIELD_LABELS: Record<EvidenceItem["field"], string> = {
  body: "Nội dung bài",
  title: "Tiêu đề blog",
  content: "Nội dung blog",
  transcript: "Lời thoại video",
  frame: "Khung hình video",
  image: "Ảnh trong blog",
}

function formatSeconds(seconds: number) {
  const whole = Math.floor(seconds)
  const minutes = Math.floor(whole / 60)
  const rest = String(whole % 60).padStart(2, "0")
  return `${minutes}:${rest}`
}

function EvidencePicture({ item }: { item: EvidenceItem }) {
  if (!item.imageUrl) return null
  return (
    <div className="w-40 shrink-0 self-start overflow-hidden rounded-lg bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element -- a Cloudinary frame or a storage image, shown as the model saw it */}
      <img src={item.imageUrl} alt={FIELD_LABELS[item.field]} className="block w-full" />
    </div>
  )
}

function EvidenceEntry({ item }: { item: EvidenceItem }) {
  const labelOf = useCategoryLabel()
  const picture = item.field === "frame" || item.field === "image"
  let place = FIELD_LABELS[item.field]
  if (item.seconds !== null) place = `${place} · ${formatSeconds(item.seconds)}`

  return (
    <li className="flex gap-3 rounded-xl border p-3">
      <EvidencePicture item={item} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.8125rem] text-muted-foreground">{place}</span>
          <Badge variant="outline">{labelOf(item.category)}</Badge>
        </div>
        {item.quote && (
          <blockquote className="border-l-2 border-destructive/60 pl-3 break-words">
            {picture ? <span className="text-muted-foreground">Chữ trong ảnh: </span> : null}
            “{item.quote}”
          </blockquote>
        )}
        <p className="text-muted-foreground">{item.reason}</p>
      </div>
    </li>
  )
}

function missingEvidenceMessage(evidence: Evidence | null) {
  if (!evidence) return "Chưa có phân tích chi tiết cho bài này. Hãy tự xem kỹ bài rồi quyết định."
  if (evidence.status === "FAILED") return "Không phân tích được bài này. Hãy tự xem kỹ bài rồi quyết định."
  if (evidence.status === "REFUSED") {
    return "Model từ chối đọc nội dung (thường do vi phạm nặng). Hãy tự xem kỹ bài rồi quyết định."
  }
  return null
}

export function ModerationEvidence({ post }: { post: AdminPostDetail }) {
  const evidence = post.moderation?.evidence ?? null
  const flagged = post.status === "PENDING_REVIEW" || post.status === "REJECTED"
  if (!flagged && !evidence) return null

  const message = missingEvidenceMessage(evidence)

  return (
    <div className="flex flex-col gap-3">
      <h4 className="font-medium">Phần bị cho là vi phạm</h4>

      {message && <p className="text-muted-foreground">{message}</p>}

      {evidence?.summary && <p>{evidence.summary}</p>}

      {evidence?.status === "READY" && evidence.items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {evidence.items.map((item, index) => (
            <EvidenceEntry key={`${item.field}-${item.start ?? item.imageUrl ?? index}`} item={item} />
          ))}
        </ul>
      )}

      {evidence?.status === "READY" && evidence.dropped > 0 && (
        <p className="text-xs text-muted-foreground">
          Đã bỏ {evidence.dropped} trích dẫn không khớp với nội dung bài.
        </p>
      )}
    </div>
  )
}
