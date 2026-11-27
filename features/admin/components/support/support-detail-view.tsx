"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeftIcon, CheckIcon, ExternalLinkIcon, LockIcon, XIcon } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { HighlightedText } from "@/features/admin/components/content/highlighted-text"
import { ModerationPanel } from "@/features/admin/components/content/moderation-panel"
import { PostStatusBadge } from "@/features/admin/components/content/post-columns"
import { PostRemovalNotice, PostVideo } from "@/features/admin/components/content/post-sheet"
import { profilePath } from "@/features/profiles/profiles-cache"
import { ApiError } from "@/features/shared/lib/api-client"
import {
  TicketCategoryTag,
  TicketStatusBadge,
} from "@/features/support/components/ticket-status-badge"
import { useAuth } from "@/features/auth/hooks/use-auth"
import {
  TicketImagePicker,
  releasePickedImages,
  type PickedImage,
} from "@/features/support/components/ticket-image-picker"
import { TicketThread } from "@/features/support/components/ticket-thread"
import {
  useAdminSupportClaim,
  useAdminSupportTicket,
  useReplyAdminSupportTicket,
  useResolveAdminSupportTicket,
  useUploadSupportImages,
} from "@/features/support/hooks/use-support"
import {
  formatFormalTimestamp,
  supportErrorMessage,
} from "@/features/support/lib/format-formal-time"
import {
  APPEAL_REASON_LABELS,
  MAX_TICKET_MESSAGE_LENGTH,
  MAX_TICKET_RESOLUTION_NOTE_LENGTH,
  MIN_TICKET_REJECT_NOTE_LENGTH,
  SUPPORT_CATEGORY_LABELS,
  isTicketActiveStatus,
  type AdminSupportTicketDetail,
} from "@/features/support/schemas"
import { ADMIN_SUPPORT_PATH } from "@/features/support/support-cache"

const TRIGGER_LABELS = {
  REJECTED: "Bị từ chối kiểm duyệt",
  REMOVED: "Bị quản trị viên gỡ bỏ",
} as const

type ClaimAction = "claim" | "takeover" | "release"

const CLAIM_TOASTS: Record<ClaimAction, string> = {
  claim: "Đã nhận xử lý hồ sơ",
  takeover: "Đã tiếp quản hồ sơ",
  release: "Đã trả hồ sơ về hàng chờ",
}

function AssigneeCell({
  ticket,
  viewerId,
  active,
}: {
  ticket: AdminSupportTicketDetail
  viewerId: string | null
  active: boolean
}) {
  const applyClaim = useAdminSupportClaim()
  const [pending, setPending] = useState<ClaimAction | null>(null)

  const assignee = ticket.assignee
  const mine = assignee !== null && assignee.id === viewerId

  async function run(action: ClaimAction) {
    if (pending) return
    setPending(action)
    try {
      await applyClaim(ticket.id, action)
      toast.add({ title: CLAIM_TOASTS[action] })
    } catch (err) {
      toast.add({
        title: "Không thể cập nhật người phụ trách",
        description: supportErrorMessage(err, "Vui lòng thử lại."),
      })
    } finally {
      setPending(null)
    }
  }

  function actionFor(): ClaimAction | null {
    if (!active) return null
    if (assignee === null) return "claim"
    if (mine) return "release"
    return "takeover"
  }

  const action = actionFor()
  const actionLabels: Record<ClaimAction, string> = {
    claim: "Nhận xử lý",
    takeover: "Tiếp quản",
    release: "Trả về hàng chờ",
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-foreground">
        {assignee ? `${assignee.fullName} (@${assignee.username})` : "Chưa có người nhận"}
        {mine && <span className="text-muted-foreground"> · bạn</span>}
      </span>
      {ticket.assignedAt && (
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          từ {formatFormalTimestamp(ticket.assignedAt)}
        </span>
      )}
      {action && (
        <Button
          type="button"
          size="xs"
          variant={action === "claim" ? "default" : "outline"}
          disabled={pending !== null}
          onClick={() => void run(action)}
        >
          {pending === action && <Spinner aria-hidden />}
          {actionLabels[action]}
        </Button>
      )}
    </div>
  )
}

