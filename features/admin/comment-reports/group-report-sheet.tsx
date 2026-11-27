"use client"

import Link from "next/link"
import { ExternalLinkIcon, Trash2Icon } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { REPORT_REASON_LABELS } from "@/features/posts/schemas"
import { formatPostDateLong } from "@/features/shared/lib/format"
import { CommentReportStatusBadge } from "./report-columns"
import type { AdminCommentReport } from "./schema"
import type { CommentReportGroup } from "./report-groups"

export function CommentReportSheet({
  group,
  busy,
  error,
  onClose,
  onDismiss,
  onRemove,
}: {
  group: CommentReportGroup | null
  busy: boolean
  onClose: () => void
  error: string | null
  onDismiss: (report: AdminCommentReport) => void
  onRemove: (id: string) => void
}) {
  return (
    <Sheet
      open={Boolean(group)}
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Bình luận bị báo cáo</SheetTitle>
          <SheetDescription>
            {group
              ? `${group.reportCount} lượt báo cáo · ${group.pendingReportCount} chờ xử lý`
              : "Chi tiết báo cáo bình luận"}
          </SheetDescription>
        </SheetHeader>
        {group && (
          <>
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pb-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-1">
                <p className="font-medium">{group.comment.author.fullName}</p>
                <p className="text-sm text-muted-foreground">
                  @{group.comment.author.username} ·{" "}
                  {group.comment.parentId ? "Phản hồi" : "Bình luận gốc"}
                </p>
              </div>
              {group.reports.some((report) => report.comment.isEdited) && (
                <Alert>
                  <AlertDescription>
                    Bình luận đã được chỉnh sửa sau ít nhất một lượt báo cáo. Hãy đối chiếu bằng
                    chứng bên dưới với nội dung hiện tại trước khi quyết định.
                  </AlertDescription>
                </Alert>
              )}
              <section aria-label="Nội dung hiện tại" className="space-y-2 rounded-xl border p-3">
                <h3 className="font-medium">
                  Nội dung hiện tại{group.comment.isEdited ? " (đã sửa)" : ""}
                </h3>
                {group.comment.isAvailable ? (
                  <p className="whitespace-pre-wrap break-words">{group.comment.currentBody}</p>
                ) : (
                  <p className="text-muted-foreground">
                    Bình luận đã bị xóa. Bằng chứng báo cáo vẫn được giữ lại.
                  </p>
                )}
              </section>
              <section aria-label="Các lượt báo cáo" className="space-y-3">
                <h3 className="font-medium">Các lượt báo cáo</h3>
                <ul className="space-y-4">
                  {group.reports.map((report) => (
                    <li
                      key={report.id}
                      aria-label={`Báo cáo của ${report.reporter?.fullName ?? "Tài khoản đã xóa"}`}
                      className="space-y-3 rounded-xl border p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">
                          {report.reporter?.fullName ?? "Tài khoản không còn tồn tại"}
                        </p>
                        <CommentReportStatusBadge status={report.status} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Báo cáo lúc {formatPostDateLong(report.createdAt)}
                      </p>
                      <p className="text-sm">Lý do: {REPORT_REASON_LABELS[report.reason]}</p>
                      <section aria-label="Bằng chứng báo cáo" className="space-y-1">
                        <h4 className="text-sm font-medium">Nội dung lúc báo cáo</h4>
                        <p className="whitespace-pre-wrap break-words">{report.comment.body}</p>
                      </section>
                      {report.details && (
                        <section className="space-y-1">
                          <h4 className="text-sm font-medium">Chi tiết từ người báo cáo</h4>
                          <p className="whitespace-pre-wrap break-words">{report.details}</p>
                        </section>
                      )}
                      {report.reviewedAt && (
                        <p className="text-xs text-muted-foreground">
                          Xử lý lúc {formatPostDateLong(report.reviewedAt)}
                          {report.action === "ALREADY_REMOVED"
                            ? " · Nội dung đã được xóa trước đó"
                            : ""}
                        </p>
                      )}
                      {report.status === "PENDING" && (
                        <Button
                          variant="action"
                          size="sm"
                          disabled={busy}
                          onClick={() => onDismiss(report)}
                        >
                          Bỏ qua báo cáo
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
            <SheetFooter>
              <div className="flex flex-wrap justify-end gap-2">
                {group.postAvailable && group.comment.isAvailable && (
                  <Link
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                    href={`/posts/${group.postId}?comment=${group.commentId}#comment-${group.commentId}`}
                  >
                    <ExternalLinkIcon aria-hidden /> Xem trong bài viết
                  </Link>
                )}
                {group.pendingReportCount > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={busy}
                    onClick={() => onRemove(group.id)}
                  >
                    <Trash2Icon aria-hidden />
                    {group.comment.isAvailable ? "Gỡ bình luận" : "Xác nhận đã xóa"}
                  </Button>
                )}
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
