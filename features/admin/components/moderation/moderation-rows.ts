import type { AdminPost, AdminReport } from "@/features/admin/schemas"

export type QueueKind = "held" | "blocked" | "report"

export type QueueRow = {
  id: string
  kind: QueueKind
  postId: string
  excerpt: string
  author: { fullName: string; username: string }
  riskLevel: number | null
  category: string | null
  report: AdminReport | null
  reportCount?: number
  pendingReportCount?: number
  createdAt: string
}

function excerptOf(post: { body: string | null; blog: { title: string } | null }) {
  const text = post.blog ? post.blog.title : (post.body ?? "")
  return text.trim() || "(Bài chỉ có video)"
}

function moderationOf(post: AdminPost | undefined) {
  return {
    riskLevel: post?.moderation?.riskLevel ?? null,
    category:
      post?.moderation && post.moderation.verdict !== "allow" ? post.moderation.verdict : null,
  }
}

export function buildQueue(posts: AdminPost[], reports: AdminReport[]): QueueRow[] {
  const postById = new Map(posts.map((post) => [post.id, post]))
  const rows: QueueRow[] = []

  for (const post of posts) {
    if (post.status !== "PENDING_REVIEW" && post.status !== "REJECTED") continue
    rows.push({
      id: `post:${post.id}`,
      kind: post.status === "PENDING_REVIEW" ? "held" : "blocked",
      postId: post.id,
      excerpt: excerptOf(post),
      author: post.author,
      ...moderationOf(post),
      report: null,
      createdAt: post.createdAt,
    })
  }

  const grouped = new Map<string, AdminReport[]>()
  for (const report of reports) {
    if (report.status !== "PENDING") continue
    const group = grouped.get(report.postId) ?? []
    group.push(report)
    grouped.set(report.postId, group)
  }
  for (const group of grouped.values()) {
    const report = [...group].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
    const post = postById.get(report.postId)
    rows.push({
      id: `report:${report.postId}`,
      kind: "report",
      postId: report.postId,
      excerpt: post ? excerptOf(post) : (report.post.body ?? "").trim() || "(Bài chỉ có video)",
      author: report.post.author,
      ...moderationOf(post),
      report,
      reportCount:
        report.reportCount ?? reports.filter((item) => item.postId === report.postId).length,
      pendingReportCount: report.pendingReportCount ?? group.length,
      createdAt: report.createdAt,
    })
  }

  return rows.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}
