import { z } from "zod"

import { presignedUploadSchema } from "@/features/shared/lib/storage-upload"

// Mirrors vedora-api's `/verification` DTOs. Responses are parsed with these,
// so the types below are checked at runtime.

export const VERIFICATION_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const

export const MAX_PROOFS = 6
export const MAX_PROOF_MB = 10
export const PROOF_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"]
export const MIN_STATEMENT_LENGTH = 20
export const MAX_STATEMENT_LENGTH = 2000
export const MAX_REVIEW_NOTE_LENGTH = 500

/** Tooltip of the verified badge. */
export const PROFESSIONAL_LABEL = "Chuyên gia đã xác minh"

const verificationRequestSchema = z.object({
  id: z.string(),
  statement: z.string(),
  status: z.enum(VERIFICATION_STATUSES),
  reviewNote: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  createdAt: z.string(),
  proofCount: z.number(),
})

export const myVerificationSchema = z.object({
  isProfessional: z.boolean(),
  request: verificationRequestSchema.nullable(),
})

export const proofUploadSchema = z.object({
  id: z.string(),
  upload: presignedUploadSchema,
})

export const submittedRequestSchema = verificationRequestSchema

export const adminVerificationRequestSchema = verificationRequestSchema.extend({
  user: z.object({
    id: z.string(),
    username: z.string(),
    fullName: z.string(),
    email: z.string(),
    avatarUrl: z.string().nullable(),
  }),
})

export const adminVerificationRequestPageSchema = z.object({
  items: z.array(adminVerificationRequestSchema),
  meta: z.object({ hasNextPage: z.boolean() }),
})

export const adminVerificationRequestDetailSchema =
  adminVerificationRequestSchema.extend({
    proofs: z.array(z.object({ id: z.string(), url: z.string() })),
  })

export const verificationFormSchema = z.object({
  statement: z
    .string()
    .trim()
    .min(MIN_STATEMENT_LENGTH, `Viết ít nhất ${MIN_STATEMENT_LENGTH} ký tự`)
    .max(MAX_STATEMENT_LENGTH, `Tối đa ${MAX_STATEMENT_LENGTH} ký tự`),
  proofs: z
    .array(z.object({ file: z.instanceof(File), preview: z.string() }))
    .min(1, "Thêm ít nhất một ảnh minh chứng")
    .max(MAX_PROOFS, `Tối đa ${MAX_PROOFS} ảnh`),
})

export const rejectFormSchema = z.object({
  note: z
    .string()
    .trim()
    .min(1, "Nhập lý do từ chối")
    .max(MAX_REVIEW_NOTE_LENGTH, `Tối đa ${MAX_REVIEW_NOTE_LENGTH} ký tự`),
})

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number]
export type VerificationRequest = z.infer<typeof verificationRequestSchema>
export type MyVerification = z.infer<typeof myVerificationSchema>
export type AdminVerificationRequest = z.infer<typeof adminVerificationRequestSchema>
export type AdminVerificationRequestDetail = z.infer<
  typeof adminVerificationRequestDetailSchema
>
export type VerificationFormValues = z.infer<typeof verificationFormSchema>
export type RejectFormValues = z.infer<typeof rejectFormSchema>
