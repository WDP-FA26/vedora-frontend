import { z } from "zod"

import { signedUploadSchema } from "@/features/posts/schemas"
import { presignedUploadSchema } from "@/features/shared/lib/storage-upload"

// Mirrors vedora-api's `/blogs` responses and DTOs (docs/docs-for-FE/blogs.md).

export const MAX_BLOG_TITLE_LENGTH = 150
export const MAX_BLOG_CONTENT_LENGTH = 50_000
export const MAX_BLOG_IMAGE_MB = 5
export const MAX_BLOG_VIDEO_MB = 100
export const BLOG_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const

const blogStatusSchema = z.enum(["DRAFT", "PUBLISHED"])

export const apiBlogSchema = z.object({
  id: z.string(),
  status: blogStatusSchema,
  content: z.string(),
  updatedAt: z.string(),
  blog: z.object({
    title: z.string(),
    coverImageUrl: z.string().nullable(),
    excerpt: z.string(),
  }),
})

/** The fields the "my blogs" list needs; the API answers with posts that have no `content`. */
export const blogListItemSchema = apiBlogSchema.omit({ content: true, updatedAt: true }).extend({
  createdAt: z.string(),
})

export const blogPageSchema = z.object({
  items: z.array(blogListItemSchema),
  nextCursor: z.string().nullable(),
})

export const blogImageUploadSchema = z.object({
  upload: presignedUploadSchema,
  /** Permanent public URL of the image once uploaded. */
  url: z.string(),
})

export const blogVideoUploadSchema = z.object({
  upload: signedUploadSchema,
  /** Public MP4 URL once uploaded. */
  url: z.string(),
})

export type ApiBlog = z.infer<typeof apiBlogSchema>
export type BlogStatus = z.infer<typeof blogStatusSchema>
