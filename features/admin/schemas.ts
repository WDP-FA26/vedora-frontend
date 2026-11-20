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
  /** Approximate region [x0, y0, x1, y1] scaled 0-1000. */
  box: z.array(z.number()).length(4).nullable(),
})

/** Mirrors `moderation.evidence`: which parts the explainer model says break the policy. */
const evidenceSchema = z.object({
  status: z.enum(["READY", "FAILED", "REFUSED"]),
  /** The reviewer model's call; absent on records from before it decided anything. */
  decision: z
    .enum(["accept", "reject", "escalate"])
    .nullish()
    .transform((decision) => decision ?? null),
  category: z
    .string()
    .nullish()
    .transform((category) => category ?? null),
  summary: z.string().nullable(),
  items: z.array(evidenceItemSchema),
  dropped: z.number().int().nonnegative(),
  model: z.string(),
  createdAt: z.string(),
})

export const ROUTE_RULES = [
  "PROVIDER_BLOCKED",
  "MANIPULATION",
  "REVIEWER_UNAVAILABLE",
  "REVIEWER_REJECT",
  "UNVERIFIED_REJECT",
  "REVIEWER_ESCALATE",
  "REVIEWER_ACCEPT",
] as const

/** Mirrors `moderation.route`: where the router sent a flagged post, and who applied it. */
const routeSchema = z.object({
  outcome: z.enum(["PUBLISH", "REJECT", "ADMIN"]),
  rule: z.enum(ROUTE_RULES),
  category: z.string().nullable(),
  /** Null when it was only recorded (shadow mode, or a rerun on a decided post). */
  appliedBy: z.enum(["SYSTEM_ONE", "SYSTEM_TWO"]).nullable(),
  decidedAt: z.string(),
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
  /** The automated content check; `scores` is Jev's chance for each category. */
  moderation: z
    .object({
      verdict: z.string(),
      violationScore: z.number().nullable(),
      scores: z.record(z.string(), z.number()).nullable(),
      checkedAt: z.string(),
      reviewedById: z.string().nullable(),
      reviewedAt: z.string().nullable(),
      reviewNote: z.string().nullable(),
      /** Null until the explainer ran; absent from APIs that predate it. */
      evidence: evidenceSchema.nullish().transform((evidence) => evidence ?? null),
      route: routeSchema.nullish().transform((route) => route ?? null),
      heldAt: z
        .string()
        .nullish()
        .transform((heldAt) => heldAt ?? null),
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
export type ModerationRoute = z.infer<typeof routeSchema>

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
  rejectThreshold: z.number(),
  reviewThreshold: z.number(),
  /** A `manipulation` chance at or above this is rejected outright; absent from APIs that predate it. */
  manipulationThreshold: z.number().min(0).max(1).optional(),
  /** True when the API enforces that rule (MODERATION_MODE=enforce); otherwise it is only recorded. */
  manipulationEnforced: z.boolean().default(false),
  /** 0 while the built-in defaults are in force. */
  version: z.number().int().nonnegative(),
  updatedAt: z.string().nullable(),
  updatedById: z.string().nullable(),
  isDefault: z.boolean(),
})

export const moderationTestResultSchema = z.object({
  decision: z.enum(["publish", "review", "reject"]),
  category: z.string().nullable(),
  violationScore: z.number(),
  scores: z.record(z.string(), z.number()).nullable(),
})

export type ModerationChoice = z.infer<typeof moderationChoiceSchema>
export type ModerationSettings = z.infer<typeof moderationSettingsSchema>
/** The part of the settings an admin edits and the test endpoint accepts. */
export type ModerationPolicyDraft = Pick<
  ModerationSettings,
  "instructions" | "allowDescription" | "choices" | "rejectThreshold" | "reviewThreshold" | "manipulationThreshold"
>
export type ModerationTestResult = z.infer<typeof moderationTestResultSchema>
