import { z } from "zod"

export const WORK_KINDS = [
  "POST_REVIEW",
  "POST_REPORTS",
  "COMMENT_REPORTS",
  "VERIFICATION",
  "WORKSPACES",
  "SUPPORT",
  "KNOWLEDGE",
] as const
const count = z.number().int().nonnegative()
export const workQueueSchema = z.object({
  generatedAt: z.string(),
  refreshAfterSeconds: z.number().positive(),
  previewLimit: z.number().positive(),
  counts: z.object({
    POST_REVIEW: count,
    POST_REPORTS: count,
    COMMENT_REPORTS: count,
    VERIFICATION: count,
    WORKSPACES: count,
    SUPPORT: count,
    KNOWLEDGE: count,
  }),
  badges: z.object({
    total: count,
    moderation: count,
    verification: count,
    workspaces: count,
    support: count,
    knowledge: count,
  }),
  support: z.object({ appeals: count, assignedToMe: count }),
  items: z.array(
    z.object({
      kind: z.enum(WORK_KINDS),
      id: z.string(),
      title: z.string(),
      createdAt: z.string().nullable(),
      sourceCount: z.number().int().positive(),
    })
  ),
})
export type WorkQueue = z.infer<typeof workQueueSchema>
export type WorkItem = WorkQueue["items"][number]
export type WorkKind = WorkItem["kind"]
export type WorkBadge = keyof WorkQueue["badges"]