export function AdminSupportDetailView({ id }: { id: string }) {
  const { ticket, error, isLoading } = useAdminSupportTicket(id)
  const replyTicket = useReplyAdminSupportTicket()
  const resolveTicket = useResolveAdminSupportTicket()
  const uploadImages = useUploadSupportImages()
  const { user } = useAuth()

  const [replyBody, setReplyBody] = useState("")
  const [replyImages, setReplyImages] = useState<PickedImage[]>([])
  const [isInternal, setIsInternal] = useState(false)
  const [replying, setReplying] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)

  const [resolutionNote, setResolutionNote] = useState("")
  const [resolving, setResolving] = useState<"APPROVE" | "REJECT" | "RESOLVE" | "CLOSE" | null>(
    null
  )
  const [resolveError, setResolveError] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 sm:p-6" aria-hidden>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <Link
          href={ADMIN_SUPPORT_PATH}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon aria-hidden className="size-4" />
          Quay lại danh sách hỗ trợ
        </Link>
        <Alert variant="destructive">
          <AlertDescription>
            {error instanceof ApiError && error.status === 404
              ? "Không tìm thấy hồ sơ hỗ trợ này."
              : "Không tải được hồ sơ hỗ trợ. Vui lòng thử lại."}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const active = isTicketActiveStatus(ticket.status)
  const isAppeal = ticket.category === "CONTENT_APPEAL" && ticket.appeal !== null
  const viewerId = user?.id ?? null
  const claimedByOther = ticket.assignee !== null && ticket.assignee.id !== viewerId
  const internalOnly = !active || claimedByOther
  const sendInternal = isInternal || internalOnly
  const trimmedReply = replyBody.trim()
  const hasContent = trimmedReply.length >= 1 || replyImages.length > 0
  const canReply = hasContent && trimmedReply.length <= MAX_TICKET_MESSAGE_LENGTH
  const trimmedNote = resolutionNote.trim()
  const hasStrictNote = trimmedNote.length >= MIN_TICKET_REJECT_NOTE_LENGTH

  async function handleReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canReply || replying) return
    setReplyError(null)
    setReplying(true)
    try {
      const attachmentIds = await uploadImages(replyImages.map((image) => image.file))
      await replyTicket(id, {
        ...(trimmedReply ? { body: trimmedReply } : {}),
        ...(attachmentIds.length > 0 ? { attachmentIds } : {}),
        isInternal: sendInternal,
      })
      setReplyBody("")
      releasePickedImages(replyImages)
      setReplyImages([])
      setIsInternal(false)
      toast.add({
        title: sendInternal ? "Đã lưu ghi chú nội bộ" : "Đã gửi phản hồi tới người gửi",
      })
    } catch (err) {
      setReplyError(supportErrorMessage(err, "Không thể gửi phản hồi. Vui lòng thử lại."))
    } finally {
      setReplying(false)
    }
  }

  async function handleResolve(decision: "APPROVE" | "REJECT" | "RESOLVE" | "CLOSE") {
    if (resolving) return
    if ((decision === "REJECT" || decision === "CLOSE") && !hasStrictNote) {
      setResolveError(`Cần nhập lý do tối thiểu ${MIN_TICKET_REJECT_NOTE_LENGTH} ký tự.`)
      return
    }
    setResolveError(null)
    setResolving(decision)
    try {
      await resolveTicket(id, {
        decision,
        note: trimmedNote || undefined,
      })
      setResolutionNote("")
      const titles = {
        APPROVE: "Đã chấp thuận kháng cáo và khôi phục nội dung",
        REJECT: "Đã từ chối kháng cáo",
        RESOLVE: "Đã đánh dấu hồ sơ đã giải quyết",
        CLOSE: "Đã đóng hồ sơ hỗ trợ",
      } as const
      toast.add({ title: titles[decision] })
    } catch (err) {
      setResolveError(supportErrorMessage(err, "Không thể cập nhật quyết định. Vui lòng thử lại."))
    } finally {
      setResolving(null)
    }
  }

  const threadAndActions = (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="admin-thread-title">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 id="admin-thread-title" className="text-sm font-medium text-foreground">
            {isAppeal ? "2. Lịch sử trao đổi" : "1. Lịch sử trao đổi"}
          </h2>
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {ticket.messages.length} mục
          </span>
        </div>
        <TicketThread messages={ticket.messages} viewerRole="ADMIN" />
      </section>

      <section aria-labelledby="admin-reply-title">
        <h2
          id="admin-reply-title"
          className="border-b border-border pb-2 text-sm font-medium text-foreground"
        >
          {isAppeal ? "3. Phản hồi / Ghi chú nội bộ" : "2. Phản hồi / Ghi chú nội bộ"}
        </h2>

        <form onSubmit={(event) => void handleReply(event)} className="mt-3 flex flex-col gap-3">
          {internalOnly && (
            <p className="border-l-2 border-l-amber-500/80 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
              {active
                ? "Hồ sơ đang do quản trị viên khác phụ trách: bạn chỉ thêm được ghi chú nội bộ. Bấm Tiếp quản ở mục Người phụ trách để phản hồi người dùng."
                : "Hồ sơ đã đóng: chỉ lưu được ghi chú nội bộ."}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={sendInternal}
                disabled={internalOnly}
                onChange={(event) => setIsInternal(event.target.checked)}
                className="size-3.5 accent-amber-600"
              />
              <LockIcon aria-hidden className="size-3.5 text-amber-600 dark:text-amber-400" />
              <span>Ghi chú nội bộ (chỉ quản trị viên nhìn thấy, không đổi trạng thái)</span>
            </label>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {trimmedReply.length}/{MAX_TICKET_MESSAGE_LENGTH}
            </span>
          </div>

          <Textarea
            rows={4}
            value={replyBody}
            maxLength={MAX_TICKET_MESSAGE_LENGTH}
            onChange={(event) => setReplyBody(event.target.value)}
            placeholder={
              sendInternal
                ? "Nhập ghi chú nội bộ giữa các quản trị viên..."
                : "Nhập phản hồi gửi tới người dùng (trạng thái sẽ chuyển sang Chờ phản hồi)..."
            }
            aria-label={sendInternal ? "Ghi chú nội bộ" : "Phản hồi người dùng"}
            disabled={replying}
          />

          <TicketImagePicker images={replyImages} onChange={setReplyImages} disabled={replying} />

          {replyError && (
            <p role="alert" className="text-sm text-destructive">
              {replyError}
            </p>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button type="submit" size="sm" variant="outline" disabled={!canReply || replying}>
              {replying && <Spinner aria-hidden />}
              {sendInternal ? "Lưu ghi chú nội bộ" : "Gửi phản hồi"}
            </Button>
          </div>
        </form>
      </section>

      {active && (
        <section aria-labelledby="admin-decision-title">
          <h2
            id="admin-decision-title"
            className="border-b border-border pb-2 text-sm font-medium text-foreground"
          >
            {isAppeal ? "4. Quyết định kháng cáo" : "3. Kết thúc hồ sơ"}
          </h2>

          <div className="mt-3 flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="resolution-note" className="text-xs text-muted-foreground">
                {isAppeal
                  ? "Ghi chú kết luận gửi tới tác giả (bắt buộc tối thiểu 5 ký tự nếu từ chối)."
                  : "Ghi chú kết luận gửi tới người gửi (bắt buộc tối thiểu 5 ký tự nếu đóng hồ sơ không giải quyết)."}
              </label>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {trimmedNote.length}/{MAX_TICKET_RESOLUTION_NOTE_LENGTH}
              </span>
            </div>

            <Textarea
              id="resolution-note"
              rows={3}
              value={resolutionNote}
              maxLength={MAX_TICKET_RESOLUTION_NOTE_LENGTH}
              onChange={(event) => setResolutionNote(event.target.value)}
              placeholder={
                isAppeal
                  ? "Nhập kết luận xem xét kháng cáo..."
                  : "Nhập kết quả xử lý hoặc lý do đóng hồ sơ..."
              }
              disabled={resolving !== null}
            />

            {claimedByOther && (
              <p className="text-xs text-muted-foreground">
                Chỉ người phụ trách mới kết luận được hồ sơ. Tiếp quản để tiếp tục.
              </p>
            )}

            {resolveError && (
              <p role="alert" className="text-sm text-destructive">
                {resolveError}
              </p>
            )}

            {isAppeal ? (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={resolving !== null || claimedByOther || !hasStrictNote}
                  onClick={() => void handleResolve("REJECT")}
                >
                  {resolving === "REJECT" ? <Spinner aria-hidden /> : <XIcon aria-hidden />}
                  Từ chối kháng cáo
                </Button>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  disabled={resolving !== null || claimedByOther}
                  onClick={() => void handleResolve("APPROVE")}
                >
                  {resolving === "APPROVE" ? <Spinner aria-hidden /> : <CheckIcon aria-hidden />}
                  Chấp thuận &amp; Khôi phục nội dung
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={resolving !== null || claimedByOther || !hasStrictNote}
                  onClick={() => void handleResolve("CLOSE")}
                >
                  {resolving === "CLOSE" ? <Spinner aria-hidden /> : <XIcon aria-hidden />}
                  Đóng hồ sơ
                </Button>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  disabled={resolving !== null || claimedByOther}
                  onClick={() => void handleResolve("RESOLVE")}
                >
                  {resolving === "RESOLVE" ? <Spinner aria-hidden /> : <CheckIcon aria-hidden />}
                  Đánh dấu đã giải quyết
                </Button>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )

  return (
    <article className="min-w-0 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href={ADMIN_SUPPORT_PATH}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon aria-hidden className="size-4" />
            <span>Hỗ trợ &amp; Kháng cáo</span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="font-mono text-sm font-medium text-foreground">{ticket.code}</h1>
          <TicketStatusBadge status={ticket.status} appealOutcome={ticket.appeal?.outcome} />
          <TicketCategoryTag category={ticket.category} />
        </div>

        <Link
          href={profilePath(ticket.author.id)}
          target="_blank"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <span>
            {ticket.author.fullName} (@{ticket.author.username})
          </span>
          <ExternalLinkIcon aria-hidden className="size-3" />
        </Link>
      </header>

      <section aria-label="Thông tin tổng quan hồ sơ" className="border-b border-border px-4 py-4 sm:px-6">
        <table className="w-full border-collapse text-sm">
          <tbody className="divide-y divide-border">
            <tr>
              <th className="w-40 py-2 pr-4 text-left align-top text-xs font-medium text-muted-foreground sm:w-48">
                Tiêu đề
              </th>
              <td className="py-2 font-medium text-foreground">{ticket.subject}</td>
            </tr>
            <tr>
              <th className="py-2 pr-4 text-left align-top text-xs font-medium text-muted-foreground">
                Danh mục
              </th>
              <td className="py-2 text-foreground">
                {SUPPORT_CATEGORY_LABELS[ticket.category]}
                {ticket.appeal && (
                  <span className="text-muted-foreground">
                    {" "}
                    · {TRIGGER_LABELS[ticket.appeal.triggerStatus]} · Lý do:{" "}
                    {APPEAL_REASON_LABELS[ticket.appeal.reasonCategory]}
                  </span>
                )}
              </td>
            </tr>
            <tr>
              <th className="py-2 pr-4 text-left align-top text-xs font-medium text-muted-foreground">
                Người phụ trách
              </th>
              <td className="py-2">
                <AssigneeCell ticket={ticket} viewerId={viewerId} active={active} />
              </td>
            </tr>
            {ticket.referenceCode && (
              <tr>
                <th className="py-2 pr-4 text-left align-top text-xs font-medium text-muted-foreground">
                  Mã tham chiếu
                </th>
                <td className="py-2 font-mono text-xs text-foreground">{ticket.referenceCode}</td>
              </tr>
            )}
            <tr>
              <th className="py-2 pr-4 text-left align-top text-xs font-medium text-muted-foreground">
                Thời gian
              </th>
              <td className="py-2 font-mono text-xs text-muted-foreground tabular-nums">
                Gửi {formatFormalTimestamp(ticket.createdAt)} · Cập nhật{" "}
                {formatFormalTimestamp(ticket.lastMessageAt)}
                {ticket.resolvedAt ? ` · Đóng ${formatFormalTimestamp(ticket.resolvedAt)}` : ""}
                {ticket.autoCloseAt
                  ? ` · Tự đóng ${formatFormalTimestamp(ticket.autoCloseAt)}`
                  : ""}
              </td>
            </tr>
            {ticket.resolvedBy && (
              <tr>
                <th className="py-2 pr-4 text-left align-top text-xs font-medium text-muted-foreground">
                  Người kết luận
                </th>
                <td className="py-2 text-foreground">
                  {ticket.resolvedBy.fullName} (@{ticket.resolvedBy.username})
                  {ticket.resolutionNote ? ` — ${ticket.resolutionNote}` : ""}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {isAppeal ? (
        <div className="grid grid-cols-1 gap-6 px-4 pt-5 sm:px-6 lg:grid-cols-12">
          <section
            aria-labelledby="admin-evidence-title"
            className="flex flex-col gap-4 lg:col-span-6 lg:border-r lg:border-border lg:pr-6"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
              <h2 id="admin-evidence-title" className="text-sm font-medium text-foreground">
                1. Nội dung &amp; Bằng chứng kiểm duyệt
              </h2>
              {ticket.post && <PostStatusBadge status={ticket.post.status} />}
            </div>

            {ticket.post ? (
              <div className="flex flex-col gap-4">
                {ticket.post.blog && (
                  <div className="flex flex-col gap-2">
                    <h3 className="text-base font-medium text-foreground">
                      {ticket.post.blog.title}
                    </h3>
                    {ticket.post.blog.coverImageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element -- arbitrary cover URL admin must inspect
                      <img
                        src={ticket.post.blog.coverImageUrl}
                        alt=""
                        className="max-h-56 w-full rounded-md object-cover"
                      />
                    )}
                    <p className="text-sm leading-6 break-words whitespace-pre-line text-foreground">
                      {ticket.post.blog.excerpt}
                    </p>
                  </div>
                )}

                {ticket.post.body && (
                  <HighlightedText
                    text={ticket.post.body}
                    items={ticket.post.moderation?.evidence?.items ?? []}
                    className="text-sm leading-6 break-words whitespace-pre-line text-foreground"
                  />
                )}

                {ticket.post.media.map((item, index) => (
                  <PostVideo
                    key={item.id}
                    media={item}
                    label={
                      ticket.post!.media.length === 1
                        ? "Video"
                        : `Video ${index + 1}/${ticket.post!.media.length}`
                    }
                  />
                ))}

                {ticket.post.removal && <PostRemovalNotice post={ticket.post} />}
                <ModerationPanel post={ticket.post} />
              </div>
            ) : ticket.appeal ? (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Không tải được bản ghi nội dung trực tiếp. Hiển thị bản chụp tại thời điểm kháng cáo:</p>
                {ticket.appeal.postSnapshot.title && (
                  <p className="font-medium text-foreground">{ticket.appeal.postSnapshot.title}</p>
                )}
                {ticket.appeal.postSnapshot.excerpt && (
                  <p className="whitespace-pre-wrap text-foreground">
                    {ticket.appeal.postSnapshot.excerpt}
                  </p>
                )}
                {ticket.appeal.postSnapshot.reason && (
                  <p>Lý do xử lý gốc: {ticket.appeal.postSnapshot.reason}</p>
                )}
              </div>
            ) : null}
          </section>

          <div className="lg:col-span-6">{threadAndActions}</div>
        </div>
      ) : (
        <div className="mx-auto max-w-4xl px-4 pt-5 sm:px-6">{threadAndActions}</div>
      )}
    </article>
  )
}
