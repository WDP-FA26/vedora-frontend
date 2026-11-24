import { z } from "zod"

export const RESOURCE_LABELS = {
  USER: "Tài khoản",
  POST: "Bài viết",
  COMMENT: "Bình luận",
  POST_REPORT: "Báo cáo bài viết",
  COMMENT_REPORT: "Báo cáo bình luận",
  RECIPE: "Công thức",
  INGREDIENT: "Nguyên liệu",
  INGREDIENT_GROUP: "Nhóm nguyên liệu",
  INCOMPATIBILITY_RULE: "Quy tắc kết hợp",
  KNOWLEDGE: "Tài liệu kiến thức",
  MODERATION_SETTINGS: "Chính sách kiểm duyệt",
  SUPPORT_TICKET: "Hồ sơ hỗ trợ",
  VERIFICATION: "Xác minh chuyên gia",
  WORKSPACE: "Trang nhà hàng",
  PAYMENT: "Thanh toán",
  AI_COST: "Chi phí AI",
  OTHER: "Khác",
} as const
export const systemLogSchema = z.object({
  id: z.string(),
  requestId: z.string(),
  actorId: z.string(),
  actorUsername: z.string(),
  action: z.string(),
  actionLabel: z.string(),
  resourceType: z.enum(
    Object.keys(RESOURCE_LABELS) as [
      keyof typeof RESOURCE_LABELS,
      ...(keyof typeof RESOURCE_LABELS)[],
    ]
  ),
  targetId: z.string().nullable(),
  method: z.string(),
  route: z.string(),
  outcome: z.enum(["SUCCESS", "FAILURE"]),
  httpStatus: z.number().int(),
  errorCode: z.string().nullable(),
  durationMs: z.number().nonnegative(),
  decision: z.string().nullable(),
  targetStatus: z.string().nullable(),
  targetRole: z.string().nullable(),
  createdAt: z.string(),
})
export const systemLogPageSchema = z.object({
  items: z.array(systemLogSchema),
  meta: z.object({
    page: z.number(),
    limit: z.number(),
    totalItems: z.number(),
    totalPages: z.number(),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
  }),
})
export type SystemLog = z.infer<typeof systemLogSchema>
export const DECISION_LABELS: Record<string, string> = {
  REMOVE: "Gỡ nội dung",
  DISMISS: "Bỏ qua",
  APPROVE: "Chấp thuận",
  REJECT: "Từ chối",
  RESOLVE: "Giải quyết",
  CLOSE: "Đóng",
}
