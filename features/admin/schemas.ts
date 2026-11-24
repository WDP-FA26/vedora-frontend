import { z } from "zod"

import { apiMediaSchema, REPORT_REASONS } from "@/features/posts/schemas"

export type { CaptionTrack } from "@/features/posts/schemas"

// Mirrors vedora-api's `GET /users`, `/admin/posts` and `/admin/reports` (admin only): rows in
// a page-based `PaginatedResponseDto`.

export const ACCOUNT_STATUSES = ["PENDING_EMAIL", "ACTIVE", "SUSPENDED", "DELETED"] as const

export const adminUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  fullName: z.string(),
  email: z.string(),
  role: z.enum(["USER", "ADMIN"]),
  status: z.enum(ACCOUNT_STATUSES),
  /** Goes up by one with every role or status change; those updates must send it back. */
  accountVersion: z.number().int().nonnegative(),
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

export const EVIDENCE_FIELDS = ["body", "title", "content", "transcript", "frame", "image"] as const

const evidenceItemSchema = z.object({
  field: z.enum(EVIDENCE_FIELDS),
  /** Policy category the explainer picked; informational, may differ from the verdict. */
  category: z.string(),
  reason: z.string(),
  /** Exact words for text fields; for frames and images, text the model read (may be off). */
  quote: z.string().nullable(),
  /** Offsets in the NFC-normalized field, text fields only. */
  start: z.number().int().nullable(),
  end: z.number().int().nullable(),
  mediaId: z.string().nullable(),
  seconds: z.number().nullable(),
  imageUrl: z.string().nullable(),
})

/**
 * Mirrors `moderation.evidence`: which parts of the post the model says break the
 * policy. Written together with the verdict. Records from older APIs may still
 * carry `decision`/`category`; they are ignored.
 */
const evidenceSchema = z.object({
  /** READY: quotes below. FAILED / REFUSED: no explanation, an admin decides by hand. */
  status: z.enum(["READY", "FAILED", "REFUSED"]),
  summary: z.string().nullable(),
  items: z.array(evidenceItemSchema),
  dropped: z.number().int().nonnegative(),
  model: z.string(),
  createdAt: z.string(),
})

const adminPostRemovalSchema = z.object({
  removedById: z.string(),
  removedByRole: z.enum(["ADMIN", "AUTHOR"]),
  removedAt: z.string(),
  previousStatus: z.enum([
    "DRAFT",
    "PROCESSING",
    "PENDING_REVIEW",
    "PUBLISHED",
    "FAILED",
    "REJECTED",
    "REMOVED",
  ]),
  reason: z.string().nullable(),
  restoredById: z.string().nullable(),
  restoredAt: z.string().nullable(),
})

const adminPostSchema = z.object({
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
  body: z.string().nullable(),
  blog: z
    .object({ title: z.string(), coverImageUrl: z.string().nullable(), excerpt: z.string() })
    .nullable(),
  /** The automated content check: one model call that rates the post's risk. */
  moderation: z
    .object({
      /** `allow`, a policy category key, `provider_blocked` or `moderation_failed`. */
      verdict: z.string(),
      /** Null for unrated and legacy posts, which may omit it. */
      riskLevel: z
        .number()
        .int()
        .min(0)
        .max(3)
        .nullish()
        .transform((riskLevel) => riskLevel ?? null),
      checkedAt: z.string(),
      reviewedById: z.string().nullable(),
      reviewedAt: z.string().nullable(),
      reviewNote: z.string().nullable(),
      evidence: evidenceSchema.nullish().transform((evidence) => evidence ?? null),
    })
    .nullable(),
  removal: adminPostRemovalSchema.nullish().transform((removal) => removal ?? null),
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
  evidence: z
    .array(
      z.object({ id: z.string(), url: z.string(), contentType: z.string(), sizeBytes: z.number() })
    )
    .default([]),
  reportCount: z.number().int().nonnegative().optional(),
  pendingReportCount: z.number().int().nonnegative().optional(),
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
export type ModerationEvidence = z.infer<typeof evidenceSchema>
export type EvidenceItem = ModerationEvidence["items"][number]

const moderationChoiceSchema = z.object({
  key: z.string(),
  label: z.string(),
  reasonText: z.string(),
  description: z.string(),
})

/** Mirrors `GET /admin/moderation/settings`: the content policy admins edit. */
export const moderationSettingsSchema = z.object({
  instructions: z.string(),
  allowDescription: z.string(),
  choices: z.array(moderationChoiceSchema),
  /** 0 while the built-in defaults are in force. */
  version: z.number().int().nonnegative(),
  updatedAt: z.string().nullable(),
  updatedById: z.string().nullable(),
  isDefault: z.boolean(),
})

export const moderationTestResultSchema = z.object({
  decision: z.enum(["publish", "review", "reject"]),
  category: z.string().nullable(),
  riskLevel: z.number().int().min(0).max(3).nullable(),
  summary: z.string().nullable(),
})

export type ModerationChoice = z.infer<typeof moderationChoiceSchema>
export type ModerationSettings = z.infer<typeof moderationSettingsSchema>
/** The part of the settings an admin edits and the test endpoint accepts. */
export type ModerationPolicyDraft = Pick<
  ModerationSettings,
  "instructions" | "allowDescription" | "choices"
>
export type ModerationTestResult = z.infer<typeof moderationTestResultSchema>
