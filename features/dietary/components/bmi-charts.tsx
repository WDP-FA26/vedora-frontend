"use client"

import { useState, type FormEvent } from "react"
import {
  ScaleIcon,
  SparklesIcon,
  TrendingDownIcon,
  TrendingUpIcon,
} from "lucide-react"
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/features/auth/hooks/use-auth"
import {
  BMI_CATEGORY_META,
  BODY_FEELING_LABELS,
  NUTRITION_GOALS,
  NUTRITION_GOAL_LABELS,
  checkInWeight,
  saveMyNutrition,
  type BodyFeeling,
  type BodyMetricLog,
  type NutritionGoal,
  type NutritionProfile,
} from "@/features/dietary/dietary"
import { ApiError } from "@/features/shared/lib/api-client"
import { cn } from "@/lib/utils"

function formatShortDate(date: string): string {
  const parts = date.split("-")
  if (parts.length !== 3) return date
  return `${Number(parts[2])}/${Number(parts[1])}`
}

function formatLongDate(date: string): string {
  const parts = date.split("-")
  if (parts.length !== 3) return date
  return `${Number(parts[2])}/${Number(parts[1])}/${parts[0]}`
}

function bmiPercentPosition(bmi: number): number {
  const min = 14
  const max = 30
  return Math.min(98, Math.max(2, ((bmi - min) / (max - min)) * 100))
}

/**
 * Chart 1: Asian WPRO BMI spectrum bar.
 */
export function AsianBmiSpectrumBar({
  profile,
  compact = false,
}: {
  profile: NutritionProfile
  compact?: boolean
}) {
  const { bmi, bmiCategory, effectiveGoal, idealWeightMinKg, idealWeightMaxKg } = profile

  if (bmi === null || bmiCategory === null) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
        Nhập chiều cao và cân nặng để xem chỉ số BMI chuẩn Châu Á và mức năng lượng gợi ý hằng ngày.
      </div>
    )
  }

  const meta = BMI_CATEGORY_META[bmiCategory]
  const goalInfo = effectiveGoal ? NUTRITION_GOAL_LABELS[effectiveGoal] : null
  const position = bmiPercentPosition(bmi)

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-heading text-lg font-bold tabular-nums">
            BMI {bmi.toFixed(1)}
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              meta.toneClass
            )}
          >
            {meta.label}
          </span>
          {goalInfo && <Badge variant="outline">Mục tiêu: {goalInfo.shortLabel}</Badge>}
        </div>
        <p className="text-xs leading-5 text-muted-foreground">{meta.description}</p>
      </div>

      {/* 4 Asian BMI zones: [14..18.5], [18.5..23.0], [23.0..25.0], [25.0..30] over span 16 */}
      <div className="space-y-1.5 pt-1">
        <div className="relative h-3 w-full overflow-visible rounded-full bg-muted">
          <div className="flex h-full w-full overflow-hidden rounded-full">
            <div className="h-full bg-sky-400/70" style={{ width: "28.1%" }} title="Dưới 18,5: Cần bồi bổ" />
            <div className="h-full bg-emerald-500/80" style={{ width: "28.1%" }} title="18,5–22,9: Cân đối" />
            <div className="h-full bg-amber-400/85" style={{ width: "12.5%" }} title="23,0–24,9: Hơi dư" />
            <div className="h-full bg-orange-400/80" style={{ width: "31.3%" }} title="Từ 25,0: Kiểm soát cân nặng" />
          </div>
          <span
            aria-hidden
            className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-foreground shadow-sm transition-[left] duration-300"
            style={{ left: `${position}%` }}
          />
        </div>
        <div className="flex justify-between text-[0.6875rem] text-muted-foreground tabular-nums">
          <span>&lt;18,5</span>
          <span>18,5 – 22,9 (Chuẩn Châu Á)</span>
          <span>23 – 24,9</span>
          <span>≥25</span>
        </div>
      </div>

      {!compact && (
        <div className="grid gap-2 border-t border-border pt-3 text-xs leading-5 text-muted-foreground sm:grid-cols-2">
          {idealWeightMinKg !== null && idealWeightMaxKg !== null && (
            <p>
              <span className="font-medium text-foreground">Vùng cân nặng tham khảo:</span>{" "}
              <span className="tabular-nums">
                {idealWeightMinKg} – {idealWeightMaxKg} kg
              </span>
            </p>
          )}
          {profile.dailyCalorieTarget !== null && (
            <p>
              <span className="font-medium text-foreground">Mức năng lượng gợi ý:</span>{" "}
              <span className="tabular-nums">
                ~{profile.dailyCalorieTarget} kcal ({profile.dailyCalorieMin}–{profile.dailyCalorieMax})
              </span>
            </p>
          )}
        </div>
      )}

      {profile.safetyNote && (
        <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-800 dark:text-amber-300">
          {profile.safetyNote}
        </p>
      )}

      <p className="text-[0.6875rem] leading-4 text-muted-foreground">
        BMI chỉ là mốc tham khảo tương đối, không phản ánh trọn vẹn tỷ lệ cơ/mỡ hay sức khỏe tổng thể.
      </p>
    </div>
  )
}

