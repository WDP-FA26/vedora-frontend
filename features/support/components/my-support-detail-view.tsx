"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeftIcon, ExternalLinkIcon, LockIcon } from "lucide-react"

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
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { editBlogPath } from "@/features/blogs/blogs-cache"
import { postPath } from "@/features/posts/posts-cache"
import {
  TicketCategoryTag,
  TicketStatusBadge,
} from "@/features/support/components/ticket-status-badge"
import {
  TicketImagePicker,
  releasePickedImages,
  type PickedImage,
} from "@/features/support/components/ticket-image-picker"
import { TicketThread } from "@/features/support/components/ticket-thread"
import {
  useMySupportTicket,
  useReplyMySupportTicket,
  useUploadSupportImages,
  useWithdrawMySupportTicket,
} from "@/features/support/hooks/use-support"
import {
  formatFormalTimestamp,
  supportErrorMessage,
} from "@/features/support/lib/format-formal-time"
import {
  APPEAL_REASON_LABELS,
  MAX_TICKET_MESSAGE_LENGTH,
  SUPPORT_CATEGORY_LABELS,
  isTicketActiveStatus,
  type SupportAppealData,
  type SupportTicketDetail,
} from "@/features/support/schemas"
import { SUPPORT_PATH } from "@/features/support/support-cache"

const TRIGGER_LABELS = {
  REJECTED: "Bị từ chối kiểm duyệt",
  REMOVED: "Bị quản trị viên gỡ bỏ",
} as const

const MAX_MESSAGES_PER_TICKET = 50
const MAX_CONSECUTIVE_USER_MESSAGES = 3

function contentHrefFor(appeal: SupportAppealData): string {
  if (appeal.postType === "BLOG") return editBlogPath(appeal.postId)
  return postPath(appeal.postId)
}

function replyBlockReason(ticket: SupportTicketDetail, reopening: boolean): string | null {
  const needed = reopening ? 2 : 1
  if (ticket.messageCount + needed > MAX_MESSAGES_PER_TICKET) {
    return "Hồ sơ đã đạt giới hạn số lượt trao đổi."
  }
  if (reopening) return null
  const recent = ticket.messages.slice(-MAX_CONSECUTIVE_USER_MESSAGES)
  const waitingForAdmin =
    recent.length >= MAX_CONSECUTIVE_USER_MESSAGES &&
    recent.every((message) => message.senderRole === "USER")
  if (waitingForAdmin) {
    return "Bạn đã gửi 3 tin liên tiếp. Vui lòng chờ quản trị viên phản hồi trước khi gửi thêm."
  }
  return null
}

