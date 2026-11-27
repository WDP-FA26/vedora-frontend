import { z } from "zod"

import { postAppealSummarySchema } from "@/features/support/summary-schema"

export const MAX_VIDEO_DURATION_SEC = 180
export const MAX_POST_WORDS = 250
export const MAX_POST_LENGTH = 2000
export const MAX_SEARCH_QUERY_LENGTH = 200

export function countWords(text: string) {
  return text.split(/\s+/).filter(Boolean).length
}
export const MAX_POST_MEDIA = 4
export const MAX_COMMENT_LENGTH = 1000

export const captionTrackSchema = z.object({
  languageCode: z.string(),
  name: z.string(),
  isOriginal: z.boolean(),
  url: z.url(),
})

export const apiMediaSchema = z.object({
  id: z.string(),
  type: z.enum(["VIDEO", "IMAGE"]),
  status: z.enum(["WAITING_UPLOAD", "PROCESSING", "READY", "FAILED"]),
  failureReason: z
    .enum(["TOO_LONG", "ENCODING_FAILED", "UPLOAD_ERRORED", "UPLOAD_TIMED_OUT"])
    .nullable(),
  publicId: z.string(),
  playbackUrl: z.url().nullable(),
  posterUrl: z.url().nullable(),
  durationSec: z.number().nullable(),
  aspectRatio: z.string().nullable(),
  captions: z.array(captionTrackSchema),
})

export const blogSummarySchema = z.object({
  title: z.string(),
  coverImageUrl: z.string().nullable(),
  excerpt: z.string(),
  recipes: z.array(z.object({ id: z.string(), title: z.string(), imageUrl: z.string().nullable() })),
})

export const moderationFindingSchema = z.object({
  field: z.enum(["body", "title", "content", "transcript", "frame", "image"]).optional(),
  quote: z.string().nullable(),
  reason: z.string(),
  reasonText: z.string().nullable().optional(),
  seconds: z.number().nullable().optional(),
})
export type ModerationFinding = z.infer<typeof moderationFindingSchema>

export const contentRejectedDetailsSchema = z.object({
  category: z.string().nullable().optional(),
  reasonText: z.string().nullable().optional(),
  findings: z.array(moderationFindingSchema).optional(),
})

export const apiPostSchema = z.object({
  id: z.string(),
  type: z.enum(["POST", "BLOG"]),
  status: z.enum([
    "DRAFT",
    "PROCESSING",
    "PENDING_REVIEW",
    "PUBLISHED",
    "FAILED",
    "REJECTED",
    "REMOVED",
  ]),
  moderationVerdict: z.string().nullable().optional(),
  moderationReason: z.string().nullable().optional(),
  moderationFindings: z.array(moderationFindingSchema).optional(),
  removalReason: z.string().nullable().optional(),
  appeal: postAppealSummarySchema.nullable().optional(),
  body: z.string().nullable(),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
  author: z.object({
    id: z.string(),
    username: z.string(),
    fullName: z.string(),
    avatarUrl: z.string().nullable().optional(),
    isProfessional: z.boolean().default(false),
  }),
  media: z.array(apiMediaSchema),
  commentCount: z.number(),
  likeCount: z.number(),
  isLiked: z.boolean(),
  repostCount: z.number(),
  isReposted: z.boolean(),
  isBookmarked: z.boolean(),
  viewCount: z.number(),
  blog: blogSummarySchema.nullable().optional(),
})

export const postPageSchema = z.object({
  items: z.array(apiPostSchema),
  nextCursor: z.string().nullable(),
})

export const signedUploadSchema = z.object({
  url: z.url(),
  fields: z.record(z.string(), z.string()),
  chunkSize: z.number(),
})

export const videoUploadSchema = z.object({
  media: apiMediaSchema,
  upload: signedUploadSchema,
})

export const apiCommentAuthorSchema = apiPostSchema.shape.author.extend({
  isSystem: z.boolean().default(false),
})

export const apiCommentSchema = z.object({
  parentId: z.string().nullable().default(null),
  replyToId: z.string().nullable().default(null),
  replyToAuthor: apiCommentAuthorSchema.nullable().default(null),
  replyCount: z.number().int().nonnegative().default(0),
  id: z.string(),
  postId: z.string(),
  body: z.string(),
  author: apiCommentAuthorSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const commentPageSchema = z.object({
  items: z.array(apiCommentSchema),
  nextCursor: z.string().nullable(),
})

export const commentFormSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Viết vài chữ trước khi gửi")
    .max(MAX_COMMENT_LENGTH, `Tối đa ${MAX_COMMENT_LENGTH} ký tự`),
})

export const postLikeSchema = z.object({
  isLiked: z.boolean(),
  likeCount: z.number(),
})

export const postBookmarkSchema = z.object({ isBookmarked: z.boolean() })

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
  "NOT_PLANT_BASED",
  "OTHER",
] as const
export const MAX_REPORT_DETAILS_LENGTH = 500

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  SPAM: "Spam hoặc quảng cáo",
  HARASSMENT: "Quấy rối, công kích người khác",
  MISINFORMATION: "Thông tin sai lệch",
  HARMFUL_ADVICE: "Lời khuyên ăn uống, sức khoẻ có thể gây hại",
  INAPPROPRIATE: "Nội dung phản cảm",
  NOT_PLANT_BASED: "Không phù hợp với lối sống ăn chay, thuần thực vật",
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
    message: "Mô tả ngắn gọn nội dung cần báo cáo",
  })

export const postFormSchema = z
  .object({
    body: z
      .string()
      .max(MAX_POST_LENGTH, `Tối đa ${MAX_POST_LENGTH} ký tự`)
      .refine((body) => countWords(body) <= MAX_POST_WORDS, `Tối đa ${MAX_POST_WORDS} từ`),
    mediaIds: z.array(z.string()).max(MAX_POST_MEDIA),
  })
  .refine((values) => values.body.trim() !== "" || values.mediaIds.length > 0, {
    path: ["body"],
    message: "Viết vài dòng hoặc thêm video",
  })

export type ApiMedia = z.infer<typeof apiMediaSchema>
export type CaptionTrack = z.infer<typeof captionTrackSchema>
export type ApiPost = z.infer<typeof apiPostSchema>
export type BlogSummary = z.infer<typeof blogSummarySchema>
export type PostPage = z.infer<typeof postPageSchema>
export type VideoUploadTarget = z.infer<typeof videoUploadSchema>
export type ApiComment = z.infer<typeof apiCommentSchema>
export type CommentPage = z.infer<typeof commentPageSchema>
export type CommentFormValues = z.infer<typeof commentFormSchema>
export type ReportReason = (typeof REPORT_REASONS)[number]
export type ReportFormValues = z.infer<typeof reportFormSchema>
export type PostFormValues = z.infer<typeof postFormSchema>
