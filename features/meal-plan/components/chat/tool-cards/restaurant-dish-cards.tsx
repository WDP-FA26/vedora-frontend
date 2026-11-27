"use client"

import Link from "next/link"
import { CheckIcon, MapPinIcon, NavigationIcon, StarIcon, UtensilsIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { PlannerRestaurantDish } from "@/features/meal-plan/lib/chat-message-parsers"
import { profilePath } from "@/features/profiles/profiles-cache"
import { formatPriceVnd, formatRatingScore } from "@/features/workspaces/lib/format"

export function RestaurantDishCards({
  dishes,
  onLogDish,
}: {
  dishes: PlannerRestaurantDish[]
  onLogDish?: (dish: PlannerRestaurantDish) => void
}) {
  return (
    <section aria-label="Món gợi ý từ nhà hàng" className="mt-2 flex w-full flex-col gap-2">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <UtensilsIcon aria-hidden className="size-3.5" />
        Món từ nhà hàng trên Vedora
      </h3>
      <ul className="flex flex-col gap-2">
        {dishes.map((dish) => {
          const priceLabel = formatPriceVnd(dish.priceVnd)
          const menuHref = `${profilePath(dish.restaurant.pageUserId)}?tab=menu`
          const hasReviews =
            dish.restaurant.averageRating !== null && dish.restaurant.reviewCount > 0
          const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${dish.restaurant.name}, ${dish.restaurant.address}`)}`

          return (
            <li
              key={dish.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-card p-3"
            >
              {dish.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- external R2/S3 dish photo
                <img
                  src={dish.imageUrl}
                  alt={dish.name}
                  referrerPolicy="no-referrer"
                  className="size-14 shrink-0 rounded-lg border border-border object-cover"
                />
              ) : (
                <div className="flex size-14 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
                  <UtensilsIcon aria-hidden className="size-4" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Link href={menuHref} className="text-sm font-bold hover:underline">
                    {dish.name}
                  </Link>
                  {dish.category && <Badge variant="secondary">{dish.category}</Badge>}
                  {priceLabel && (
                    <span className="ml-auto text-xs font-semibold tabular-nums text-primary">
                      {priceLabel}
                    </span>
                  )}
                </div>

                {dish.avoidedMatches.length > 0 && (
                  <p className="mt-1 inline-block rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                    Lưu ý thành phần cần tránh: {dish.avoidedMatches.join(", ")}
                  </p>
                )}

                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <Link href={menuHref} className="font-medium text-foreground hover:underline">
                    {dish.restaurant.name}
                  </Link>
                  {hasReviews && dish.restaurant.averageRating !== null && (
                    <span className="inline-flex items-center gap-0.5 text-foreground">
                      <StarIcon aria-hidden className="size-3 fill-amber-400 text-amber-500" />
                      <span className="tabular-nums">
                        {formatRatingScore(dish.restaurant.averageRating)}
                      </span>
                      <span className="text-muted-foreground">({dish.restaurant.reviewCount})</span>
                    </span>
                  )}
                </div>

                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <MapPinIcon aria-hidden className="size-3 shrink-0" />
                    <span className="truncate">{dish.restaurant.address}</span>
                  </span>
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
                  >
                    <NavigationIcon aria-hidden className="size-3" />
                    Chỉ đường
                  </a>
                  {onLogDish && (
                    <button
                      type="button"
                      onClick={() => onLogDish(dish)}
                      className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
                    >
                      <CheckIcon aria-hidden className="size-3" />
                      Ghi vào Nhật ký
                    </button>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
