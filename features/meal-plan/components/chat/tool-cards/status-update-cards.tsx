"use client"

import Link from "next/link"
import { ActivityIcon, NotebookPenIcon, SparklesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DIETARY_PATH } from "@/features/dietary/dietary"
import type {
  BodyMetricsUpdate,
  LoggedMealUpdate,
  ProfileNoteUpdate,
} from "@/features/meal-plan/lib/chat-message-parsers"
import { SECTION_LABELS } from "@/features/meal-plan/lib/dates"

export function ProfileNoteCard({
  update,
  onEditDietary,
}: {
  update: ProfileNoteUpdate
  onEditDietary?: () => void
}) {
  const label = update.section === "allergies" ? "Dị ứng" : "Sở thích"
  const note = update.lines.length > 0 ? update.lines.map((line) => `• ${line}`).join("\n") : null
  return (
    <article
      aria-label={`${label} đã cập nhật`}
      className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3"
    >
      <div className="flex items-start gap-2">
        <SparklesIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Đã cập nhật {label} trong hồ sơ</h3>
          <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
            {note ?? `Đã xoá hết mục ${label}.`}
          </p>
        </div>
        {onEditDietary ? (
          <button
            type="button"
            onClick={onEditDietary}
            className="shrink-0 text-xs font-semibold text-primary underline-offset-4 hover:underline"
          >
            Chỉnh
          </button>
        ) : (
          <Link
            href={DIETARY_PATH}
            className="shrink-0 text-xs font-semibold text-primary underline-offset-4 hover:underline"
          >
            Chỉnh
          </Link>
        )}
      </div>
    </article>
  )
}

export function MealLoggedCard({
  item,
  onOpenMealLog,
}: {
  item: LoggedMealUpdate
  onOpenMealLog?: (date?: string) => void
}) {
  return (
    <article
      aria-label="Đã ghi vào nhật ký"
      className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3"
    >
      <div className="flex items-start gap-2">
        <NotebookPenIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Đã ghi vào Nhật ký</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {item.name} · Bữa {SECTION_LABELS[item.section].toLowerCase()} ({item.date})
            {item.calories !== null ? ` · ~${item.calories} kcal` : ""}
          </p>
        </div>
        {onOpenMealLog && (
          <Button variant="link" size="xs" onClick={() => onOpenMealLog(item.date)}>
            Xem Nhật ký
          </Button>
        )}
      </div>
    </article>
  )
}

export function BodyMetricsCard({
  item,
  onOpenBodyMetrics,
}: {
  item: BodyMetricsUpdate
  onOpenBodyMetrics?: () => void
}) {
  const details: string[] = []
  if (item.weightKg !== null) details.push(`${item.weightKg} kg`)
  if (item.heightCm !== null) details.push(`${item.heightCm} cm`)
  if (item.bmi !== null) details.push(`BMI ${item.bmi.toFixed(1)}`)
  if (item.dailyCalorieTarget !== null) details.push(`~${item.dailyCalorieTarget} kcal/ngày`)
  return (
    <article
      aria-label="Đã cập nhật chỉ số cơ thể"
      className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3"
    >
      <div className="flex items-start gap-2">
        <ActivityIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Đã cập nhật chỉ số cơ thể</h3>
          {details.length > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{details.join(" · ")}</p>
          )}
        </div>
        {onOpenBodyMetrics && (
          <Button variant="link" size="xs" onClick={onOpenBodyMetrics}>
            Xem BMI
          </Button>
        )}
      </div>
    </article>
  )
}
