import { z } from "zod"

// Mirrors vedora-api's `/knowledge/documents` responses. Responses are parsed
// with these, so the types below are checked at runtime.

/** Mirrors the API's `MAX_KNOWLEDGE_FILE_MB` default; the API enforces it. */
export const MAX_KNOWLEDGE_FILE_MB = 50
/** A hint for the file picker; the API decides which types it accepts. */
export const KNOWLEDGE_ACCEPT = ".pdf,application/pdf"

export const knowledgeDocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  contentType: z.string(),
  status: z.enum(["WAITING_UPLOAD", "PROCESSING", "READY", "FAILED"]),
  failureReason: z
    .enum([
      "UPLOAD_EXPIRED",
      "INVALID_FILE",
      "ENCRYPTED",
      "NO_TEXT",
      "UNSUPPORTED_TYPE",
      "EXTRACTION_FAILED",
      "INDEXING_FAILED",
    ])
    .nullable(),
  sectionCount: z.number().nullable(),
  imageCount: z.number().nullable(),
  sizeBytes: z.number().nullable(),
  createdAt: z.string(),
})

export const knowledgeDocumentListSchema = z.array(knowledgeDocumentSchema)

export const knowledgeUploadSchema = z.object({
  document: knowledgeDocumentSchema,
  pathname: z.string(),
  clientToken: z.string(),
})

export type KnowledgeDocument = z.infer<typeof knowledgeDocumentSchema>
