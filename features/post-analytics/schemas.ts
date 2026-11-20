import { z } from "zod"

const count = z.number().int().nonnegative()
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const rangeSchema = z.object({
  from: day,
  to: day,
  timeZone: z.literal("Asia/Bangkok"),
  dayCount: count.min(1).max(90),
})

const totalsSchema = z.object({
  views: count,
  viewsComplete: z.boolean(),
  likes: count,
  comments: count,
  reposts: count,
  saves: count,
  newFollowers: count,
  publishedPosts: count,
})

const daySchema = z.object({
  date: day,
  views: count.nullable(),
  likes: count,
  comments: count,
  reposts: count,
  saves: count,
  newFollowers: count,
  publishedPosts: count,
})

export const analyticsSummarySchema = z.object({
  generatedAt: z.iso.datetime(),
  range: rangeSchema,
  previousRange: z.object({ from: day, to: day }),
  viewsTrackedSince: day.nullable(),
  snapshot: z.object({ followers: count, publishedPosts: count, lifetimeViews: count }),
  current: totalsSchema,
  previous: totalsSchema,
  daily: z.array(daySchema).max(90),
  previousDaily: z.array(daySchema).max(90),
})

export const analyticsPostSchema = z.object({
  id: z.string(),
  type: z.enum(["POST", "BLOG"]),
  title: z.string().nullable(),
  publishedAt: z.iso.datetime().nullable(),
  lifetimeViews: count,
  period: z.object({ views: count, likes: count, comments: count, reposts: count, saves: count }),
})

export const analyticsPostPageSchema = z.object({
  items: z.array(analyticsPostSchema),
  meta: z.object({
    page: count.min(1),
    limit: count.min(1),
    totalItems: count,
    totalPages: count,
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
  }),
  range: rangeSchema,
})

export type AnalyticsSummary = z.infer<typeof analyticsSummarySchema>
export type AnalyticsTotals = AnalyticsSummary["current"]
export type AnalyticsDay = AnalyticsSummary["daily"][number]
export type AnalyticsPost = z.infer<typeof analyticsPostSchema>
export type AnalyticsPostPage = z.infer<typeof analyticsPostPageSchema>
