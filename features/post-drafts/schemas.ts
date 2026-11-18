import { z } from "zod"
import { apiMediaSchema, signedUploadSchema } from "@/features/posts/schemas"

export const postDraftSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["POST", "VIDEO"]),
  body: z.string(),
  title: z.string(),
  description: z.string(),
  version: z.number().int().nonnegative(),
  updatedAt: z.string(),
  media: z.array(apiMediaSchema),
})
export const postDraftPageSchema = z.object({ items: z.array(postDraftSchema) })
export const draftUploadSchema = z.object({
  draft: postDraftSchema,
  media: apiMediaSchema,
  upload: signedUploadSchema.nullable(),
})
export type PostDraft = z.infer<typeof postDraftSchema>
export type DraftKind = PostDraft["kind"]
export const POST_DRAFTS_PATH = "/home/drafts"
export const postDraftPath = (id: string) => `${POST_DRAFTS_PATH}/${encodeURIComponent(id)}`
