import type { Metadata } from "next"

import { AnalyticsView } from "@/features/post-analytics/components/analytics-view"
import { DEFAULT_RANGE_PRESET, RANGE_PRESETS } from "@/features/post-analytics/post-analytics-cache"

export const metadata: Metadata = {
  title: "Thống kê · Vedora",
}

export default async function AnalyticsPage({ searchParams }: PageProps<"/home/analytics">) {
  const { days } = await searchParams
  const preset = RANGE_PRESETS.find((value) => String(value) === days)
  return <AnalyticsView initialDays={preset ?? DEFAULT_RANGE_PRESET} />
}
