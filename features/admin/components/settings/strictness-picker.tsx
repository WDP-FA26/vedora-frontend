"use client"

import { useState } from "react"
import { cn } from "cn"

import { Input } from "@/components/ui/input"
import { STRICTNESS_LEVELS, strictnessOf } from "@/features/admin/components/settings/policy-validation"
import type { ModerationSettings } from "@/features/admin/schemas"

function percent(value: number) {
  return `${Math.round(value * 100)}%`
}

const OPTION =
  "flex w-full flex-col gap-1 rounded-xl border px-4 py-3 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"

/** How early the check blocks or holds a post: three presets, or your own two numbers. */
export function StrictnessPicker({
  value,
  onChange,
}: {
  /** The thresholds in the draft. */
  value: Pick<ModerationSettings, "reviewThreshold" | "rejectThreshold">
  onChange: (thresholds: { reviewThreshold: number; rejectThreshold: number }) => void
}) {
  const preset = strictnessOf(value)
  const [customOpen, setCustomOpen] = useState(false)
  // Thresholds that match no preset are custom by definition.
  const custom = customOpen || preset === null
  const reviewPercent = Math.round(value.reviewThreshold * 100)
  const rejectPercent = Math.round(value.rejectThreshold * 100)
  const valid = reviewPercent >= 0 && rejectPercent <= 100 && reviewPercent < rejectPercent

  return (
    <section aria-labelledby="strictness-title" className="flex flex-col gap-3">
      <div>
        <h2 id="strictness-title" className="text-lg font-semibold">
          Mức nghiêm ngặt
        </h2>
        <p className="text-muted-foreground">
          Model chấm mỗi nội dung một khả năng vi phạm (0–100%). Mức này quyết định khả năng bao nhiêu thì bài bị chặn
          hoặc phải chờ admin.
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {STRICTNESS_LEVELS.map((level) => {
          const active = !custom && preset?.id === level.id
          return (
            <li key={level.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setCustomOpen(false)
                  onChange({ reviewThreshold: level.review, rejectThreshold: level.reject })
                }}
                className={cn(OPTION, active ? "border-primary bg-primary/5" : "hover:bg-muted/50")}
              >
                <span className="flex items-center gap-2 font-medium">
                  {level.label}
                  {level.id === "balanced" && (
                    <span className="text-xs font-normal text-muted-foreground">Mặc định</span>
                  )}
                </span>
                <span className="text-sm text-muted-foreground">{level.detail}</span>
                <span className="text-sm">
                  Chặn từ <strong>{percent(level.reject)}</strong> · Chờ admin từ{" "}
                  <strong>{percent(level.review)}</strong> · Dưới đó tự đăng
                </span>
              </button>
            </li>
          )
        })}
        <li>
          <div className={cn(OPTION, custom ? "border-primary bg-primary/5" : "")}>
            <button
              type="button"
              aria-pressed={custom}
              onClick={() => setCustomOpen(true)}
              className="flex flex-col gap-1 text-left outline-none"
            >
              <span className="font-medium">Tuỳ chỉnh</span>
              <span className="text-sm text-muted-foreground">Tự đặt hai ngưỡng theo ý bạn.</span>
            </button>
            {custom && (
              <div className="mt-2 flex flex-wrap items-end gap-4">
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Chờ admin từ (%)
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={reviewPercent}
                    onChange={(event) =>
                      onChange({
                        reviewThreshold: Number(event.target.value) / 100,
                        rejectThreshold: value.rejectThreshold,
                      })
                    }
                    className="w-28"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Chặn từ (%)
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={rejectPercent}
                    onChange={(event) =>
                      onChange({
                        reviewThreshold: value.reviewThreshold,
                        rejectThreshold: Number(event.target.value) / 100,
                      })
                    }
                    className="w-28"
                  />
                </label>
              </div>
            )}
            {custom && !valid && (
              <p role="alert" className="text-sm text-destructive">
                Ngưỡng chờ admin phải nhỏ hơn ngưỡng chặn (trong khoảng 0–100%).
              </p>
            )}
          </div>
        </li>
      </ul>
    </section>
  )
}