type TrendMode = "weight" | "bmi"
type RangeDays = 30 | 90

type TrendPoint = {
  date: string
  value: number
  movingAvg: number
  weightKg: number
  bmi: number
  feeling: BodyFeeling | null
  note: string | null
}

const trendConfig = {
  movingAvg: { label: "Xu hướng 7 ngày", color: "var(--chart-1)" },
  value: { label: "Ghi nhận ngày", color: "var(--chart-2)" },
} satisfies ChartConfig

function buildTrendPoints(
  history: readonly BodyMetricLog[],
  mode: TrendMode,
  rangeDays: RangeDays,
): TrendPoint[] {
  const cutoffMs = Date.now() - rangeDays * 86_400_000
  const filtered = history.filter((item) => {
    const ms = Date.parse(`${item.date}T00:00:00Z`)
    return Number.isNaN(ms) ? true : ms >= cutoffMs
  })
  const source = filtered.length > 0 ? filtered : history.slice(-14)

  return source.map((entry, index) => {
    const start = Math.max(0, index - 6)
    const windowSlice = source.slice(start, index + 1)
    const val = (row: BodyMetricLog) => (mode === "weight" ? row.weightKg : row.bmi)
    const avgRaw = windowSlice.reduce((sum, row) => sum + val(row), 0) / windowSlice.length
    return {
      date: entry.date,
      value: val(entry),
      movingAvg: Math.round(avgRaw * 10) / 10,
      weightKg: entry.weightKg,
      bmi: entry.bmi,
      feeling: entry.feeling,
      note: entry.note,
    }
  })
}

function WeightTrendTooltip({
  active,
  label,
  points,
}: Pick<TooltipContentProps<number, string>, "active" | "label"> & {
  points: Map<string, TrendPoint>
}) {
  if (!active || typeof label !== "string") return null
  const point = points.get(label)
  if (!point) return null

  return (
    <div className="grid min-w-44 gap-1 rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-foreground">{formatLongDate(point.date)}</p>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Cân nặng</span>
        <span className="font-medium tabular-nums">{point.weightKg} kg</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">BMI (tham khảo)</span>
        <span className="font-medium tabular-nums">{point.bmi}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Trung bình 7 ngày</span>
        <span className="font-medium tabular-nums">{point.movingAvg}</span>
      </div>
      {point.feeling && (
        <p className="border-t border-border pt-1 text-primary">
          Cảm nhận: {BODY_FEELING_LABELS[point.feeling]}
        </p>
      )}
      {point.note && <p className="text-muted-foreground">{point.note}</p>}
    </div>
  )
}

/**
 * Chart 2: Weight & Asian BMI trend chart with 7-day moving average line so
 * normal day-to-day water/meal fluctuations never feel stressful.
 */
