"use client"

import { useState } from "react"
import { RefreshCwIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useExplainAdminPost } from "@/features/admin/hooks/use-admin-posts"
import { useCategoryLabel } from "@/features/admin/hooks/use-category-label"
import type { AdminPostDetail, EvidenceItem, ModerationRoute } from "@/features/admin/schemas"

const DECISION_LABELS = {
  accept: "Cho đăng",
  reject: "Từ chối",
  escalate: "Chuyển admin",
} as const

const OUTCOME_LABELS: Record<ModerationRoute["outcome"], string> = {
  PUBLISH: "Đăng",
  REJECT: "Từ chối",
  ADMIN: "Chờ admin duyệt",
}

const RULE_LABELS: Record<ModerationRoute["rule"], string> = {
  PROVIDER_BLOCKED: "nhà cung cấp model từ chối đọc nội dung",
  MANIPULATION: "nội dung tìm cách chèo lái AI",
  REVIEWER_UNAVAILABLE: "người kiểm duyệt AI không trả lời được",
  REVIEWER_REJECT: "người kiểm duyệt AI từ chối, có bằng chứng",
  UNVERIFIED_REJECT: "người kiểm duyệt AI từ chối nhưng không có bằng chứng khớp bài",
  REVIEWER_ESCALATE: "người kiểm duyệt AI chuyển admin",
  REVIEWER_ACCEPT: "người kiểm duyệt AI cho đăng",
}

/** Where the router sent the post, and whether that was applied or only recorded. */
function RouteLine({ route }: { route: ModerationRoute }) {
  const applied = route.appliedBy !== null
  return (
    <p className={applied ? undefined : "text-muted-foreground"}>
      {applied ? "Kết quả: " : "Nếu áp dụng sẽ là: "}
      <span className="font-medium text-foreground">{OUTCOME_LABELS[route.outcome]}</span>
      {` — ${RULE_LABELS[route.rule]}.`}
      {!applied && " Chế độ chạy thử: chưa áp dụng, chỉ ghi lại."}
    </p>
  )
}

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

/** A frame or image with the region the model pointed at, if it gave one. */
function EvidencePicture({ item }: { item: EvidenceItem }) {
  if (!item.imageUrl) return null
  const box = item.box
  return (
    <div className="relative w-40 shrink-0 self-start overflow-hidden rounded-lg bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element -- a Cloudinary frame or a storage image, shown as the model saw it */}
      <img src={item.imageUrl} alt={FIELD_LABELS[item.field]} className="block w-full" />
      {box && (
        <div
          aria-hidden
          className="absolute rounded-sm border-2 border-destructive"
          style={{
            left: `${box[0] / 10}%`,
            top: `${box[1] / 10}%`,
            width: `${(box[2] - box[0]) / 10}%`,
            height: `${(box[3] - box[1]) / 10}%`,
          }}
        />
      )}
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
        {picture && item.box && (
          <p className="text-xs text-muted-foreground">Khung đỏ là vùng gần đúng, chỉ để tham khảo.</p>
        )}
      </div>
    </li>
  )
}

/**
 * What the explainer model says breaks the policy, for an admin deciding a
 * flagged post. It never changes the verdict.
 */
export function ModerationEvidence({ post }: { post: AdminPostDetail }) {
  const explain = useExplainAdminPost()
  const [running, setRunning] = useState(false)
  const [failed, setFailed] = useState(false)
  const evidence = post.moderation?.evidence ?? null
  const route = post.moderation?.route ?? null
  const held = post.status === "PROCESSING" && Boolean(post.moderation?.heldAt)
  const flagged = held || post.status === "PENDING_REVIEW" || post.status === "REJECTED"
  if (!flagged && !evidence) return null

  async function rerun() {
    setFailed(false)
    setRunning(true)
    try {
      await explain(post.id)
    } catch {
      setFailed(true)
    } finally {
      setRunning(false)
    }
  }

  let message: string | null = null
  if (held && !evidence) {
    message = "Đang chờ người kiểm duyệt AI. Bài chưa hiển thị cho đến khi có kết quả."
  } else if (!evidence) {
    message = "Chưa có phân tích chi tiết. Thường có sau vài giây khi bài bị giữ lại; mở lại bài hoặc bấm Phân tích."
  }
  else if (evidence.status === "FAILED") message = "Không phân tích được bài này. Thử chạy lại nhé."
  else if (evidence.status === "REFUSED") {
    message = "Model phân tích từ chối đọc nội dung (thường do vi phạm nặng). Hãy tự xem kỹ bài."
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="font-medium">Phần bị cho là vi phạm</h4>
        {flagged && (
          <Button size="sm" variant="ghost" disabled={running} onClick={() => void rerun()}>
            {running ? <Spinner aria-hidden /> : <RefreshCwIcon aria-hidden />}
            {evidence ? "Phân tích lại" : "Phân tích"}
          </Button>
        )}
      </div>

      {message && <p className="text-muted-foreground">{message}</p>}

      {route && <RouteLine route={route} />}

      {evidence?.status === "READY" && (
        <>
          {evidence.summary && <p>{evidence.summary}</p>}
          {evidence.decision && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">Người kiểm duyệt AI:</span>
              <Badge variant={evidence.decision === "reject" ? "destructive" : "secondary"}>
                {DECISION_LABELS[evidence.decision]}
              </Badge>
              {evidence.decision === "accept" && (
                <span className="text-muted-foreground">cho rằng bộ lọc đầu chấm nhầm.</span>
              )}
            </div>
          )}
          {evidence.items.length > 0 && (
            <ul className="flex flex-col gap-2">
              {evidence.items.map((item, index) => (
                <EvidenceEntry key={`${item.field}-${item.start ?? item.imageUrl ?? index}`} item={item} />
              ))}
            </ul>
          )}
          {evidence.dropped > 0 && (
            <p className="text-xs text-muted-foreground">
              Đã bỏ {evidence.dropped} trích dẫn không khớp với nội dung bài.
            </p>
          )}
        </>
      )}

      {failed && (
        <p role="alert" className="text-sm text-destructive">
          Không chạy được phân tích. Thử lại sau nhé.
        </p>
      )}
    </div>
  )
}
