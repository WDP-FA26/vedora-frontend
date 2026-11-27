import { z } from "zod"

import { postAppealSummarySchema } from "@/features/support/summary-schema"
import { moderationFindingSchema, signedUploadSchema } from "@/features/posts/schemas"
import { presignedUploadSchema } from "@/features/shared/lib/storage-upload"

export const MAX_BLOG_TITLE_LENGTH = 150
export const MAX_BLOG_CONTENT_LENGTH = 50_000
export const MAX_BLOG_IMAGE_MB = 5
export const MAX_BLOG_VIDEO_MB = 100
export const BLOG_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const

const blogStatusSchema = z.enum([
  "DRAFT",
  "PROCESSING",
  "PENDING_REVIEW",
  "PUBLISHED",
  "FAILED",
  "REJECTED",
  "REMOVED",
])

export const apiBlogSchema = z.object({
  id: z.string(),
  status: blogStatusSchema,
  moderationVerdict: z.string().nullable().optional(),
  moderationReason: z.string().nullable().optional(),
  moderationFindings: z.array(moderationFindingSchema).optional(),
  removalReason: z.string().nullable().optional(),
  appeal: postAppealSummarySchema.nullable().optional(),
  content: z.string(),
  updatedAt: z.string(),
  blog: z.object({
    title: z.string(),
    coverImageUrl: z.string().nullable(),
    excerpt: z.string(),
  }),
})

export const blogListItemSchema = apiBlogSchema.omit({ content: true, updatedAt: true }).extend({
  createdAt: z.string(),
})

export const blogPageSchema = z.object({
  items: z.array(blogListItemSchema),
  nextCursor: z.string().nullable(),
})

export const blogImageUploadSchema = z.object({
  upload: presignedUploadSchema,
  url: z.string(),
})

export const blogVideoUploadSchema = z.object({
  upload: signedUploadSchema,
  url: z.string(),
})

export type ApiBlog = z.infer<typeof apiBlogSchema>
export type BlogStatus = z.infer<typeof blogStatusSchema>
