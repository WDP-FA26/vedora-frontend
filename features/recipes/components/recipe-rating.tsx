"use client"

import { useState } from "react"
import { RotateCcwIcon, StarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { useRecipeRating } from "@/features/recipes/hooks/use-recipe-rating"
import { cn } from "@/lib/utils"

const SCORES = [1, 2, 3, 4, 5]

const formatAverage = (value: number) =>
  value.toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** Five stars filled up to `value`, partly filling the star it ends in. */
function StarMeter({ value }: { value: number }) {
  return (
    <span aria-hidden className="inline-flex">
      {SCORES.map((score) => {
        const fill = Math.min(1, Math.max(0, value - score + 1))
        return (
          <span key={score} className="relative size-4">
            <StarIcon className="absolute inset-0 size-4 text-muted-foreground/40" />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <StarIcon className="size-4 fill-amber-400 text-amber-400" />
            </span>
          </span>
        )
      })}
    </span>
  )
}

/** The rating summary of a recipe, and stars the signed-in user scores it with. */
export function RecipeRating({ recipeId }: { recipeId: string }) {
  const {
    summary,
    myRating,
    isLoading,
    loadError,
    retryLoad,
    signedIn,
    pending,
    error,
    selfRating,
    rate,
    clear,
  } = useRecipeRating(recipeId)
  const [hovered, setHovered] = useState<number | null>(null)

  if (isLoading) {
    return (
      <div role="status" aria-label="Đang tải đánh giá" className="h-16 overflow-hidden rounded-xl">
        <Skeleton className="size-full" />
      </div>
    )
  }

  if (loadError || !summary) {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm">
        <span>Không tải được đánh giá.</span>
        <Button type="button" variant="outline" size="sm" shape="pill" onClick={() => retryLoad()}>
          <RotateCcwIcon aria-hidden />
          Thử lại
        </Button>
      </div>
    )
  }

  const shown = hovered ?? myRating ?? 0
  const disabled = pending || selfRating

  return (
    <section aria-label="Đánh giá" className="space-y-3 rounded-xl border border-border p-3">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        {summary.averageRating === null ? (
          <span className="text-muted-foreground">Chưa có đánh giá</span>
        ) : (
          <>
            <StarMeter value={summary.averageRating} />
            <span className="font-semibold">{formatAverage(summary.averageRating)}</span>
            <span className="text-muted-foreground">({summary.ratingCount} đánh giá)</span>
            <span className="sr-only">
              Trung bình {formatAverage(summary.averageRating)} trên 5 sao
            </span>
          </>
        )}
      </p>

      {!selfRating && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-sm text-muted-foreground">
            {!signedIn
              ? "Đăng nhập để đánh giá"
              : myRating
                ? `Bạn đã chấm ${myRating} sao`
                : "Đánh giá của bạn"}
          </span>
          <div
            role="group"
            aria-label="Chấm điểm công thức"
            className="inline-flex"
            onMouseLeave={() => setHovered(null)}
          >
            {SCORES.map((score) => (
              <button
                key={score}
                type="button"
                disabled={disabled}
                aria-label={`${score} sao`}
                aria-pressed={myRating === score}
                onClick={() => void rate(score)}
                onMouseEnter={() => setHovered(score)}
                onFocus={() => setHovered(score)}
                onBlur={() => setHovered(null)}
                className="rounded-md p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-60"
              >
                <StarIcon
                  aria-hidden
                  className={cn(
                    "size-6",
                    score <= shown ? "fill-amber-400 text-amber-400" : "text-muted-foreground/50"
                  )}
                />
              </button>
            ))}
          </div>
          {pending && <Spinner aria-label="Đang lưu đánh giá" />}
          {myRating && !pending && (
            <Button type="button" variant="ghost" size="sm" onClick={() => void clear()}>
              Gỡ đánh giá
            </Button>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}
