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
  author: z.object({
    id: z.string(),
    username: z.string(),
    fullName: z.string(),
    /** Absent on API versions from before profiles. */
    avatarUrl: z.string().nullable().optional(),
  }),
  media: z.array(apiMediaSchema),
  commentCount: z.number(),
  likeCount: z.number(),
  /** Always false for guests. */
  isLiked: z.boolean(),
  repostCount: z.number(),
  isReposted: z.boolean(),
  /** Saved in batches by the API, so a few seconds behind. */
  viewCount: z.number(),
})

export const postPageSchema = z.object({
  items: z.array(apiPostSchema),
  nextCursor: z.string().nullable(),
})

export const videoUploadSchema = z.object({
  media: apiMediaSchema,
  uploadUrl: z.url(),
})

export const postLikeSchema = z.object({
  isLiked: z.boolean(),
  likeCount: z.number(),
})

export const postRepostSchema = z.object({
  isReposted: z.boolean(),
  repostCount: z.number(),
})

export const REPORT_REASONS = [
  "SPAM",
  "HARASSMENT",
  "MISINFORMATION",
  "HARMFUL_ADVICE",
  "INAPPROPRIATE",
  "OTHER",
] as const
/** Mirrors the API's `MAX_REPORT_DETAILS_LENGTH`. */
export const MAX_REPORT_DETAILS_LENGTH = 500

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  SPAM: "Spam hoặc quảng cáo",
  HARASSMENT: "Quấy rối, công kích người khác",
  MISINFORMATION: "Thông tin sai lệch",
  HARMFUL_ADVICE: "Lời khuyên ăn uống, sức khoẻ có thể gây hại",
  INAPPROPRIATE: "Nội dung phản cảm",
  OTHER: "Lý do khác",
}

export const reportFormSchema = z
  .object({
    reason: z.enum(REPORT_REASONS, "Chọn một lý do"),
    details: z
      .string()
      .trim()
      .max(MAX_REPORT_DETAILS_LENGTH, `Tối đa ${MAX_REPORT_DETAILS_LENGTH} ký tự`),
  })
  .refine((values) => values.reason !== "OTHER" || values.details !== "", {
    path: ["details"],
    message: "Mô tả ngắn gọn vấn đề của bài viết",
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
export type ReportReason = (typeof REPORT_REASONS)[number]
export type ReportFormValues = z.infer<typeof reportFormSchema>
export type PostFormValues = z.infer<typeof postFormSchema>
