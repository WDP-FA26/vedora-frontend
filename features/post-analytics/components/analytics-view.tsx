"use client"

import { useState, type KeyboardEvent } from "react"
import { CircleAlertIcon, InfoIcon, TableIcon } from "lucide-react"
import { cn } from "cn"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { useAnalyticsSummary } from "../hooks/use-post-analytics"
import { lastDays, longDate, shortDate } from "../lib/date-range"
import { DEFAULT_METRIC, formatCompact, METRIC_META, numberFormat, SUMMARY_METRICS, type SummaryMetric } from "../lib/metrics"
import { RANGE_PRESETS, type RangePreset } from "../post-analytics-cache"
import type { AnalyticsSummary } from "../schemas"
import { AnalyticsPosts } from "./analytics-posts"
import { TrendChart, TrendTable } from "./trend-chart"

/** A calm, sign-only comparison: no colors or arrows that reward or scold. */
function changeText(current: number, previous: number): string {
  const difference = current - previous
  if (difference === 0) return "Bằng kỳ trước"
  if (difference > 0) return `+${formatCompact(difference)} so với kỳ trước`
  return `−${formatCompact(-difference)} so với kỳ trước`
}

function tabNote(summary: AnalyticsSummary, metric: SummaryMetric): string {
  const { current, previous, viewsTrackedSince } = summary
  if (metric === "views" && !current.viewsComplete) {
    if (viewsTrackedSince === null) return "Chưa có dữ liệu theo ngày"
    return `Ghi nhận từ ${shortDate(viewsTrackedSince)}`
  }
  if (metric === "views" && !previous.viewsComplete) return "Kỳ trước chưa đủ dữ liệu"
  return changeText(current[metric], previous[metric])
}

function hasAnyActivity(summary: AnalyticsSummary, metric: SummaryMetric): boolean {
  for (const day of [...summary.daily, ...summary.previousDaily]) {
    const value = day[metric]
    if (value !== null && value > 0) return true
  }
  return false
}

