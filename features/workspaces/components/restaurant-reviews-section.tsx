"use client"

import { useState } from "react"
import Link from "next/link"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ChevronLeftIcon, ChevronRightIcon, MessageSquareIcon, StarIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { FieldError } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { toAuthor } from "@/features/auth/lib/to-author"
import { profilePath } from "@/features/profiles/profiles-cache"
import { AuthorAvatar } from "@/features/shared/components/author-avatar"
import { VerifiedBadge } from "@/features/shared/components/verified-badge"
import { ApiError } from "@/features/shared/lib/api-client"
import { formatPostDateLong } from "@/features/shared/lib/format"
import { PROFESSIONAL_LABEL } from "@/features/verification/schemas"
import { useRestaurantReviews } from "@/features/workspaces/hooks/use-restaurant-reviews"
import { useMyWorkspaces } from "@/features/workspaces/hooks/use-workspaces"
import { formatRatingScore } from "@/features/workspaces/lib/format"
import {
  MAX_REVIEW_COMMENT_LENGTH,
  REVIEW_SORTS,
  restaurantReviewFormSchema,
  type RestaurantReview,
  type RestaurantReviewFormInput,
  type RestaurantReviewFormValues,
  type RestaurantReviewSort,
  type RestaurantReviewSummary,
} from "@/features/workspaces/schemas"
import { cn } from "@/lib/utils"

const STARS = [5, 4, 3, 2, 1] as const
const RATING_SELECT_VALUES = [1, 2, 3, 4, 5] as const

const SORT_LABELS: Record<RestaurantReviewSort, string> = {
  newest: "Mới nhất",
  highest: "Cao nhất",
  lowest: "Thấp nhất",
}

const RATING_TEXT: Record<number, string> = {
  1: "Rất không hài lòng",
  2: "Không hài lòng",
  3: "Bình thường",
  4: "Hài lòng",
  5: "Tuyệt vời",
}

const REVIEW_ERRORS: Record<string, string> = {
  SELF_RATING_NOT_ALLOWED: "Bạn đang quản lý nhà hàng này nên không thể tự đánh giá.",
  PAGE_SESSION_NOT_ALLOWED: "Chuyển về tài khoản cá nhân để đánh giá nhà hàng.",
}

function reviewErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.code && REVIEW_ERRORS[error.code]) {
    return REVIEW_ERRORS[error.code]
  }
  return "Không lưu được đánh giá. Thử lại nhé."
}

function breakdownCount(
  breakdown: RestaurantReviewSummary["breakdown"],
  star: (typeof STARS)[number]
): number {
  switch (star) {
    case 5:
      return breakdown["5"]
    case 4:
      return breakdown["4"]
    case 3:
      return breakdown["3"]
    case 2:
      return breakdown["2"]
    case 1:
      return breakdown["1"]
  }
}

