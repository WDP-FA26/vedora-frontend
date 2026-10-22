import { z } from "zod"

const count = z.number().int().nonnegative()
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const dashboardSchema = z.object({
  generatedAt: z.iso.datetime(),
  range: z.object({ from: day, to: day, timeZone: z.literal("Asia/Bangkok"), dayCount: count.min(1).max(90) }),
  snapshot: z.object({
    members: z.object({ total: count, active: count, suspended: count, pendingEmail: count }),
    pendingReports: count,
  }),
  period: z.object({
    newMembers: count,
    publishedContent: z.object({ posts: count, blogs: count, total: count }),
    recipesCreated: count,
    reportsCreated: count,
    reportDecisions: z.object({ resolved: count, dismissed: count, total: count }),
  }),
  daily: z.array(z.object({ date: day, newMembers: count, publishedPosts: count, publishedBlogs: count, reportsCreated: count, resolvedReports: count, dismissedReports: count })).max(90),
  unavailableMetrics: z.array(z.enum(["MODERATION_CASE_SEVERITY", "CONTENT_APPROVALS", "PAYMENT_DEMO"])),
})

export type Dashboard = z.infer<typeof dashboardSchema>
export type DashboardRange = Pick<Dashboard["range"], "from" | "to">

export function defaultDashboardRange(now = new Date()): DashboardRange {
  const to = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(now)
  const from = new Date(Date.parse(`${to}T00:00:00Z`) - 29 * 86_400_000).toISOString().slice(0, 10)
  return { from, to }
}

export function validDashboardRange({ from, to }: DashboardRange): boolean {
  if (![from, to].every((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number(date.slice(0, 4)) > 0)) return false
  const start = Date.parse(`${from}T00:00:00Z`), end = Date.parse(`${to}T00:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false
  if (new Date(start).toISOString().slice(0, 10) !== from || new Date(end).toISOString().slice(0, 10) !== to) return false
  const days = (end - start) / 86_400_000 + 1
  return days >= 1 && days <= 90
}

export function displayDashboardDate(date: string) {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`
}
