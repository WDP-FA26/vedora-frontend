import { z } from "zod"

// Mirrors vedora-api's `/media` and `/posts` responses and `CreatePostDto`.
// Responses are parsed with these, so the types below are checked at runtime.

/** Mirrors the API's `MAX_VIDEO_DURATION_SEC` default. */
export const MAX_VIDEO_DURATION_SEC = 180
export const MAX_POST_LENGTH = 280
/** Mirrors the API's `MAX_POST_MEDIA`. */
export const MAX_POST_MEDIA = 4

export const apiMediaSchema = z.object({
  id: z.string(),
  type: z.enum(["VIDEO", "IMAGE"]),
  status: z.enum(["WAITING_UPLOAD", "PROCESSING", "READY", "FAILED"]),
  failureReason: z
    .enum([
      "TOO_LONG",
      "ENCODING_FAILED",
      "UPLOAD_ERRORED",
      "UPLOAD_CANCELLED",
      "UPLOAD_TIMED_OUT",
      "NO_PLAYBACK_ID",
    ])
    .nullable(),
  playbackId: z.string().nullable(),
  durationSec: z.number().nullable(),
  aspectRatio: z.string().nullable(),
})

export const apiPostSchema = z.object({
  id: z.string(),
  type: z.enum(["POST", "BLOG"]),
  status: z.enum(["PROCESSING", "PUBLISHED", "FAILED"]),
  body: z.string().nullable(),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
  author: z.object({ id: z.string(), username: z.string(), fullName: z.string() }),
  media: z.array(apiMediaSchema),
})

export const postPageSchema = z.object({
  items: z.array(apiPostSchema),
  nextCursor: z.string().nullable(),
})

export const videoUploadSchema = z.object({
  media: apiMediaSchema,
  uploadUrl: z.url(),
})

/** Nest error body; `code` is set on errors the UI handles specifically. */
export const apiErrorSchema = z.object({
  statusCode: z.number(),
  code: z.string().optional(),
  message: z.union([z.string(), z.array(z.string())]),
})

export const postFormSchema = z
  .object({
    body: z.string().max(MAX_POST_LENGTH, `Tối đa ${MAX_POST_LENGTH} ký tự`),
    /** Finished uploads, in display order. */
    mediaIds: z.array(z.string()).max(MAX_POST_MEDIA),
  })
  .refine((values) => values.body.trim() !== "" || values.mediaIds.length > 0, {
    path: ["body"],
    message: "Viết vài dòng hoặc thêm video",
  })

export type ApiMedia = z.infer<typeof apiMediaSchema>
export type ApiPost = z.infer<typeof apiPostSchema>
export type PostPage = z.infer<typeof postPageSchema>
export type VideoUploadTarget = z.infer<typeof videoUploadSchema>
export type PostFormValues = z.infer<typeof postFormSchema>
