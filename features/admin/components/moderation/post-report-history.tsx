"use client"

import { useEffect, useState } from "react"
import { useSWRConfig } from "swr"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ADMIN_REPORTS_KEY } from "@/features/admin/admin-cache"
import { fetchAllReports, reviewReport } from "@/features/admin/lib/admin-api"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import { REPORT_REASON_LABELS } from "@/features/posts/schemas"
import { ApiError } from "@/features/shared/lib/api-client"
import { formatPostDateLong } from "@/features/shared/lib/format"

export function PostReportHistory({ postId, postStatus }: { postId: string; postStatus: string }) {
  const { accessToken } = useAuth()
  const { mutate: mutateCache } = useSWRConfig()
  const { data, error, isLoading, mutate } = useAuthedSWR(
    `${ADMIN_REPORTS_KEY}?postId=${encodeURIComponent(postId)}`,
    fetchAllReports,
    { refreshInterval: 300_000 }
  )
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  useEffect(() => {
    void mutate()
  }, [postStatus, mutate])
  const reports = data?.filter((row) => row.postId === postId) ?? []
  const total = reports[0]?.reportCount ?? reports.length
  const pending =
    reports[0]?.pendingReportCount ?? reports.filter((row) => row.status === "PENDING").length
  async function decide(id: string, status: "RESOLVED" | "DISMISSED") {
    if (!accessToken || busy) return
    setBusy(id)
    setActionError(null)
    try {
      await reviewReport(accessToken, id, status)
    } catch (error) {
      setActionError(
        error instanceof ApiError && error.status === 409
          ? "Báo cáo đã được quản trị viên khác xử lý. Danh sách đã được cập nhật."
          : "Không xử lý được báo cáo. Vui lòng thử lại."
      )
    } finally {
      await Promise.allSettled([mutate(), mutateCache([ADMIN_REPORTS_KEY, accessToken])])
      setBusy(null)
    }
  }
  return (
    <section aria-label="Báo cáo của bài viết" className="space-y-4 border-t pt-4">
      <div>
        <h3 className="text-sm font-medium">Báo cáo của bài viết</h3>
        {!isLoading && !error && (
          <p className="text-sm text-muted-foreground">
            {total} lượt báo cáo · {pending} chờ xử lý
          </p>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="h-20" />
      ) : error ? (
        <div>
          <p role="alert" className="text-sm text-destructive">
            Không tải được báo cáo của bài viết.
          </p>
          <Button variant="outline" size="sm" onClick={() => void mutate()}>
            Thử lại
          </Button>
        </div>
      ) : reports.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có báo cáo.</p>
      ) : (
        <ul className="space-y-4">
          {reports.map((report) => (
            <li
              key={report.id}
              className="space-y-2 border-b pb-4"
              aria-label={`Báo cáo của ${report.reporter.fullName}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{report.reporter.fullName}</p>
                <Badge variant={report.status === "PENDING" ? "secondary" : "outline"}>
                  {report.status === "PENDING"
                    ? "Chờ xử lý"
                    : report.status === "DISMISSED"
                      ? "Đã bỏ qua"
                      : "Đã xử lý"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatPostDateLong(report.createdAt)}
              </p>
              <p className="text-sm">{REPORT_REASON_LABELS[report.reason]}</p>
              {report.details && (
                <p className="break-words whitespace-pre-wrap text-sm">{report.details}</p>
              )}
              {report.evidence.length > 0 && (
                <ul className="flex flex-wrap gap-2" aria-label="Ảnh minh chứng">
                  {report.evidence.map((image, index) => (
                    <li key={image.id}>
                      <a
                        href={image.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Xem ảnh minh chứng ${index + 1} của ${report.reporter.fullName}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- private signed storage URL */}
                        <img
                          src={image.url}
                          alt={`Minh chứng ${index + 1}`}
                          referrerPolicy="no-referrer"
                          className="size-24 rounded-sm border object-cover"
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {report.status === "PENDING" && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="action"
                    size="sm"
                    disabled={Boolean(busy)}
                    onClick={() => void decide(report.id, "DISMISSED")}
                  >
                    Bỏ qua báo cáo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={Boolean(busy)}
                    onClick={() => void decide(report.id, "RESOLVED")}
                  >
                    Đánh dấu đã xử lý
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {actionError && (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      )}
    </section>
  )
}
