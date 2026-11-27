"use client"

import { useState } from "react"
import Link from "next/link"
import { ScaleIcon, ShieldAlertIcon } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { CreateAppealDialog } from "@/features/support/components/create-appeal-dialog"
import { TicketStatusBadge } from "@/features/support/components/ticket-status-badge"
import { APPEAL_BLOCKED_LABELS, type PostAppealSummary } from "@/features/support/schemas"
import { supportTicketPath } from "@/features/support/support-cache"
import { ModerationFindings } from "@/features/posts/components/moderation-findings"
import { useProcessingPost } from "@/features/posts/hooks/use-feed-posts"
import { rejectionMessage } from "@/features/posts/lib/moderation-labels"
import { REPORT_REASONS, REPORT_REASON_LABELS, type ApiPost, type ReportReason } from "@/features/posts/schemas"
import { formatPostDateLong } from "@/features/shared/lib/format"

function formatRemovalReason(reason: string | null | undefined): string | null {
  if (!reason) return null
  if (REPORT_REASONS.includes(reason as ReportReason)) {
    return REPORT_REASON_LABELS[reason as ReportReason]
  }
  return reason
}

export function ModerationNotice({ post }: { post: ApiPost }) {
  if (post.status === "PROCESSING") return <CheckingNotice id={post.id} blog={post.type === "BLOG"} />

  const subject = post.type === "BLOG" ? "Blog" : "Bài viết"
  if (post.status === "PENDING_REVIEW") {
    return (
      <Notice tone="muted">
        <Spinner aria-hidden />
        <span>
          {subject} đang chờ quản trị viên xem xét. Chỉ bạn thấy {subject.toLowerCase()} này cho đến
          khi có kết quả.
        </span>
      </Notice>
    )
  }
  if (post.status === "REJECTED") {
    return (
      <AppealableNotice
        postId={post.id}
        subject={subject}
        appeal={post.appeal ?? null}
        message={`${rejectionMessage(post.moderationVerdict, subject, post.moderationReason)} Chỉ bạn thấy ${subject.toLowerCase()} này.`}
      >
        <ModerationFindings findings={post.moderationFindings ?? []} />
      </AppealableNotice>
    )
  }
  if (post.status === "REMOVED") {
    const reason = formatRemovalReason(post.removalReason)
    return (
      <AppealableNotice
        postId={post.id}
        subject={subject}
        appeal={post.appeal ?? null}
        message={`${subject} này đã bị quản trị viên gỡ bỏ${reason ? ` (${reason})` : ""}. Chỉ bạn thấy ${subject.toLowerCase()} này.`}
      />
    )
  }
  if (post.status === "FAILED") {
    return (
      <Notice tone="destructive">
        <ShieldAlertIcon aria-hidden className="size-4 shrink-0" />
        <span>
          Video của bài viết xử lý không thành công nên bài chưa được đăng. Hãy sửa bài để thay
          video khác.
        </span>
      </Notice>
    )
  }
  return null
}

function AppealableNotice({
  postId,
  subject,
  appeal,
  message,
  children,
}: {
  postId: string
  subject: string
  appeal: PostAppealSummary | null
  message: string
  children?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <div
      role="status"
      className="mb-4 flex flex-col gap-2.5 rounded-xl bg-destructive/10 px-3.5 py-3 text-sm text-destructive"
    >
      <div className="flex items-start gap-2 font-medium">
        <ShieldAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>{message}</span>
      </div>
      {children}

      {appeal?.activeTicket ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-destructive/20 pt-2.5 text-foreground">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono font-medium">{appeal.activeTicket.code}</span>
            <TicketStatusBadge
              status={appeal.activeTicket.status}
              appealOutcome={appeal.activeTicket.outcome}
            />
            <span className="text-muted-foreground">
              Đang khóa chỉnh sửa và xóa cho đến khi kháng cáo kết thúc.
            </span>
          </div>
          <Link
            href={supportTicketPath(appeal.activeTicket.id)}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Xem hồ sơ kháng cáo
          </Link>
        </div>
      ) : appeal?.canAppeal ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-destructive/20 pt-2.5 text-foreground">
          <span className="text-xs text-muted-foreground">
            Nếu bạn cho rằng đây là nhầm lẫn, bạn có thể gửi kháng cáo
            {appeal.deadlineAt ? ` trước ${formatPostDateLong(appeal.deadlineAt)}` : " trong 14 ngày"}
            .
          </span>
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
            <ScaleIcon aria-hidden />
            Gửi kháng cáo
          </Button>
          <CreateAppealDialog
            postId={postId}
            subject={subject}
            deadlineAt={appeal.deadlineAt}
            open={open}
            onOpenChange={setOpen}
          />
        </div>
      ) : appeal?.blockedReason ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-destructive/20 pt-2.5 text-xs text-muted-foreground">
          <span>{APPEAL_BLOCKED_LABELS[appeal.blockedReason]}</span>
          {appeal.latestTicket && (
            <Link
              href={supportTicketPath(appeal.latestTicket.id)}
              className="font-medium text-foreground underline underline-offset-4"
            >
              Xem hồ sơ {appeal.latestTicket.code}
            </Link>
          )}
        </div>
      ) : null}
    </div>
  )
}

function CheckingNotice({ id, blog }: { id: string; blog: boolean }) {
  useProcessingPost(id)
  return (
    <Notice tone="muted">
      <Spinner aria-hidden />
      <span>
        {blog ? "Blog" : "Bài viết"} đang được kiểm duyệt. Chỉ bạn thấy bài này cho đến khi xong.
      </span>
    </Notice>
  )
}

function Notice({ tone, children }: { tone: "muted" | "destructive"; children: React.ReactNode }) {
  return (
    <p
      role="status"
      className={
        tone === "destructive"
          ? "mb-4 flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
          : "mb-4 flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm font-medium text-muted-foreground"
      }
    >
      {children}
    </p>
  )
}
