import { z } from "zod"

import { presignedUploadSchema } from "@/features/shared/lib/storage-upload"

// Mirrors vedora-api's `/knowledge/documents` responses. Responses are parsed
// with these, so the types below are checked at runtime.

/** Mirrors the API's `MAX_KNOWLEDGE_FILE_MB` default; the API enforces it. */
export const MAX_KNOWLEDGE_FILE_MB = 50
/** A hint for the file picker; the API decides which types it accepts. */
export const KNOWLEDGE_ACCEPT = { "application/pdf": [".pdf"] }

const knowledgeDocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  contentType: z.string(),
  status: z.enum([
    "WAITING_UPLOAD",
    "PROCESSING",
    "AWAITING_REVIEW",
    "INDEXING",
    "READY",
    "REJECTED",
    "FAILED",
  ]),
  failureReason: z
    .enum([
      "UPLOAD_EXPIRED",
      "INVALID_FILE",
      "ENCRYPTED",
      "NO_TEXT",
      "EXTRACTION_FAILED",
      "INDEXING_FAILED",
    ])
    .nullable(),
  sectionCount: z.number().nullable(),
  imageCount: z.number().nullable(),
  sizeBytes: z.number().nullable(),
  reviewedById: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  reviewNote: z.string().nullable(),
  createdAt: z.string(),
})

const knowledgePageSchema = z.object({
  page: z.number(),
  text: z.string(),
  flags: z.array(z.enum(["TEXT_LAYER_ADDED", "PAGE_COUNT_MISMATCH"])),
  edited: z.boolean(),
})

export const knowledgePageListSchema = z.array(knowledgePageSchema)

export const knowledgeFileUrlSchema = z.object({
  url: z.string(),
  expiresAt: z.string(),
})

export const knowledgeDocumentListSchema = z.array(knowledgeDocumentSchema)

export const knowledgeUploadSchema = z.object({
  document: knowledgeDocumentSchema,
  upload: presignedUploadSchema,
})

export { knowledgeDocumentSchema }

export type KnowledgeDocument = z.infer<typeof knowledgeDocumentSchema>
export type KnowledgePage = z.infer<typeof knowledgePageSchema>
