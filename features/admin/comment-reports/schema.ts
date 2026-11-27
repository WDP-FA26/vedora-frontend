import { z } from "zod"
import { REPORT_REASONS } from "@/features/posts/schemas"

const authorSchema = z.object({
  id: z.string(),
  username: z.string(),
  fullName: z.string(),
  avatarUrl: z.string().nullable(),
})

export const commentReportSchema = z.object({
  id: z.string(),
  postId: z.string(),
  commentId: z.string(),
  reason: z.enum(REPORT_REASONS),
  details: z.string().nullable(),
  status: z.enum(["PENDING", "RESOLVED", "DISMISSED"]),
  createdAt: z.string(),
  reviewedAt: z.string().nullable(),
  reviewedById: z.string().nullable(),
  action: z.enum(["DISMISSED", "REMOVED", "ALREADY_REMOVED"]).nullable(),
  reporter: authorSchema.nullable(),
  postAvailable: z.boolean(),
  reportCount: z.number().int().nonnegative(),
  pendingReportCount: z.number().int().nonnegative(),
  resolvedReportCount: z.number().int().nonnegative(),
  dismissedReportCount: z.number().int().nonnegative(),
  comment: z.object({
    id: z.string(),
    parentId: z.string().nullable(),
    body: z.string(),
    author: authorSchema,
    currentBody: z.string().nullable(),
    isAvailable: z.boolean(),
    isEdited: z.boolean(),
    currentVersion: z.string().nullable(),
    replyCount: z.number().int().nonnegative(),
  }),
})

export const commentReportPageSchema = z.object({
  items: z.array(commentReportSchema),
  meta: z.object({
    page: z.number(),
    totalItems: z.number(),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
  }),
})
export type AdminCommentReport = z.infer<typeof commentReportSchema>
export type CommentReportStatus = AdminCommentReport["status"]
