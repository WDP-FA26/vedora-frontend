"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { CheckIcon, CircleAlertIcon, FlagIcon, XIcon } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { DataTable, type DataTableView } from "@/features/admin/components/data-table/data-table"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import { ApiError } from "@/features/shared/lib/api-client"
import { COMMENT_REPORTS_KEY, fetchAllCommentReports, reviewCommentReport } from "./api"
import { commentReportColumns, CommentReportActionsContext } from "./report-columns"
import { CommentReportSheet } from "./group-report-sheet"
import { groupCommentReports, type CommentReportGroup } from "./report-groups"
import type { AdminCommentReport } from "./schema"

const VIEWS: DataTableView[] = [
  {
    id: "pending",
    label: "Chờ xử lý",
    icon: FlagIcon,
    columnFilters: [{ id: "status", value: "PENDING" }],
  },
  {
    id: "resolved",
    label: "Đã xử lý",
    icon: CheckIcon,
    columnFilters: [{ id: "status", value: "RESOLVED" }],
  },
  {
    id: "dismissed",
    label: "Đã bỏ qua",
    icon: XIcon,
    columnFilters: [{ id: "status", value: "DISMISSED" }],
  },
  { id: "all", label: "Tất cả", columnFilters: [] },
]
const NO_REPORTS: AdminCommentReport[] = []
const getRowId = (report: CommentReportGroup) => report.commentId

export function CommentReportsView() {
  const params = useSearchParams()
  const { accessToken } = useAuth()
  const { data, error, isLoading, mutate } = useAuthedSWR(
    COMMENT_REPORTS_KEY,
    fetchAllCommentReports
  )
  const reports = data ?? NO_REPORTS
  const groups = groupCommentReports(reports)
  const [openId, setOpenId] = useState<string | null>(() => params.get("reportId"))
  const [selected, setSelected] = useState<AdminCommentReport | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function review(report: AdminCommentReport, action: "DISMISS" | "REMOVE") {
    if (!accessToken || busy) return
    setBusy(report.id)
    setActionError(null)
    try {
      const reviewed = await reviewCommentReport(
        accessToken,
        report.id,
        action,
        report.comment.currentVersion
      )
      setSelected(null)
      await mutate((rows) => rows?.map((row) => (row.id === reviewed.id ? reviewed : row)), {
        revalidate: false,
      })
      await mutate()
    } catch (failure) {
      setActionError(
        failure instanceof ApiError && failure.status === 409
          ? failure.code === "COMMENT_CHANGED"
            ? "Bình luận đã được chỉnh sửa hoặc xóa sau khi bạn mở xác nhận. Hãy xem lại nội dung mới trước khi gỡ."
            : "Báo cáo đã được admin khác xử lý. Danh sách đã được cập nhật."
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

  function requestRemoval(id: string) {
    const group = groups.find(
      (group) => group.id === id || group.reports.some((report) => report.id === id)
    )
    setSelected(
      group
        ? {
            ...group,
            comment: {
              ...group.comment,
              isEdited: group.reports.some((report) => report.comment.isEdited),
            },
          }
        : null
    )
    setActionError(null)
  }

  return (
    <section aria-label="Báo cáo bình luận" className="flex min-h-0 flex-1 flex-col">
      <h2 className="sr-only">Báo cáo bình luận</h2>
      {actionError && !selected && (
        <Alert variant="destructive" className="m-4 w-auto">
          <CircleAlertIcon aria-hidden />
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}
      {isLoading ? (
        <div className="space-y-2 p-4" aria-label="Đang tải báo cáo bình luận">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="p-4">
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden />
            <AlertDescription>
              <p>
                {error instanceof ApiError && error.status === 403
                  ? "Bạn không có quyền xem báo cáo bình luận."
                  : "Không tải được báo cáo bình luận."}
              </p>
              <Button variant="outline" size="sm" onClick={() => void mutate()}>
                Thử lại
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        <CommentReportActionsContext
          value={{
            open: setOpenId,
            dismiss: (report) => void review(report, "DISMISS"),
            remove: requestRemoval,
            busy: Boolean(busy),
          }}
        >
          <DataTable
            columns={commentReportColumns}
            data={groups}
            getRowId={getRowId}
            views={VIEWS}
            defaultView="pending"
            searchPlaceholder="Tìm theo nội dung hoặc tác giả"
            emptyMessage="Không có báo cáo bình luận trong mục này."
          />
        </CommentReportActionsContext>
      )}
      <CommentReportSheet
        group={
          groups.find(
            (group) =>
              group.commentId === openId || group.reports.some((report) => report.id === openId)
          ) ?? null
        }
        busy={Boolean(busy)}
        error={actionError}
        onClose={() => setOpenId(null)}
        onDismiss={(report) => void review(report, "DISMISS")}
        onRemove={requestRemoval}
      />
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
            {selected?.comment.isAvailable && (
              <div className="space-y-2 rounded-xl border p-3 text-sm">
                <p className="font-medium">Nội dung hiện tại sẽ bị gỡ</p>
                <p className="whitespace-pre-wrap break-words">{selected.comment.currentBody}</p>
                {selected.comment.isEdited && (
                  <p className="text-muted-foreground">
                    Nội dung này đã sửa sau báo cáo. Bằng chứng gốc vẫn được giữ trong chi tiết.
                  </p>
                )}
              </div>
            )}
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