export function MySupportDetailView({ id }: { id: string }) {
  const { ticket, error, isLoading } = useMySupportTicket(id)
  const replyTicket = useReplyMySupportTicket()
  const withdrawTicket = useWithdrawMySupportTicket()

  const uploadImages = useUploadSupportImages()
  const [replyBody, setReplyBody] = useState("")
  const [replyImages, setReplyImages] = useState<PickedImage[]>([])
  const [replying, setReplying] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)
  const [confirmWithdraw, setConfirmWithdraw] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 sm:p-5" aria-hidden>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-44 w-full" />
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <section className="p-4 sm:p-5">
        <Link
          href={SUPPORT_PATH}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon aria-hidden className="size-4" />
          Quay lại Trung tâm hỗ trợ
        </Link>
        <p role="alert" className="mt-4 text-sm text-destructive">
          Không tìm thấy hồ sơ hỗ trợ này hoặc bạn không có quyền truy cập.
        </p>
      </section>
    )
  }

  const active = isTicketActiveStatus(ticket.status)
  const isAppeal = ticket.category === "CONTENT_APPEAL" && ticket.appeal !== null
  const reopenableUntil = active ? null : ticket.reopenableUntil
  const canCompose = active || reopenableUntil !== null
  const trimmedReply = replyBody.trim()
  const blockReason = replyBlockReason(ticket, !active)
  const hasContent = trimmedReply.length >= 1 || replyImages.length > 0
  const canSubmitReply =
    blockReason === null && hasContent && trimmedReply.length <= MAX_TICKET_MESSAGE_LENGTH

  const contentHref = ticket.appeal ? contentHrefFor(ticket.appeal) : null

  async function handleReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmitReply || replying) return
    setReplyError(null)
    setReplying(true)
    try {
      const attachmentIds = await uploadImages(replyImages.map((image) => image.file))
      await replyTicket(id, {
        ...(trimmedReply ? { body: trimmedReply } : {}),
        ...(attachmentIds.length > 0 ? { attachmentIds } : {}),
      })
      setReplyBody("")
      releasePickedImages(replyImages)
      setReplyImages([])
      toast.add({ title: active ? "Đã gửi phản hồi" : "Đã mở lại hồ sơ" })
    } catch (err) {
      setReplyError(supportErrorMessage(err, "Không thể gửi phản hồi. Vui lòng thử lại."))
    } finally {
      setReplying(false)
    }
  }

  async function handleWithdraw() {
    setConfirmWithdraw(false)
    setReplyError(null)
    setWithdrawing(true)
    try {
      await withdrawTicket(id)
      toast.add({ title: "Đã rút hồ sơ" })
    } catch (err) {
      setReplyError(supportErrorMessage(err, "Không thể rút hồ sơ. Vui lòng thử lại."))
    } finally {
      setWithdrawing(false)
    }
  }

  return (
    <article className="min-w-0 pb-24">
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md sm:px-5">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <Link
            href={SUPPORT_PATH}
            aria-label="Quay lại Trung tâm hỗ trợ"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon aria-hidden className="size-4" />
            <span>Hỗ trợ</span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="font-mono text-sm font-medium text-foreground">{ticket.code}</h1>
          <TicketStatusBadge
            status={ticket.status}
            appealOutcome={ticket.appeal?.outcome}
            viewer="USER"
          />
          <TicketCategoryTag category={ticket.category} />
        </div>

        {active && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={withdrawing}
            onClick={() => setConfirmWithdraw(true)}
          >
            {withdrawing && <Spinner aria-hidden />}
            Rút hồ sơ
          </Button>
        )}
      </header>

      <div className="flex flex-col gap-6 px-4 pt-5 sm:px-5">
        {ticket.status === "WAITING_USER" && (
          <div
            role="status"
            className="border-l-2 border-l-sky-500/80 bg-sky-500/5 px-3.5 py-2.5 text-sm text-foreground"
          >
            <p className="font-medium text-sky-700 dark:text-sky-400">
              Quản trị viên đã phản hồi và đang chờ thông tin từ bạn.
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {ticket.autoCloseAt
                ? `Nếu chưa có trả lời, hệ thống sẽ nhắc bạn trước rồi tự động đóng hồ sơ vào khoảng ${formatFormalTimestamp(ticket.autoCloseAt)}.`
                : "Nếu chưa có trả lời, hệ thống sẽ nhắc bạn trước rồi mới tự động đóng hồ sơ."}
            </p>
          </div>
        )}

        {isAppeal && active && (
          <div
            role="status"
            className="flex items-start gap-2 border-l-2 border-l-amber-500/80 bg-amber-500/5 px-3.5 py-2.5 text-xs text-muted-foreground"
          >
            <LockIcon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              Trong khi kháng cáo đang xử lý, nội dung liên quan tạm khóa chỉnh sửa và xoá để giữ
              nguyên hiện trạng đối chiếu.
            </span>
          </div>
        )}

        <section aria-labelledby="section-meta-title">
          <h2
            id="section-meta-title"
            className="border-b border-border pb-2 text-sm font-medium text-foreground"
          >
            1. Thông tin hồ sơ
          </h2>
          <table className="w-full border-collapse text-sm">
            <tbody className="divide-y divide-border">
              <tr>
                <th className="w-40 py-2.5 pr-4 text-left align-top text-xs font-medium text-muted-foreground sm:w-48">
                  Mã hồ sơ
                </th>
                <td className="py-2.5 font-mono text-xs text-foreground">{ticket.code}</td>
              </tr>
              <tr>
                <th className="py-2.5 pr-4 text-left align-top text-xs font-medium text-muted-foreground">
                  Danh mục
                </th>
                <td className="py-2.5 text-foreground">
                  {SUPPORT_CATEGORY_LABELS[ticket.category]}
                </td>
              </tr>
              <tr>
                <th className="py-2.5 pr-4 text-left align-top text-xs font-medium text-muted-foreground">
                  Tiêu đề
                </th>
                <td className="py-2.5 font-medium text-foreground">{ticket.subject}</td>
              </tr>
              <tr>
                <th className="py-2.5 pr-4 text-left align-top text-xs font-medium text-muted-foreground">
                  Trạng thái
                </th>
                <td className="py-2.5">
                  <TicketStatusBadge
                    status={ticket.status}
                    appealOutcome={ticket.appeal?.outcome}
                    viewer="USER"
                  />
                </td>
              </tr>
              {ticket.referenceCode && (
                <tr>
                  <th className="py-2.5 pr-4 text-left align-top text-xs font-medium text-muted-foreground">
                    Mã tham chiếu
                  </th>
                  <td className="py-2.5 font-mono text-xs text-foreground">
                    {ticket.referenceCode}
                  </td>
                </tr>
              )}
              <tr>
                <th className="py-2.5 pr-4 text-left align-top text-xs font-medium text-muted-foreground">
                  Thời điểm gửi
                </th>
                <td className="py-2.5 font-mono text-xs text-foreground tabular-nums">
                  {formatFormalTimestamp(ticket.createdAt)}
                </td>
              </tr>
              <tr>
                <th className="py-2.5 pr-4 text-left align-top text-xs font-medium text-muted-foreground">
                  Cập nhật gần nhất
                </th>
                <td className="py-2.5 font-mono text-xs text-foreground tabular-nums">
                  {formatFormalTimestamp(ticket.lastMessageAt)}
                </td>
              </tr>

              {ticket.appeal && (
                <>
                  <tr>
                    <th className="py-2.5 pr-4 text-left align-top text-xs font-medium text-muted-foreground">
                      Nội dung liên quan
                    </th>
                    <td className="py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>
                          {ticket.appeal.postType === "BLOG" ? "Blog" : "Bài viết"}
                          {ticket.appeal.postSnapshot.title
                            ? `: ${ticket.appeal.postSnapshot.title}`
                            : ""}
                        </span>
                        {contentHref && (
                          <Link
                            href={contentHref}
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
                          >
                            <span>Mở nội dung</span>
                            <ExternalLinkIcon aria-hidden className="size-3" />
                          </Link>
                        )}
                      </div>
                      {ticket.appeal.postSnapshot.excerpt && (
                        <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
                          “{ticket.appeal.postSnapshot.excerpt}”
                        </p>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <th className="py-2.5 pr-4 text-left align-top text-xs font-medium text-muted-foreground">
                      Quyết định gốc
                    </th>
                    <td className="py-2.5 text-foreground">
                      <span>{TRIGGER_LABELS[ticket.appeal.triggerStatus]}</span>
                      {ticket.appeal.postSnapshot.reason && (
                        <span className="text-muted-foreground">
                          {" "}
                          — {ticket.appeal.postSnapshot.reason}
                        </span>
                      )}
                      <span className="ml-2 font-mono text-xs text-muted-foreground tabular-nums">
                        ({formatFormalTimestamp(ticket.appeal.postSnapshot.blockedAt)})
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <th className="py-2.5 pr-4 text-left align-top text-xs font-medium text-muted-foreground">
                      Lý do kháng cáo
                    </th>
                    <td className="py-2.5 text-foreground">
                      {APPEAL_REASON_LABELS[ticket.appeal.reasonCategory]}
                    </td>
                  </tr>
                </>
              )}

              {ticket.resolvedAt && (
                <tr>
                  <th className="py-2.5 pr-4 text-left align-top text-xs font-medium text-muted-foreground">
                    Thời điểm đóng hồ sơ
                  </th>
                  <td className="py-2.5 font-mono text-xs text-foreground tabular-nums">
                    {formatFormalTimestamp(ticket.resolvedAt)}
                  </td>
                </tr>
              )}
              {ticket.resolutionNote && (
                <tr>
                  <th className="py-2.5 pr-4 text-left align-top text-xs font-medium text-muted-foreground">
                    Ghi chú kết luận
                  </th>
                  <td className="py-2.5 whitespace-pre-wrap text-foreground">
                    {ticket.resolutionNote}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section aria-labelledby="section-thread-title">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 id="section-thread-title" className="text-sm font-medium text-foreground">
              2. Lịch sử trao đổi
            </h2>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {ticket.messages.length} mục
            </span>
          </div>
          <TicketThread messages={ticket.messages} viewerRole="USER" />
        </section>

        <section aria-labelledby="section-reply-title">
          <h2
            id="section-reply-title"
            className="border-b border-border pb-2 text-sm font-medium text-foreground"
          >
            3. Phản hồi bổ sung
          </h2>

          {canCompose ? (
            <form onSubmit={(event) => void handleReply(event)} className="mt-3 flex flex-col gap-3">
              {reopenableUntil && (
                <p className="border-l-2 border-l-sky-500/80 bg-sky-500/5 px-3 py-2 text-xs text-muted-foreground">
                  Hồ sơ đã kết thúc. Gửi phản hồi trước{" "}
                  <span className="font-mono tabular-nums">
                    {formatFormalTimestamp(reopenableUntil)}
                  </span>{" "}
                  sẽ tự mở lại hồ sơ này.
                </p>
              )}
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor="ticket-reply" className="text-xs text-muted-foreground">
                  Văn bản thuần, kèm tối đa 4 ảnh (tối đa 3 tin liên tiếp trước khi quản trị viên
                  phản hồi).
                </label>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {trimmedReply.length}/{MAX_TICKET_MESSAGE_LENGTH}
                </span>
              </div>
              <Textarea
                id="ticket-reply"
                rows={4}
                value={replyBody}
                maxLength={MAX_TICKET_MESSAGE_LENGTH}
                onChange={(event) => setReplyBody(event.target.value)}
                placeholder="Nhập thông tin bổ sung hoặc trả lời câu hỏi của quản trị viên..."
                disabled={replying || blockReason !== null}
              />
              <TicketImagePicker
                images={replyImages}
                onChange={setReplyImages}
                disabled={replying || blockReason !== null}
              />
              {blockReason && (
                <p className="border-l-2 border-l-sky-500/80 bg-sky-500/5 px-3 py-2 text-xs text-muted-foreground">
                  {blockReason}
                </p>
              )}
              {replyError && (
                <p role="alert" className="text-sm text-destructive">
                  {replyError}
                </p>
              )}
              <div className="flex items-center justify-end gap-2">
                <Button type="submit" size="sm" disabled={!canSubmitReply || replying}>
                  {replying && <Spinner aria-hidden />}
                  {active ? "Gửi phản hồi" : "Gửi và mở lại hồ sơ"}
                </Button>
              </div>
            </form>
          ) : (
            <p className="mt-3 border-l-2 border-l-border pl-3 text-sm text-muted-foreground">
              Hồ sơ này đã kết thúc nên không thể gửi thêm phản hồi.
              {!isAppeal ? " Nếu cần hỗ trợ tiếp, hãy tạo yêu cầu mới." : ""}
              {ticket.status === "WITHDRAWN" && isAppeal
                ? " Nếu vẫn còn trong thời hạn 14 ngày, bạn có thể gửi lại kháng cáo từ trang nội dung gốc."
                : ""}
            </p>
          )}
        </section>
      </div>

      <AlertDialog open={confirmWithdraw} onOpenChange={setConfirmWithdraw}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rút hồ sơ {ticket.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              {isAppeal
                ? "Hồ sơ kháng cáo sẽ đóng lại và nội dung liên quan sẽ mở khóa chỉnh sửa/xoá. Bạn chỉ có thể rút và gửi lại tối đa 2 lần trong thời hạn 14 ngày."
                : "Hồ sơ hỗ trợ sẽ chuyển sang trạng thái Đã rút và không thể mở lại."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Giữ hồ sơ</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void handleWithdraw()}>
              Xác nhận rút
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  )
}
