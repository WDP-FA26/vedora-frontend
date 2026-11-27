"use client"

import { GlobeIcon, MapPinIcon, PhoneIcon, StarIcon } from "lucide-react"

import { RestaurantLocationMap } from "@/features/workspaces/components/map"
import { formatRatingScore } from "@/features/workspaces/lib/format"
import { googleMapsDirectionsUrl, MAPBOX_TOKEN } from "@/features/workspaces/lib/mapbox"
import type { RestaurantProfile } from "@/features/profiles/schemas"

export function RestaurantCard({
  restaurant,
  onOpenReviews,
}: {
  restaurant: RestaurantProfile
  onOpenReviews?: () => void
}) {
  const directions = googleMapsDirectionsUrl(restaurant)
  const hasReviews = restaurant.averageRating !== null && restaurant.reviewCount > 0

  return (
    <section
      aria-label="Thông tin nhà hàng"
      className="mt-4 overflow-hidden rounded-2xl border border-border bg-card"
    >
      {MAPBOX_TOKEN && (
        <div className="h-40 border-b border-border">
          <RestaurantLocationMap
            point={{ longitude: restaurant.longitude, latitude: restaurant.latitude }}
          />
        </div>
      )}
      <ul className="flex flex-col gap-2 p-4 text-sm">
        <li className="flex items-center gap-2">
          <StarIcon
            aria-hidden
            className={
              hasReviews
                ? "size-4 shrink-0 fill-amber-400 text-amber-500"
                : "size-4 shrink-0 text-primary"
            }
          />
          {hasReviews && restaurant.averageRating !== null ? (
            <button
              type="button"
              onClick={onOpenReviews}
              disabled={!onOpenReviews}
              className="inline-flex items-center gap-1.5 text-left font-medium hover:underline disabled:no-underline"
            >
              <span className="tabular-nums">{formatRatingScore(restaurant.averageRating)}</span>
              <span className="text-muted-foreground">({restaurant.reviewCount} đánh giá)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenReviews}
              disabled={!onOpenReviews}
              className="text-left text-muted-foreground hover:text-foreground hover:underline disabled:no-underline"
            >
              Chưa có đánh giá
            </button>
          )}
        </li>
        <li className="flex items-start gap-2">
          <MapPinIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            {restaurant.address}{" "}
            <a
              href={directions}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              Chỉ đường
            </a>
          </span>
        </li>
        {restaurant.phone && (
          <li className="flex items-center gap-2">
            <PhoneIcon aria-hidden className="size-4 shrink-0 text-primary" />
            <a href={`tel:${restaurant.phone.replace(/\s/g, "")}`} className="hover:underline">
              {restaurant.phone}
            </a>
          </li>
        )}
        {restaurant.website && (
          <li className="flex items-center gap-2">
            <GlobeIcon aria-hidden className="size-4 shrink-0 text-primary" />
            <a
              href={restaurant.website}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="truncate hover:underline"
            >
              {restaurant.website.replace(/^https?:\/\//, "")}
            </a>
          </li>
        )}
      </ul>
    </section>
  )
}