export function WeightBmiTrendChart({ profile }: { profile: NutritionProfile }) {
  const [mode, setMode] = useState<TrendMode>("weight")
  const [rangeDays, setRangeDays] = useState<RangeDays>(30)

  const points = buildTrendPoints(profile.history, mode, rangeDays)
  const byDate = new Map(points.map((point) => [point.date, point]))

  let deltaText: string | null = null
  let isGainDelta = false
  if (points.length >= 2) {
    const first = points[0]
    const last = points[points.length - 1]
    const diff = Math.round((last.weightKg - first.weightKg) * 10) / 10
    isGainDelta = diff > 0
    if (diff === 0) deltaText = "Ổn định"
    else if (diff > 0) deltaText = `+${diff} kg`
    else deltaText = `${diff} kg`
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold">Xu hướng cơ thể</h3>
          {deltaText && (
            <Badge variant="secondary">
              {isGainDelta ? (
                <TrendingUpIcon aria-hidden />
              ) : (
                <TrendingDownIcon aria-hidden />
              )}
              {deltaText}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div className="inline-flex rounded-lg border border-border bg-background p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setMode("weight")}
              className={cn(
                "rounded-md px-2 py-1 font-medium transition-colors",
                mode === "weight" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Cân nặng
            </button>
            <button
              type="button"
              onClick={() => setMode("bmi")}
              className={cn(
                "rounded-md px-2 py-1 font-medium transition-colors",
                mode === "bmi" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              BMI
            </button>
          </div>
          <div className="inline-flex rounded-lg border border-border bg-background p-0.5 text-xs">
            {([30, 90] as const).map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setRangeDays(days)}
                className={cn(
                  "rounded-md px-2 py-1 font-medium transition-colors",
                  rangeDays === days ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {days}N
              </button>
            ))}
          </div>
        </div>
      </div>

      {points.length === 0 ? (
        <p className="rounded-xl bg-secondary/30 px-3 py-6 text-center text-xs text-muted-foreground">
          Chưa có lịch sử cân nặng. Khi bạn lưu cân nặng, biểu đồ xu hướng sẽ tự động hiển thị tại đây.
        </p>
      ) : (
        <figure>
          <ChartContainer
            config={trendConfig}
            className="aspect-auto h-52 w-full"
            aria-label={mode === "weight" ? "Biểu đồ xu hướng cân nặng" : "Biểu đồ xu hướng BMI"}
          >
            <ComposedChart data={points} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="bmi-trend-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-movingAvg)" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="var(--color-movingAvg)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                minTickGap={24}
                tickMargin={8}
                tickFormatter={formatShortDate}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={42}
                domain={["dataMin - 2", "dataMax + 2"]}
                tickCount={4}
              />
              <Tooltip
                cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                content={({ active, label }) => (
                  <WeightTrendTooltip active={active} label={label} points={byDate} />
                )}
              />
              {mode === "weight" && profile.targetWeightKg !== null && (
                <ReferenceLine
                  y={profile.targetWeightKg}
                  stroke="var(--primary)"
                  strokeDasharray="4 4"
                  label={{
                    value: `Mục tiêu ${profile.targetWeightKg}kg`,
                    position: "insideTopRight",
                    fill: "var(--muted-foreground)",
                    fontSize: 11,
                  }}
                />
              )}
              {mode === "bmi" && (
                <>
                  <ReferenceLine y={18.5} stroke="#0ea5e9" strokeDasharray="4 4" />
                  <ReferenceLine y={22.9} stroke="#10b981" strokeDasharray="4 4" />
                </>
              )}
              <Area
                dataKey="movingAvg"
                type="monotone"
                stroke="var(--color-movingAvg)"
                strokeWidth={2.2}
                fill="url(#bmi-trend-fill)"
                dot={false}
              />
              <Line
                dataKey="value"
                type="monotone"
                stroke="var(--color-value)"
                strokeOpacity={0.5}
                strokeWidth={1.5}
                dot={{ r: 3.5, fill: "var(--color-value)", stroke: "var(--card)", strokeWidth: 1.5 }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ChartContainer>
          <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[0.6875rem] text-muted-foreground">
            <span>Đường đậm thể hiện mức trung bình 7 ngày để bạn dễ nhìn xu hướng mà không lo cân nặng lên xuống thất thường từng ngày.</span>
            <span>{points.length} lần ghi nhận</span>
          </figcaption>
        </figure>
      )}
    </div>
  )
}

/** 1-line weight check-in that immediately updates charts, BMI, and daily calorie target. */
export function WeightQuickCheckIn({
  profile,
  onSaved,
}: {
  profile: NutritionProfile
  onSaved: (next: NutritionProfile) => Promise<void> | void
}) {
  const { accessToken } = useAuth()
  const [weight, setWeight] = useState(profile.weightKg?.toString() ?? "")
  const [height, setHeight] = useState(profile.heightCm?.toString() ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedToast, setSavedToast] = useState(false)

  const needsHeight = profile.heightCm === null

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!accessToken || saving) return
    const weightNum = Number(weight.replace(",", "."))
    if (!Number.isFinite(weightNum) || weightNum < 25 || weightNum > 300) {
      setError("Nhập cân nặng hợp lệ từ 25 đến 300 kg.")
      return
    }
    let heightNum: number | undefined
    if (needsHeight) {
      const parsedHeight = Number(height)
      if (!Number.isInteger(parsedHeight) || parsedHeight < 100 || parsedHeight > 250) {
        setError("Nhập chiều cao hợp lệ từ 100 đến 250 cm.")
        return
      }
      heightNum = parsedHeight
    }

    setSaving(true)
    setError(null)
    setSavedToast(false)
    try {
      const updated = await checkInWeight(accessToken, {
        weightKg: Math.round(weightNum * 10) / 10,
        ...(heightNum !== undefined ? { heightCm: heightNum } : {}),
      })
      await onSaved(updated)
      setSavedToast(true)
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message)
      } else {
        setError("Chưa cập nhật được cân nặng. Thử lại nhé.")
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="space-y-2.5 rounded-2xl border border-border bg-card p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-bold">
          <ScaleIcon aria-hidden className="size-4 text-primary" />
          Cập nhật cân nặng hôm nay
        </h3>
        <span className="text-[0.6875rem] text-muted-foreground">Cập nhật BMI &amp; định mức calo</span>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        {needsHeight && (
          <label className="min-w-28 flex-1 text-xs font-medium">
            Chiều cao (cm)
            <Input
              type="number"
              min={100}
              max={250}
              step={1}
              value={height}
              onChange={(event) => {
                setHeight(event.target.value)
                setError(null)
              }}
              placeholder="165"
              className="mt-1"
            />
          </label>
        )}
        <label className="min-w-36 flex-1 text-xs font-medium">
          Cân nặng hôm nay (kg)
          <Input
            type="number"
            min={25}
            max={300}
            step={0.1}
            value={weight}
            onChange={(event) => {
              setWeight(event.target.value)
              setError(null)
            }}
            placeholder="56.5"
            className="mt-1"
          />
        </label>
        <Button type="submit" size="sm" disabled={saving}>
          {saving && <Spinner aria-hidden />}
          Cập nhật
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {savedToast && (
        <p role="status" className="text-xs text-primary">
          Đã cập nhật BMI, biểu đồ &amp; mức năng lượng gợi ý.
        </p>
      )}
    </form>
  )
}

/** Form for editing core body measurements (height, weight) and menu goal. */
export function NutritionProfileForm({
  profile,
  onSaved,
}: {
  profile: NutritionProfile
  onSaved: (next: NutritionProfile) => Promise<void> | void
}) {
  const { accessToken } = useAuth()
  const [heightCm, setHeightCm] = useState(profile.heightCm?.toString() ?? "")
  const [weightKg, setWeightKg] = useState(profile.weightKg?.toString() ?? "")
  const [nutritionGoal, setNutritionGoal] = useState<string>(profile.nutritionGoal ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedNotice, setSavedNotice] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!accessToken || saving) return

    const parseOptNum = (raw: string) => {
      const trimmed = raw.trim().replace(",", ".")
      if (!trimmed) return null
      const num = Number(trimmed)
      return Number.isFinite(num) ? num : Number.NaN
    }

    const h = parseOptNum(heightCm)
    const w = parseOptNum(weightKg)

    if (h === null || !Number.isInteger(h) || h < 100 || h > 250) {
      setError("Nhập chiều cao hợp lệ từ 100 đến 250 cm.")
      return
    }
    if (w === null || Number.isNaN(w) || w < 25 || w > 300) {
      setError("Nhập cân nặng hợp lệ từ 25 đến 300 kg.")
      return
    }

    setSaving(true)
    setError(null)
    setSavedNotice(false)
    try {
      const updated = await saveMyNutrition(accessToken, {
        heightCm: h,
        weightKg: Math.round(w * 10) / 10,
        nutritionGoal: nutritionGoal ? (nutritionGoal as NutritionGoal) : null,
      })
      await onSaved(updated)
      setSavedNotice(true)
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message)
      } else {
        setError("Chưa lưu được hồ sơ BMI. Thử lại nhé.")
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <FieldGroup>
        <div className="space-y-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="nutrition-height">Chiều cao (cm) *</FieldLabel>
              <Input
                id="nutrition-height"
                type="number"
                required
                min={100}
                max={250}
                step={1}
                value={heightCm}
                onChange={(event) => {
                  setHeightCm(event.target.value)
                  setError(null)
                }}
                placeholder="Ví dụ: 162"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="nutrition-weight">Cân nặng hiện tại (kg) *</FieldLabel>
              <Input
                id="nutrition-weight"
                type="number"
                required
                min={25}
                max={300}
                step={0.1}
                value={weightKg}
                onChange={(event) => {
                  setWeightKg(event.target.value)
                  setError(null)
                }}
                placeholder="Ví dụ: 55.5"
              />
            </Field>
          </div>
          <FieldDescription>
            Dùng để tính chỉ số BMI và định mức năng lượng (~kcal/ngày) nhằm ghép đủ số món cho từng bữa.
          </FieldDescription>
        </div>

        <Field>
          <FieldLabel>Mục tiêu thực đơn</FieldLabel>
          <div className="grid gap-2 sm:grid-cols-3">
            {NUTRITION_GOALS.map((goal) => {
              const selected = (nutritionGoal || profile.effectiveGoal) === goal
              const isSuggested = profile.suggestedGoal === goal
              return (
                <button
                  key={goal}
                  type="button"
                  onClick={() => setNutritionGoal(goal)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors",
                    selected
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:bg-accent/50"
                  )}
                >
                  <span className="flex w-full items-center justify-between gap-1 text-xs font-semibold">
                    {NUTRITION_GOAL_LABELS[goal].label}
                    {isSuggested && (
                      <SparklesIcon aria-label="Gợi ý theo BMI" className="size-3.5 text-primary" />
                    )}
                  </span>
                  <span className="text-[0.6875rem] leading-4 text-muted-foreground">
                    {NUTRITION_GOAL_LABELS[goal].hint}
                  </span>
                </button>
              )
            })}
          </div>
          <FieldDescription>
            Quyết định cách trợ lý phân bổ bữa ăn (ưu tiên bữa tối thanh nhẹ khi giảm cân, hoặc ghép thêm món/bữa phụ khi cần bồi bổ).
          </FieldDescription>
        </Field>
      </FieldGroup>

      {error && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving && <Spinner aria-hidden />}
          Lưu hồ sơ BMI
        </Button>
        {savedNotice && (
          <span role="status" className="text-xs text-primary">
            Đã lưu hồ sơ BMI &amp; cập nhật định mức năng lượng.
          </span>
        )}
      </div>
    </form>
  )
}
