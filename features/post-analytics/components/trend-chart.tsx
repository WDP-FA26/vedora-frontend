"use client"

import { Area, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis, type DotItemDotProps, type TooltipContentProps } from "recharts"

import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { longDate, shortDate } from "../lib/date-range"
import { formatCompact, METRIC_META, numberFormat, type SummaryMetric } from "../lib/metrics"
import type { AnalyticsDay } from "../schemas"

/** Day i of the current period next to day i of the previous one. */
type TrendRow = {
  date: string
  previousDate: string
  current: number | null
  previous: number | null
  /** A value with no value on either side: a line cannot show it, so it gets a dot. */
  isolated: boolean
}

const config = {
  current: { label: "Kỳ này", color: "var(--chart-1)" },
  previous: { label: "Kỳ trước", color: "var(--muted-foreground)" },
} satisfies ChartConfig

const FILL_ID = "analytics-trend-fill"

function isIsolated(days: AnalyticsDay[], index: number, metric: SummaryMetric): boolean {
  if (days[index][metric] === null) return false
  const before = index > 0 ? days[index - 1][metric] : null
  const after = index < days.length - 1 ? days[index + 1][metric] : null
  return before === null && after === null
}

function toRows(days: AnalyticsDay[], previousDays: AnalyticsDay[], metric: SummaryMetric): TrendRow[] {
  const rows: TrendRow[] = []
  days.forEach((day, index) => {
    const previous = previousDays.at(index)
    rows.push({
      date: day.date,
      previousDate: previous?.date ?? "",
      current: day[metric],
      previous: previous === undefined ? null : previous[metric],
      isolated: isIsolated(days, index, metric),
    })
  })
  return rows
}

function valueText(value: number | null): string {
  if (value === null) return "Chưa ghi nhận"
  return numberFormat.format(value)
}

function TooltipRow({ swatch, label, value }: { swatch: string; label: string; value: number | null }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span aria-hidden className={`h-0.5 w-3 rounded-full ${swatch}`} />
        {label}
      </span>
      <span className="font-medium tabular-nums text-foreground">{valueText(value)}</span>
    </div>
  )
}

function TrendTooltip({
  active,
  label,
  rows,
}: Pick<TooltipContentProps<number, string>, "active" | "label"> & { rows: Map<string, TrendRow> }) {
  if (!active || typeof label !== "string") return null
  const row = rows.get(label)
  if (row === undefined) return null
  return (
    <div className="grid min-w-44 gap-1.5 rounded-xl border bg-popover px-3 py-2 text-xs shadow-md">
      <TooltipRow swatch="bg-chart-1" label={longDate(row.date)} value={row.current} />
      {row.previousDate !== "" && (
        <TooltipRow swatch="bg-muted-foreground/60" label={longDate(row.previousDate)} value={row.previous} />
      )}
    </div>
  )
}

function LegendKey({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className={`h-0.5 w-4 rounded-full ${className}`} />
      {children}
    </span>
  )
}

/**
 * The selected metric per day as a line with a soft wash, and the previous
 * period of the same length as a quiet gray line for comparison. Days without
 * data (views before tracking started) leave a gap instead of dropping to 0.
 */
export function TrendChart({
  days,
  previousDays,
  metric,
  previousLabel,
}: {
  days: AnalyticsDay[]
  previousDays: AnalyticsDay[]
  metric: SummaryMetric
  previousLabel: string
}) {
  const { label } = METRIC_META[metric]
  const rows = toRows(days, previousDays, metric)
  const rowsByDate = new Map<string, TrendRow>()
  let hasPrevious = false
  for (const row of rows) {
    rowsByDate.set(row.date, row)
    if (row.previous !== null) hasPrevious = true
  }

  function isolatedDot({ cx, cy, index }: DotItemDotProps) {
    if (cx === undefined || cy === undefined || !rows[index]?.isolated) return <g key={index} />
    return <circle key={index} cx={cx} cy={cy} r={4} fill="var(--color-current)" stroke="var(--card)" strokeWidth={2} />
  }

  return (
    <figure>
      <figcaption className="mb-2 flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <LegendKey className="bg-chart-1">Kỳ này</LegendKey>
        {hasPrevious && <LegendKey className="bg-muted-foreground/60">{previousLabel}</LegendKey>}
      </figcaption>
      <ChartContainer config={config} className="aspect-auto h-60 w-full" aria-label={`Biểu đồ đường ${label.toLowerCase()} theo ngày, so với kỳ trước`}>
        <ComposedChart accessibilityLayer data={rows} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id={FILL_ID} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-current)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--color-current)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={28} tickMargin={8} tickFormatter={(date: string) => shortDate(date)} />
          <YAxis allowDecimals={false} axisLine={false} tickLine={false} width={52} domain={[0, "auto"]} tickCount={4} tickFormatter={(value: number) => formatCompact(value)} />
          <Tooltip
            cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
            content={({ active, label }) => <TrendTooltip active={active} label={label} rows={rowsByDate} />}
          />
          <Line
            dataKey="previous"
            type="monotone"
            stroke="var(--color-previous)"
            strokeOpacity={0.45}
            strokeWidth={1.5}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
          <Area
            dataKey="current"
            type="monotone"
            stroke="var(--color-current)"
            strokeWidth={2}
            fill={`url(#${FILL_ID})`}
            dot={isolatedDot}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
          />
        </ComposedChart>
      </ChartContainer>
    </figure>
  )
}

/** The same numbers as a table, for screen readers and exact values. */
export function TrendTable({ days, previousDays, metric }: { days: AnalyticsDay[]; previousDays: AnalyticsDay[]; metric: SummaryMetric }) {
  const { label } = METRIC_META[metric]
  const rows = toRows(days, previousDays, metric)
  return (
    <table className="w-full text-left text-sm">
      <caption className="sr-only">{label} theo từng ngày so với kỳ trước, giờ Việt Nam</caption>
      <thead>
        <tr className="border-b text-xs text-muted-foreground">
          <th scope="col" className="py-1.5 font-medium">Ngày</th>
          <th scope="col" className="py-1.5 text-right font-medium">Kỳ này</th>
          <th scope="col" className="py-1.5 text-right font-medium">Kỳ trước</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.date} className="border-b last:border-0">
            <th scope="row" className="py-1.5 font-normal text-muted-foreground">{longDate(row.date)}</th>
            <td className="py-1.5 text-right tabular-nums">{valueText(row.current)}</td>
            <td className="py-1.5 text-right text-muted-foreground tabular-nums">{valueText(row.previous)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
