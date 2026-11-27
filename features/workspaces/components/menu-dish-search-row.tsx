"use client"

import Link from "next/link"
import { MapPinIcon, NavigationIcon, StarIcon, UtensilsIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { profilePath } from "@/features/profiles/profiles-cache"
import { formatPriceVnd, formatRatingScore } from "@/features/workspaces/lib/format"
import { googleMapsDirectionsUrl } from "@/features/workspaces/lib/mapbox"
import type { RestaurantMenuSearchItem } from "@/features/workspaces/schemas"

export function MenuDishSearchRow({ item }: { item: RestaurantMenuSearchItem }) {
  const menuHref = `${profilePath(item.restaurant.pageUserId)}?tab=menu`
  const reviewsHref = `${profilePath(item.restaurant.pageUserId)}?tab=reviews`
  const priceLabel = formatPriceVnd(item.priceVnd)
  const hasReviews = item.restaurant.averageRating !== null && item.restaurant.reviewCount > 0

  return (
    <li className="flex items-start gap-3 border-b border-border px-4 py-3.5 transition-colors hover:bg-muted/50 sm:px-5">
      <Link href={menuHref} className="shrink-0">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external R2/S3 dish photo
          <img
            src={item.imageUrl}
            alt={item.name}
            referrerPolicy="no-referrer"
            className="size-16 rounded-xl border border-border object-cover"
          />
        ) : (
          <div className="flex size-16 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
            <UtensilsIcon aria-hidden className="size-5" />
          </div>
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={menuHref} className="font-bold hover:underline">
            {item.name}
          </Link>
          {item.category && <Badge variant="secondary">{item.category}</Badge>}
          {priceLabel && (
            <span className="ml-auto text-sm font-semibold tabular-nums text-primary">
              {priceLabel}
            </span>
          )}
        </div>

        {item.description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <Link href={menuHref} className="font-medium text-foreground hover:underline">
            {item.restaurant.name}
          </Link>
          {hasReviews && item.restaurant.averageRating !== null && (
            <Link
              href={reviewsHref}
              className="inline-flex items-center gap-0.5 text-foreground hover:underline"
            >
              <StarIcon aria-hidden className="size-3 fill-amber-400 text-amber-500" />
              <span className="tabular-nums">{formatRatingScore(item.restaurant.averageRating)}</span>
              <span className="text-muted-foreground">({item.restaurant.reviewCount})</span>
            </Link>
          )}
          <span aria-hidden>·</span>
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPinIcon aria-hidden className="size-3 shrink-0" />
            <span className="truncate">{item.restaurant.address}</span>
          </span>
          <a
            href={googleMapsDirectionsUrl(item.restaurant)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
          >
            <NavigationIcon aria-hidden className="size-3" />
            Chỉ đường
          </a>
        </div>
      </div>
    </li>
  )
}
