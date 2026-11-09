import type { AdminPost, AdminReport } from "@/features/admin/schemas"

/** Why a post is in the moderation queue. */
export type QueueKind = "held" | "blocked" | "report"

export type QueueRow = {
  /** Unique across kinds: a post can be both held and reported. */
  id: string
  kind: QueueKind
  postId: string
  /** The text a moderator reads first: the post, or a blog's title. */
  excerpt: string
  author: { fullName: string; username: string }
  /** Jev's chance that the post breaks the policy, 0 to 1; null if never scored. */
  violationScore: number | null
  /** The category the post most likely breaks. */
  category: string | null
  /** For `held` and `blocked`: what the automated check decided. For `report`: the reporter's reason. */
  report: AdminReport | null
  createdAt: string
}

function excerptOf(post: { body: string | null; blog: { title: string } | null }) {
  const text = post.blog ? post.blog.title : (post.body ?? "")
  return text.trim() || "(Bài chỉ có video)"
}

function scoreOf(post: AdminPost | undefined) {
  return {
    violationScore: post?.moderation?.violationScore ?? null,
    category: post?.moderation && post.moderation.verdict !== "allow" ? post.moderation.verdict : null,
  }
}

/** Posts the check held or blocked, plus every pending user report, newest first. */
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
      ...scoreOf(post),
      report: null,
      createdAt: post.createdAt,
    })
  }

  for (const report of reports) {
    if (report.status !== "PENDING") continue
    const post = postById.get(report.postId)
    rows.push({
      id: `report:${report.id}`,
      kind: "report",
      postId: report.postId,
      excerpt: post ? excerptOf(post) : (report.post.body ?? "").trim() || "(Bài chỉ có video)",
      author: report.post.author,
      ...scoreOf(post),
      report,
      createdAt: report.createdAt,
    })
  }

  return rows.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}
