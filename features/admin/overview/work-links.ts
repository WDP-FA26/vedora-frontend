import type { WorkItem, WorkKind } from "./schema"

export const WORK_LABELS: Record<WorkKind, string> = {
  POST_REVIEW: "Bài chờ duyệt",
  POST_REPORTS: "Bài viết bị báo cáo",
  COMMENT_REPORTS: "Bình luận bị báo cáo",
  VERIFICATION: "Xác minh chuyên gia",
  WORKSPACES: "Duyệt trang nhà hàng",
  SUPPORT: "Hỗ trợ & Kháng cáo",
  KNOWLEDGE: "Tài liệu chờ duyệt",
}
export const WORK_PATHS: Record<WorkKind, string> = {
  POST_REVIEW: "/admin/reports?view=held",
  POST_REPORTS: "/admin/reports?view=report",
  COMMENT_REPORTS: "/admin/reports?tab=comments",
  VERIFICATION: "/admin/verification",
  WORKSPACES: "/admin/workspaces",
  SUPPORT: "/admin/support",
  KNOWLEDGE: "/admin/knowledge?view=review",
}
export function workItemPath(item: WorkItem) {
  const id = encodeURIComponent(item.id)
  switch (item.kind) {
    case "POST_REVIEW":
      return `/admin/reports?view=held&postId=${id}`
    case "POST_REPORTS":
      return `/admin/reports?view=report&postId=${id}`
    case "COMMENT_REPORTS":
      return `/admin/reports?tab=comments&reportId=${id}`
    case "VERIFICATION":
      return `/admin/verification?requestId=${id}`
    case "WORKSPACES":
      return `/admin/workspaces?workspaceId=${id}`
    case "SUPPORT":
      return `/admin/support/${id}`
    case "KNOWLEDGE":
      return `/admin/knowledge/${id}`
  }
}