export function RestaurantReviewsSection({
  pageUserId,
  workspaceId,
}: {
  pageUserId: string
  workspaceId: string | null
}) {
  const [sort, setSort] = useState<RestaurantReviewSort>("newest")
  const [page, setPage] = useState(1)
  const { user, accessToken } = useAuth()
  const { workspaces } = useMyWorkspaces()
  const reviews = useRestaurantReviews(pageUserId, sort, page)

  const isManager = Boolean(workspaceId && workspaces.some((item) => item.id === workspaceId))
  const isPageSession = user?.accountType === "PAGE"
  const canReview = Boolean(accessToken && user && !isPageSession && !isManager)

  function selectSort(next: RestaurantReviewSort) {
    setSort(next)
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-5 px-4 py-4 sm:px-5">
      {reviews.isLoading && !reviews.summary ? (
        <div className="flex justify-center py-8">
          <Spinner aria-label="Đang tải đánh giá" />
        </div>
      ) : reviews.error && !reviews.summary ? (
        <p role="alert" className="text-sm text-destructive">
          Chưa tải được đánh giá của nhà hàng lúc này.
        </p>
      ) : (
        <>
          {reviews.summary && <SummaryCard summary={reviews.summary} />}

          {!accessToken ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Đăng nhập bằng tài khoản cá nhân để đánh giá trải nghiệm tại nhà hàng này.
              </p>
              <Button
                size="sm"
                shape="pill"
                nativeButton={false}
                render={
                  <Link
                    href={`/login?next=${encodeURIComponent(`${profilePath(pageUserId)}?tab=reviews`)}`}
                  />
                }
              >
                Đăng nhập để đánh giá
              </Button>
            </div>
          ) : isPageSession ? (
            <p className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
              Chuyển về tài khoản cá nhân để đánh giá nhà hàng.
            </p>
          ) : isManager ? (
            <p className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
              Bạn đang quản lý trang nhà hàng này nên không thể tự đánh giá.
            </p>
          ) : canReview ? (
            <ReviewComposerForm
              key={reviews.myReview ? `${reviews.myReview.id}:${reviews.myReview.updatedAt}` : "new"}
              myReview={reviews.myReview}
              onSave={async (values) => {
                await reviews.upsert(values)
                toast.add({
                  title: reviews.myReview ? "Đã cập nhật đánh giá" : "Đã gửi đánh giá",
                })
              }}
              onDelete={async () => {
                await reviews.remove()
                toast.add({ title: "Đã xóa đánh giá của bạn" })
              }}
            />
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <h2 className="font-heading text-base font-bold">Nhận xét từ thực khách</h2>
            <div role="group" aria-label="Sắp xếp đánh giá" className="flex flex-wrap gap-1">
              {REVIEW_SORTS.map((option) => (
                <Button
                  key={option}
                  type="button"
                  size="xs"
                  shape="pill"
                  variant={sort === option ? "secondary" : "ghost"}
                  onClick={() => selectSort(option)}
                >
                  {SORT_LABELS[option]}
                </Button>
              ))}
            </div>
          </div>

          {reviews.items.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MessageSquareIcon aria-hidden />
                </EmptyMedia>
                <EmptyTitle>Chưa có đánh giá nào</EmptyTitle>
                <EmptyDescription>
                  Hãy là người đầu tiên chia sẻ trải nghiệm về món ăn và không gian của nhà hàng.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
              {reviews.items.map((review) => (
                <li key={review.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <Link href={profilePath(review.author.id)} className="shrink-0">
                      <AuthorAvatar
                        author={toAuthor({
                          id: review.author.id,
                          username: review.author.username,
                          fullName: review.author.fullName,
                          avatarUrl: review.author.avatarUrl,
                        })}
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link
                          href={profilePath(review.author.id)}
                          className="truncate text-sm font-bold hover:underline"
                        >
                          {review.author.fullName}
                        </Link>
                        {review.author.isProfessional && (
                          <VerifiedBadge label={PROFESSIONAL_LABEL} />
                        )}
                        <span className="truncate text-xs text-muted-foreground">
                          @{review.author.username}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <StarDisplay rating={review.rating} />
                        <span className="text-xs text-muted-foreground">
                          {formatPostDateLong(review.createdAt)}
                          {review.updatedAt !== review.createdAt ? " · đã chỉnh sửa" : ""}
                        </span>
                      </div>
                      {review.comment && (
                        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">
                          {review.comment}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {reviews.meta && reviews.meta.totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                shape="pill"
                disabled={!reviews.meta.hasPreviousPage || reviews.isValidating}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeftIcon aria-hidden />
                Trang trước
              </Button>
              <span className="text-xs tabular-nums text-muted-foreground">
                Trang {reviews.meta.page} / {reviews.meta.totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                shape="pill"
                disabled={!reviews.meta.hasNextPage || reviews.isValidating}
                onClick={() => setPage((current) => current + 1)}
              >
                Trang sau
                <ChevronRightIcon aria-hidden />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function SummaryCard({ summary }: { summary: RestaurantReviewSummary }) {
  return (
    <section
      aria-label="Tổng hợp điểm đánh giá"
      className="grid grid-cols-1 gap-5 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[auto_1fr] sm:items-center sm:p-5"
    >
      <div className="flex flex-col items-start sm:items-center sm:pr-4">
        <p className="font-heading text-4xl font-extrabold tabular-nums">
          {summary.averageRating !== null ? formatRatingScore(summary.averageRating) : "—"}
        </p>
        <div className="mt-1">
          <StarDisplay rating={Math.round(summary.averageRating ?? 0)} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {summary.reviewCount > 0 ? `${summary.reviewCount} đánh giá` : "Chưa có đánh giá"}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        {STARS.map((star) => {
          const count = breakdownCount(summary.breakdown, star)
          const pct = summary.reviewCount > 0 ? Math.round((count / summary.reviewCount) * 100) : 0
          return (
            <div key={star} className="flex items-center gap-2.5 text-xs">
              <span className="flex w-7 shrink-0 items-center justify-end gap-0.5 tabular-nums text-muted-foreground">
                <span>{star}</span>
                <StarIcon aria-hidden className="size-3 fill-amber-400 text-amber-500" />
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right tabular-nums text-muted-foreground">
                {count}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} trên 5 sao`}>
      {RATING_SELECT_VALUES.map((value) => (
        <StarIcon
          key={value}
          aria-hidden
          className={
            value <= rating
              ? "size-3.5 fill-amber-400 text-amber-500"
              : "size-3.5 text-muted-foreground/35"
          }
        />
      ))}
    </span>
  )
}

function ReviewComposerForm({
  myReview,
  onSave,
  onDelete,
}: {
  myReview: RestaurantReview | null
  onSave: (values: RestaurantReviewFormValues) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [hoverRating, setHoverRating] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  const form = useForm<RestaurantReviewFormInput, unknown, RestaurantReviewFormValues>({
    resolver: zodResolver(restaurantReviewFormSchema),
    defaultValues: {
      rating: myReview?.rating ?? 5,
      comment: myReview?.comment ?? "",
    },
  })

  const { isSubmitting, errors } = form.formState

  async function onSubmit(values: RestaurantReviewFormValues) {
    try {
      await onSave(values)
    } catch (error) {
      form.setError("root", { message: reviewErrorMessage(error) })
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await onDelete()
    } catch (error) {
      form.setError("root", { message: reviewErrorMessage(error) })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold">
          {myReview ? "Đánh giá của bạn" : "Viết đánh giá của bạn"}
        </h3>
        <Controller
          control={form.control}
          name="rating"
          render={({ field }) => {
            const activeRating = hoverRating ?? field.value
            return (
              <div className="flex items-center gap-2">
                <div
                  role="radiogroup"
                  aria-label="Chọn số sao đánh giá"
                  onMouseLeave={() => setHoverRating(null)}
                  className="inline-flex items-center gap-1"
                >
                  {RATING_SELECT_VALUES.map((star) => {
                    const selected = star === field.value
                    const filled = star <= activeRating
                    return (
                      <button
                        key={star}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={`${star} sao`}
                        onMouseEnter={() => setHoverRating(star)}
                        onClick={() => field.onChange(star)}
                        className="rounded-md p-0.5 outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <StarIcon
                          aria-hidden
                          className={cn(
                            "size-6 transition-colors",
                            filled
                              ? "fill-amber-400 text-amber-500"
                              : "text-muted-foreground/40"
                          )}
                        />
                      </button>
                    )
                  })}
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  {RATING_TEXT[activeRating] ?? `${activeRating} sao`}
                </span>
              </div>
            )
          }}
        />
      </div>

      {errors.rating && <FieldError errors={[errors.rating]} />}

      <Textarea
        rows={3}
        maxLength={MAX_REVIEW_COMMENT_LENGTH}
        placeholder="Chia sẻ cảm nhận về món ăn, không gian và phục vụ (tùy chọn)…"
        aria-label="Nội dung đánh giá"
        aria-invalid={Boolean(errors.comment)}
        {...form.register("comment")}
      />
      {errors.comment && <FieldError errors={[errors.comment]} />}
      {errors.root && <FieldError errors={[errors.root]} />}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {myReview && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            shape="pill"
            disabled={isSubmitting || deleting}
            onClick={() => void handleDelete()}
          >
            {deleting ? <Spinner aria-hidden /> : <Trash2Icon aria-hidden />}
            Xóa đánh giá
          </Button>
        )}
        <Button type="submit" size="sm" shape="pill" disabled={isSubmitting || deleting}>
          {isSubmitting && <Spinner aria-hidden />}
          {myReview ? "Cập nhật đánh giá" : "Gửi đánh giá"}
        </Button>
      </div>
    </form>
  )
}