function RangePicker({ value, onChange }: { value: RangePreset; onChange: (next: RangePreset) => void }) {
  return (
    <div role="radiogroup" aria-label="Khoảng thời gian" className="flex rounded-full bg-muted p-0.5 text-xs font-medium">
      {RANGE_PRESETS.map((preset) => {
        const selected = preset === value
        return (
          <button
            key={preset}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(preset)}
            className={cn(
              "rounded-full px-3 py-1.5 transition-colors focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none",
              selected ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {preset} ngày
          </button>
        )
      })}
    </div>
  )
}

function SnapshotStrip({ summary }: { summary: AnalyticsSummary }) {
  const items = [
    { label: "Người theo dõi", value: summary.snapshot.followers },
    { label: "Bài đang công khai", value: summary.snapshot.publishedPosts },
    { label: "Lượt xem trọn đời", value: summary.snapshot.lifetimeViews },
  ]
  return (
    <dl className="grid grid-cols-3 divide-x rounded-2xl border bg-card">
      {items.map((item) => (
        <div key={item.label} className="px-3 py-2.5 text-center">
          <dt className="text-[0.7rem] text-muted-foreground">{item.label}</dt>
          <dd className="text-base font-semibold tabular-nums" title={numberFormat.format(item.value)}>
            {formatCompact(item.value)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function MetricTab({
  summary,
  metric,
  selected,
  onSelect,
  onKeyDown,
}: {
  summary: AnalyticsSummary
  metric: SummaryMetric
  selected: boolean
  onSelect: () => void
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
}) {
  const { label, icon: Icon } = METRIC_META[metric]
  return (
    <button
      type="button"
      role="tab"
      id={`analytics-tab-${metric}`}
      aria-selected={selected}
      aria-controls="analytics-trend-panel"
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className={cn(
        "relative flex min-w-0 flex-col items-start gap-0.5 px-3 pt-3 pb-3 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none focus-visible:ring-inset",
        selected ? "bg-card" : "bg-background text-muted-foreground hover:bg-accent/50"
      )}
    >
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-0.5", selected ? "bg-primary" : "bg-transparent")} />
      <span className="flex min-w-0 items-center gap-1.5 text-xs">
        <Icon aria-hidden className="size-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      <span
        title={numberFormat.format(summary.current[metric])}
        className={cn("max-w-full truncate text-xl font-semibold tabular-nums sm:text-2xl", selected && "text-foreground")}
      >
        {formatCompact(summary.current[metric])}
      </span>
      <span className="text-[0.7rem] leading-tight text-muted-foreground">{tabNote(summary, metric)}</span>
    </button>
  )
}

function OverviewCard({ summary }: { summary: AnalyticsSummary }) {
  const [metric, setMetric] = useState<SummaryMetric>(DEFAULT_METRIC)
  const { label, description } = METRIC_META[metric]
  const previousLabel = `${shortDate(summary.previousRange.from)} – ${shortDate(summary.previousRange.to)}`
  const trackedSince = summary.viewsTrackedSince
  const showViewsGap = metric === "views" && !summary.current.viewsComplete

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>) {
    const index = SUMMARY_METRICS.indexOf(metric)
    let next = index
    if (event.key === "ArrowRight") next = (index + 1) % SUMMARY_METRICS.length
    if (event.key === "ArrowLeft") next = (index - 1 + SUMMARY_METRICS.length) % SUMMARY_METRICS.length
    if (next === index) return
    event.preventDefault()
    const nextMetric = SUMMARY_METRICS[next]
    setMetric(nextMetric)
    document.getElementById(`analytics-tab-${nextMetric}`)?.focus()
  }

  return (
    <section aria-label="Tổng quan" className="overflow-hidden rounded-2xl border bg-card">
      <div role="tablist" aria-label="Chỉ số" className="grid grid-cols-2 gap-px border-b bg-border min-[360px]:grid-cols-3 sm:grid-cols-6">
        {SUMMARY_METRICS.map((item) => (
          <MetricTab
            key={item}
            summary={summary}
            metric={item}
            selected={item === metric}
            onSelect={() => setMetric(item)}
            onKeyDown={moveFocus}
          />
        ))}
      </div>

      <div role="tabpanel" id="analytics-trend-panel" aria-labelledby={`analytics-tab-${metric}`} className="p-4 sm:p-5">
        <div className="mb-3">
          <h2 className="font-semibold">{label} theo ngày</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>

        {showViewsGap && trackedSince !== null && (
          <p className="mb-3 flex items-start gap-1.5 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            <InfoIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            Lượt xem theo ngày được ghi nhận từ {longDate(trackedSince)}. Những ngày trước đó để trống, không phải 0.
          </p>
        )}

        {hasAnyActivity(summary, metric) ? (
          <TrendChart days={summary.daily} previousDays={summary.previousDaily} metric={metric} previousLabel={`Kỳ trước (${previousLabel})`} />
        ) : (
          <div className="flex h-60 flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-center">
            <p className="text-sm font-medium">Chưa có {label.toLowerCase()} trong khoảng này</p>
            <p className="max-w-xs text-sm text-muted-foreground">Không sao cả, cứ nấu và chia sẻ theo nhịp của bạn.</p>
          </div>
        )}

        <details className="group mt-4 text-sm">
          <summary className="flex w-fit cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
            <TableIcon aria-hidden className="size-3.5" />
            Xem bảng số liệu
          </summary>
          <div className="mt-2 max-h-72 overflow-y-auto rounded-xl border px-3">
            <TrendTable days={summary.daily} previousDays={summary.previousDaily} metric={metric} />
          </div>
        </details>
      </div>
    </section>
  )
}

function SummarySection({ days }: { days: RangePreset }) {
  const { data, error, isLoading } = useAnalyticsSummary(lastDays(days))

  if (error) {
    return (
      <Alert variant="destructive">
        <CircleAlertIcon aria-hidden />
        <AlertDescription>Không tải được số liệu. Thử tải lại trang nhé.</AlertDescription>
      </Alert>
    )
  }
  if (isLoading || !data) {
    return (
      <div role="status" aria-label="Đang tải số liệu" className="space-y-4">
        <Skeleton className="h-14" />
        <Skeleton className="h-96" />
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <SnapshotStrip summary={data} />
      <OverviewCard summary={data} />
      <p className="px-1 text-xs leading-relaxed text-muted-foreground">
        {longDate(data.range.from)} – {longDate(data.range.to)}, giờ Việt Nam (UTC+7). Chỉ tính tương tác của người khác trên bài
        đang công khai và những lượt còn giữ: ai đó bỏ Thích hay bỏ lưu thì lượt đó không còn được tính.
      </p>
    </div>
  )
}

/** "Thống kê": the signed-in author's own post analytics. Only they can see it. */
export function AnalyticsView({ initialDays }: { initialDays: RangePreset }) {
  const [days, setDays] = useState(initialDays)

  function changeDays(next: RangePreset) {
    setDays(next)
    // Keeps the range across reloads without a server round trip.
    window.history.replaceState(null, "", `?days=${next}`)
  }

  return (
    <div className="pb-10">
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/85 px-4 py-2.5 backdrop-blur-md sm:px-5">
        <div>
          <h1 className="text-lg font-bold">Thống kê</h1>
          <p className="text-sm text-muted-foreground">Chỉ mình bạn thấy những số liệu này.</p>
        </div>
        <RangePicker value={days} onChange={changeDays} />
      </header>

      <div className="space-y-6 px-4 pt-4 sm:px-5">
        <SummarySection key={`summary-${days}`} days={days} />
        <AnalyticsPosts key={`posts-${days}`} range={lastDays(days)} />
      </div>
    </div>
  )
}
