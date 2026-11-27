import { describe, expect, it, vi } from "vitest"
import { defaultDashboardRange } from "@/features/admin/dashboard/dashboard-schema"
import { timestamp } from "@/features/admin/payments/schema"
import { dateTime } from "@/features/billing/schema"
import { sectionForNow } from "@/features/meal-plan/components/meal-log/meal-log-utils"
import { formatPreviewDate, previewStartDate, shiftDate } from "@/features/meal-plan/preview/preview-data"
import { formatPublishedAt, lastDays } from "@/features/post-analytics/lib/date-range"
import { formatJoinDate } from "@/features/profiles/lib/format"
import { formatFormalTimestamp } from "@/features/support/lib/format-formal-time"
import { vietnamDateKey, vietnamDayBoundary, vietnamHour, vietnamYear } from "./date-time"
import { formatPostDate, formatPostDateLong } from "./format"
import { formatRelativeTime } from "./relative-time"

describe("Vietnam dates independently of the machine timezone", () => {
  it.each([
    ["2026-12-31T16:59:59.999Z", "2026-12-31", 2026, 23],
    ["2026-12-31T17:00:00.000Z", "2027-01-01", 2027, 0],
    ["2028-02-28T17:00:00.000Z", "2028-02-29", 2028, 0],
    ["2028-02-29T17:00:00.000Z", "2028-03-01", 2028, 0],
    ["2026-06-01T05:30:00.000Z", "2026-06-01", 2026, 12],
  ])("maps %s to its Vietnam calendar date and clock", (iso, key, year, hour) => {
    const instant = new Date(iso)
    expect(vietnamDateKey(instant)).toBe(key)
    expect(vietnamYear(instant)).toBe(year)
    expect(vietnamHour(instant)).toBe(hour)
    expect(instant.toISOString()).toBe(iso)
  })

  it("serializes inclusive log filter bounds with the correct UTC date", () => {
    expect(vietnamDayBoundary("2027-01-01", "start")).toBe("2026-12-31T17:00:00.000Z")
    expect(vietnamDayBoundary("2027-01-01", "end")).toBe("2027-01-01T16:59:59.999Z")
    expect(vietnamDayBoundary("2028-02-29", "start")).toBe("2028-02-28T17:00:00.000Z")
  })

  it("formats posts, support, profile joins and published dates across New Year", () => {
    const iso = "2026-12-31T17:30:00.000Z"
    expect(formatPostDate(iso)).toContain("1 thg 1")
    expect(formatPostDateLong(iso)).toContain("00:30")
    expect(formatPostDateLong(iso)).toContain("2027")
    expect(formatFormalTimestamp(iso)).toBe("00:30 01/01/2027")
    expect(formatFormalTimestamp("invalid")).toBe("invalid")
    expect(formatJoinDate(iso)).toBe("tháng 1 năm 2027")
    expect(formatPublishedAt(iso)).toBe("01/01/2027")
  })

  it("keeps billing and admin payment timestamps on the same clock", () => {
    const iso = "2026-12-31T17:30:00.000Z"
    expect(dateTime(iso)).toContain("00:30")
    expect(dateTime(iso)).toContain("2027")
    expect(timestamp(iso)).toContain("00:30")
    expect(timestamp(iso)).toContain("2027")
    expect(timestamp(null)).toBe("—")
  })

  it("uses the Vietnam year for old relative dates without changing elapsed time", () => {
    const then = "2026-12-31T17:30:00.000Z"
    expect(formatRelativeTime(then, Date.parse("2027-01-10T00:00:00Z"))).not.toContain("2027")
    expect(formatRelativeTime(then, Date.parse("2027-01-10T00:00:00Z"))).toContain("1 thg 1")
    expect(formatRelativeTime(then, Date.parse("2027-12-31T18:00:00Z"))).toContain("2027")
    expect(formatRelativeTime(then, Date.parse("2026-12-31T18:30:00Z"))).toBe("1 giờ trước")
  })

  it("ends analytics presets on today in Vietnam", () => {
    const now = new Date("2026-12-31T17:30:00Z")
    expect(lastDays(7, now)).toEqual({ from: "2026-12-26", to: "2027-01-01" })
    expect(defaultDashboardRange(now)).toEqual({ from: "2026-12-03", to: "2027-01-01" })
  })

  it("preserves date-only calendar values and chooses the next Vietnam Monday", () => {
    expect(shiftDate("2028-02-28", 1)).toBe("2028-02-29")
    expect(shiftDate("2026-12-31", 1)).toBe("2027-01-01")
    expect(formatPreviewDate("2027-01-01")).toMatch(/^01[/-]01$/)
    expect(previewStartDate(new Date("2026-11-29T17:30:00Z"))).toBe("2026-12-07")
  })

  it("suggests meals using the Vietnam hour instead of the device clock", () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date("2026-12-31T17:30:00Z"))
      expect(sectionForNow()).toBe("BREAKFAST")
      vi.setSystemTime(new Date("2027-01-01T05:30:00Z"))
      expect(sectionForNow()).toBe("LUNCH")
    } finally {
      vi.useRealTimers()
    }
  })
})
