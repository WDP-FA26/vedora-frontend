import { APP_TIME_ZONE, vietnamDateKey } from "@/features/shared/lib/date-time"

import type { DateRange } from "../post-analytics-cache"

const DAY_MS = 86_400_000

export function lastDays(days: number, now = new Date()): DateRange {
  const to = vietnamDateKey(now)
  const from = new Date(Date.parse(`${to}T00:00:00Z`) - (days - 1) * DAY_MS)
    .toISOString()
    .slice(0, 10)
  return { from, to }
}

export function shortDate(day: string): string {
  return `${day.slice(8, 10)}/${day.slice(5, 7)}`
}

export function longDate(day: string): string {
  return `${shortDate(day)}/${day.slice(0, 4)}`
}

const publishedFormat = new Intl.DateTimeFormat("vi-VN", {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

export function formatPublishedAt(iso: string): string {
  return publishedFormat.format(new Date(iso))
}
