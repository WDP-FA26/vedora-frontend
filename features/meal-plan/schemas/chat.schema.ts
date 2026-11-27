import { z } from "zod"

import { daySchema } from "@/features/meal-plan/schemas/meal-plan.schema"

export const proposalStatusSchema = z.enum(["staged", "saved", "dismissed"])

export const chatThreadSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  messageCount: z.number(),
  lastMessagePreview: z.string().nullable(),
  lastMessageAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const chatThreadListSchema = z.object({
  items: z.array(chatThreadSummarySchema),
  meta: z.object({
    page: z.number(),
    limit: z.number(),
    totalItems: z.number(),
    totalPages: z.number(),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
  }),
})

export const chatMessageRecordSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  text: z.string(),
  parts: z.array(z.record(z.string(), z.unknown())),
  metadata: z.object({ refused: z.boolean().optional() }).nullable().optional(),
  createdAt: z.string(),
})

export const chatThreadDetailSchema = chatThreadSummarySchema.extend({
  proposalStatuses: z.record(z.string(), proposalStatusSchema),
  messages: z.array(chatMessageRecordSchema),
})

export const chatRewindSchema = z.object({
  text: z.string(),
  weeks: z.array(
    z.object({
      weekStart: z.string(),
      restored: z.array(daySchema),
      skipped: z.array(daySchema),
      droppedDishes: z.number().int().nonnegative(),
    })
  ),
})

export type ChatThreadSummary = z.infer<typeof chatThreadSummarySchema>
export type ChatThreadList = z.infer<typeof chatThreadListSchema>
export type ChatMessageRecord = z.infer<typeof chatMessageRecordSchema>
export type ChatThreadDetail = z.infer<typeof chatThreadDetailSchema>
export type ChatRewind = z.infer<typeof chatRewindSchema>

export type SyncChatMessageInput = {
  id: string
  role: "user" | "assistant"
  text?: string
  parts?: Record<string, unknown>[]
  metadata?: { refused?: boolean } | null
}
