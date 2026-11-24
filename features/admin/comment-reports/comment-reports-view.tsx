"use client"

import { useState } from "react"
import Link from "next/link"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import { API_URL } from "@/features/auth/lib/api"
import { ApiError, sendJson } from "@/features/shared/lib/api-client"
import { REPORT_REASON_LABELS } from "@/features/posts/schemas"
import {
  commentReportPageSchema,
  commentReportSchema,
  type AdminCommentReport,
  type CommentReportStatus,
} from "./schema"

const BASE = `${API_URL}/admin/comment-reports`
const LABELS = { PENDING: "Chờ xử lý", RESOLVED: "Đã xử lý", DISMISSED: "Đã bỏ qua" }

export function CommentReportsView() {
  const { accessToken } = useAuth()
  const [status, setStatus] = useState<CommentReportStatus | "">("PENDING")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<AdminCommentReport | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const url = `${BASE}?page=${page}&limit=20${status ? `&status=${status}` : ""}`
  const { data, error, isLoading, mutate } = useAuthedSWR(
    url,
    ([key, token]: readonly [string, string]) => sendJson(commentReportPageSchema, key, token)
  )

  async function review(report: AdminCommentReport, action: "DISMISS" | "REMOVE") {
    if (!accessToken || busy) return
    setBusy(report.id)
    setActionError(null)
    try {
      await sendJson(commentReportSchema, `${BASE}/${report.id}/review`, accessToken, {
        method: "POST",
        body: JSON.stringify({ action }),
      })
      setSelected(null)
      await mutate()
    } catch (failure) {
      setActionError(
        failure instanceof ApiError && failure.status === 409
          ? "Báo cáo đã được admin khác xử lý. Danh sách đã được cập nhật."
          : "Không xử lý được báo cáo. Vui lòng thử lại."
      )
      if (failure instanceof ApiError && failure.status === 409) {
        setSelected(null)
        await mutate()
      }
    } finally {
      setBusy(null)
    }
  }

  return (
    <section aria-label="Báo cáo bình luận" className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Báo cáo bình luận</h1>
        <label className="flex items-center gap-2 text-sm">
          Trạng thái
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as CommentReportStatus | "")
              setPage(1)
              setActionError(null)
            }}
            className="rounded-md border bg-background px-3 py-2"
          >
            <option value="">Tất cả</option>
            {Object.entries(LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {actionError && !selected && (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      )}
      {isLoading ? (
        <Spinner aria-label="Đang tải báo cáo bình luận" />
      ) : error ? (
        <div role="alert" className="space-y-2 text-sm text-destructive">
          <p>
            {error instanceof ApiError && error.status === 403
              ? "Bạn không có quyền xem báo cáo bình luận."
              : "Không tải được báo cáo bình luận."}
          </p>
          <Button variant="outline" onClick={() => void mutate()}>
            Thử lại
          </Button>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{data?.meta.totalItems ?? 0} báo cáo</p>
          {!data?.items.length && (
            <p className="py-8 text-center text-muted-foreground">
              Không có báo cáo bình luận trong mục này.
            </p>
          )}
          <ul className="space-y-4">
            {data?.items.map((report) => (
              <li key={report.id}>
                <article
                  aria-label={`Báo cáo bình luận của ${report.comment.author.fullName}`}
                  className="space-y-3 rounded-xl border p-4"
                >
                  <div className="flex flex-wrap justify-between gap-2 text-sm">
                    <p>
                      <strong>{report.comment.author.fullName}</strong> ·{" "}
                      {report.comment.parentId ? "Phản hồi" : "Bình luận gốc"}
                    </p>
                    <span>{LABELS[report.status]}</span>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Nội dung lúc báo cáo</p>
                    <blockquote className="border-l-2 pl-3 whitespace-pre-wrap break-words">
                      {report.comment.body}
                    </blockquote>
                  </div>
                  {report.comment.isAvailable &&
                    report.comment.currentBody !== report.comment.body && (
                      <div>
                        <p className="mb-1 text-xs text-muted-foreground">
                          Nội dung hiện tại (đã sửa)
                        </p>
                        <p className="whitespace-pre-wrap break-words">
                          {report.comment.currentBody}
                        </p>
                      </div>
                    )}
                  {!report.comment.isAvailable && (
                    <p className="text-sm text-muted-foreground">
                      Bình luận đã bị xóa. Bằng chứng báo cáo vẫn được giữ lại.
                    </p>
                  )}
                  <p className="text-sm">
                    <strong>Lý do:</strong> {REPORT_REASON_LABELS[report.reason]}
                  </p>
                  {report.details && (
                    <p className="text-sm whitespace-pre-wrap break-words">{report.details}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Người báo cáo: {report.reporter?.fullName ?? "Tài khoản không còn tồn tại"} ·{" "}
                    {new Date(report.createdAt).toLocaleString("vi-VN")}
                  </p>
                  {report.reviewedAt && (
                    <p className="text-xs text-muted-foreground">
                      Xử lý lúc {new Date(report.reviewedAt).toLocaleString("vi-VN")} ·{" "}
                      {report.action === "ALREADY_REMOVED"
                        ? "Nội dung đã được xóa trước đó"
                        : report.action === "REMOVED"
                          ? "Đã gỡ nội dung"
                          : "Đã bỏ qua"}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {report.postAvailable && report.comment.isAvailable && (
                      <Link
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                        href={`/posts/${report.postId}?comment=${report.commentId}#comment-${report.commentId}`}
                      >
                        Xem trong bài viết
                      </Link>
                    )}
                    {report.status === "PENDING" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={Boolean(busy)}
                          onClick={() => void review(report, "DISMISS")}
                        >
                          Bỏ qua báo cáo
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={Boolean(busy)}
                          onClick={() => {
                            setSelected(report)
                            setActionError(null)
                          }}
                        >
                          {report.comment.isAvailable ? "Gỡ bình luận" : "Xác nhận đã xóa"}
                        </Button>
                      </>
                    )}
                  </div>
                </article>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="outline"
              disabled={!data?.meta.hasPreviousPage || Boolean(busy)}
              onClick={() => setPage((value) => value - 1)}
            >
              Trang trước
            </Button>
            <span className="text-sm">Trang {page}</span>
            <Button
              variant="outline"
              disabled={!data?.meta.hasNextPage || Boolean(busy)}
              onClick={() => setPage((value) => value + 1)}
            >
              Trang sau
            </Button>
          </div>
        </>
      )}
      <AlertDialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open && !busy) setSelected(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selected?.comment.isAvailable ? "Gỡ bình luận vi phạm?" : "Hoàn tất báo cáo?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {!selected?.comment.isAvailable
                ? "Bình luận không còn tồn tại. Báo cáo sẽ được đánh dấu đã xử lý và giữ bằng chứng."
                : selected.comment.parentId
                  ? "Chỉ phản hồi này bị xóa vĩnh viễn. Các phản hồi khác được giữ lại."
                  : `Bình luận gốc và tất cả phản hồi sẽ bị xóa vĩnh viễn (hiện có ${selected.comment.replyCount} phản hồi). Các báo cáo đang chờ của những nội dung bị xóa cũng được hoàn tất.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {actionError && (
            <p role="alert" className="text-sm text-destructive">
              {actionError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(busy)}>Hủy</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={Boolean(busy)}
              onClick={() => selected && void review(selected, "REMOVE")}
            >
              {busy && <Spinner aria-hidden />}{" "}
              {selected?.comment.isAvailable ? "Xác nhận gỡ" : "Đánh dấu đã xử lý"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
