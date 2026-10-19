import { z } from "zod"

import { apiMediaSchema, REPORT_REASONS } from "@/features/posts/schemas"

export type { CaptionTrack } from "@/features/posts/schemas"

// Mirrors vedora-api's `GET /users`, `/admin/posts` and `/admin/reports` (admin only): rows in
// a page-based `PaginatedResponseDto`.

const adminUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  fullName: z.string(),
  email: z.string(),
  role: z.enum(["USER", "ADMIN"]),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const adminUserPageSchema = z.object({
  items: z.array(adminUserSchema),
  meta: z.object({ hasNextPage: z.boolean() }),
})

export const CAPTION_STATUSES = ["NONE", "TRANSCRIBING", "READY", "NO_SPEECH", "FAILED"] as const

const adminMediaSchema = apiMediaSchema.extend({
  captionStatus: z.enum(CAPTION_STATUSES),
  /** Spoken language Whisper detected, e.g. `vi`. */
  captionLanguage: z.string().nullable(),
})

const adminPostSchema = z.object({
  id: z.string(),
  type: z.enum(["POST", "BLOG"]),
  status: z.enum(["PROCESSING", "PUBLISHED", "FAILED"]),
  body: z.string().nullable(),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
  author: z.object({
    id: z.string(),
    username: z.string(),
    fullName: z.string(),
    avatarUrl: z.string().nullable(),
  }),
  media: z.array(adminMediaSchema),
  commentCount: z.number(),
  likeCount: z.number(),
  repostCount: z.number(),
  viewCount: z.number(),
})

export const adminPostPageSchema = z.object({
  items: z.array(adminPostSchema),
  meta: z.object({ hasNextPage: z.boolean() }),
})

/** One post; its media already carries the caption tracks. */
export const adminPostDetailSchema = adminPostSchema

const reportUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  fullName: z.string(),
  avatarUrl: z.string().nullable(),
})

export const adminReportSchema = z.object({
  id: z.string(),
  postId: z.string(),
  reason: z.enum(REPORT_REASONS),
  details: z.string().nullable(),
  status: z.enum(["PENDING", "RESOLVED", "DISMISSED"]),
  createdAt: z.string(),
  reviewedAt: z.string().nullable(),
  reporter: reportUserSchema,
  post: z.object({
    id: z.string(),
    body: z.string().nullable(),
    author: reportUserSchema,
  }),
})

export const adminReportPageSchema = z.object({
  items: z.array(adminReportSchema),
  meta: z.object({ hasNextPage: z.boolean() }),
})

export type AdminReport = z.infer<typeof adminReportSchema>
export type AdminUser = z.infer<typeof adminUserSchema>
export type CaptionStatus = (typeof CAPTION_STATUSES)[number]
export type AdminPost = z.infer<typeof adminPostSchema>
export type AdminPostDetail = z.infer<typeof adminPostDetailSchema>
export type AdminMediaDetail = AdminPostDetail["media"][number]
