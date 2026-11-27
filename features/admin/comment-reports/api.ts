import { API_URL } from "@/features/auth/lib/api"
import { sendJson } from "@/features/shared/lib/api-client"
import { commentReportPageSchema, commentReportSchema, type AdminCommentReport } from "./schema"

export const COMMENT_REPORTS_KEY = `${API_URL}/admin/comment-reports`
const PAGE_LIMIT = 50

export async function fetchAllCommentReports([url, token]: readonly [string, string]) {
  const reports = new Map<string, AdminCommentReport>()
  for (let page = 1; ; page++) {
    const { items, meta } = await sendJson(
      commentReportPageSchema,
      `${url}?page=${page}&limit=${PAGE_LIMIT}`,
      token
    )
    for (const report of items) reports.set(report.id, report)
    if (!meta.hasNextPage) return [...reports.values()]
  }
}

export function reviewCommentReport(
  token: string,
  id: string,
  action: "DISMISS" | "REMOVE",
  expectedCommentVersion?: string | null
) {
  return sendJson(commentReportSchema, `${COMMENT_REPORTS_KEY}/${id}/review`, token, {
    method: "POST",
    body: JSON.stringify({ action, ...(action === "REMOVE" ? { expectedCommentVersion } : {}) }),
  })
}
