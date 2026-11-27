import type { AdminCommentReport } from "./schema"

export type CommentReportGroup = AdminCommentReport & { reports: AdminCommentReport[] }

export function groupCommentReports(reports: AdminCommentReport[]): CommentReportGroup[] {
  const byComment = new Map<string, AdminCommentReport[]>()
  for (const report of reports) {
    const rows = byComment.get(report.commentId) ?? []
    rows.push(report)
    byComment.set(report.commentId, rows)
  }
  return [...byComment.values()].map((rows) => {
    const sorted = [...rows].sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)
    )
    const latest = sorted[0]
    const representative = sorted.find((report) => report.status === "PENDING") ?? latest
    return {
      ...representative,
      createdAt: latest.createdAt,
      reports: sorted,
      comment: { ...representative.comment, isEdited: rows.some((row) => row.comment.isEdited) },
      reportCount: Math.max(latest.reportCount, rows.length),
      pendingReportCount: Math.max(
        latest.pendingReportCount,
        rows.filter((row) => row.status === "PENDING").length
      ),
      resolvedReportCount: Math.max(
        latest.resolvedReportCount,
        rows.filter((row) => row.status === "RESOLVED").length
      ),
      dismissedReportCount: Math.max(
        latest.dismissedReportCount,
        rows.filter((row) => row.status === "DISMISSED").length
      ),
    }
  })
}
