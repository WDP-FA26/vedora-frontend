"use client"

import Link from "next/link"
import { ExternalLinkIcon, Trash2Icon } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { AuthorAvatar } from "@/features/shared/components/author-avatar"
import { toAuthor } from "@/features/auth/lib/to-author"
import { REPORT_REASON_LABELS } from "@/features/posts/schemas"
import { formatPostDateLong } from "@/features/shared/lib/format"
import { CommentReportStatusBadge } from "./report-columns"
import type { AdminCommentReport } from "./schema"

export function CommentReportSheet({
  report,
  busy,
  onClose,
  onDismiss,
  onRemove,
}: {
  report: AdminCommentReport | null
  busy: boolean
  onClose: () => void
  onDismiss: (report: AdminCommentReport) => void
  onRemove: (id: string) => void
}) {
  return (
    <Sheet open={Boolean(report)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Bình luận bị báo cáo</SheetTitle>
          <SheetDescription>
            {report
              ? `Báo cáo lúc ${formatPostDateLong(report.createdAt)}`
              : "Chi tiết báo cáo bình luận"}
          </SheetDescription>
        </SheetHeader>
        {report && (
          <>
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pb-6">
              <div className="flex items-center gap-3">
                <AuthorAvatar author={toAuthor(report.comment.author)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{report.comment.author.fullName}</p>
                  <p className="truncate text-muted-foreground">
                    @{report.comment.author.username}
                  </p>
                </div>
                <CommentReportStatusBadge status={report.status} />
              </div>
              <dl className="space-y-2 border-y py-3">
                <div>
                  <dt className="text-xs text-muted-foreground">Loại</dt>
                  <dd>{report.comment.parentId ? "Phản hồi" : "Bình luận gốc"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Lý do</dt>
                  <dd>{REPORT_REASON_LABELS[report.reason]}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Người báo cáo</dt>
                  <dd>{report.reporter?.fullName ?? "Tài khoản không còn tồn tại"}</dd>
                </div>
              </dl>
              <section aria-label="Bằng chứng báo cáo" className="space-y-2">
                <h3 className="font-medium">Nội dung lúc báo cáo</h3>
                <p className="text-base leading-7 whitespace-pre-wrap break-words">
                  {report.comment.body}
                </p>
              </section>
              {report.comment.isAvailable && report.comment.currentBody !== report.comment.body && (
                <section className="space-y-2">
                  <h3 className="font-medium">Nội dung hiện tại (đã sửa)</h3>
                  <p className="leading-7 whitespace-pre-wrap break-words">
                    {report.comment.currentBody}
                  </p>
                </section>
              )}
              {!report.comment.isAvailable && (
                <p className="text-muted-foreground">
                  Bình luận đã bị xóa. Bằng chứng báo cáo vẫn được giữ lại.
                </p>
              )}
              {report.details && (
                <section className="space-y-2">
                  <h3 className="font-medium">Chi tiết từ người báo cáo</h3>
                  <p className="whitespace-pre-wrap break-words">{report.details}</p>
                </section>
              )}
              {report.reviewedAt && (
                <div className="space-y-1 border-t pt-3 text-sm text-muted-foreground">
                  <p>Xử lý lúc {formatPostDateLong(report.reviewedAt)}</p>
                  <p>
                    {report.action === "ALREADY_REMOVED"
                      ? "Nội dung đã được xóa trước đó"
                      : report.action === "REMOVED"
                        ? "Đã gỡ nội dung"
                        : "Đã bỏ qua"}
                  </p>
                </div>
              )}
            </div>
            <SheetFooter>
              <div className="flex flex-wrap justify-end gap-2">
                {report.postAvailable && report.comment.isAvailable && (
                  <Link
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                    href={`/posts/${report.postId}?comment=${report.commentId}#comment-${report.commentId}`}
                  >
                    <ExternalLinkIcon aria-hidden /> Xem trong bài viết
                  </Link>
                )}
                {report.status === "PENDING" && (
                  <>
                    <Button
                      variant="action"
                      size="sm"
                      disabled={busy}
                      onClick={() => onDismiss(report)}
                    >
                      Bỏ qua báo cáo
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={busy}
                      onClick={() => onRemove(report.id)}
                    >
                      <Trash2Icon aria-hidden />{" "}
                      {report.comment.isAvailable ? "Gỡ bình luận" : "Xác nhận đã xóa"}
                    </Button>
                  </>
                )}
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
