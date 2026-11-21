"use client"

import { useState } from "react"
import Link from "next/link"
import { MapPinOffIcon } from "lucide-react"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { toAuthor } from "@/features/auth/lib/to-author"
import { profilePath } from "@/features/profiles/profiles-cache"
import { AuthorAvatar } from "@/features/shared/components/author-avatar"
import { RestaurantsMap } from "@/features/workspaces/components/map"
import { PageHeader } from "@/features/workspaces/components/page-header"
import { useRestaurantsInView } from "@/features/workspaces/hooks/use-workspaces"
import { MAPBOX_TOKEN } from "@/features/workspaces/lib/mapbox"
import type { MapBounds } from "@/features/workspaces/workspaces-cache"

/** A map of approved vegetarian restaurants, with the ones in view listed below it. */
export function RestaurantsExplorer() {
  const [bounds, setBounds] = useState<MapBounds | null>(null)
  const { restaurants, truncated, error } = useRestaurantsInView(bounds)

  if (!MAPBOX_TOKEN) {
    return (
      <section>
        <PageHeader title="Nhà hàng chay" />
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MapPinOffIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Bản đồ chưa được bật</EmptyTitle>
            <EmptyDescription>Bản đồ nhà hàng chưa được cấu hình trên máy chủ này.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </section>
    )
  }

  return (
    <section aria-labelledby="restaurants-title">
      <PageHeader title="Nhà hàng chay" />
      <span id="restaurants-title" className="sr-only">
        Bản đồ nhà hàng chay
      </span>
      <div className="h-[55dvh] min-h-80 border-b border-border">
        <RestaurantsMap restaurants={restaurants} onBoundsChange={setBounds} />
      </div>
      {error && (
        <p role="alert" className="p-4 text-sm text-destructive sm:px-5">
          Không tải được danh sách nhà hàng. Thử di chuyển bản đồ lại nhé.
        </p>
      )}
      {truncated && (
        <p className="px-4 pt-3 text-sm text-muted-foreground sm:px-5">
          Có nhiều nhà hàng trong khu vực này; phóng to bản đồ để xem hết.
        </p>
      )}
      <RestaurantList restaurants={restaurants} loaded={bounds !== null} />
    </section>
  )
}

function RestaurantList({
  restaurants,
  loaded,
}: {
  restaurants: ReturnType<typeof useRestaurantsInView>["restaurants"]
  loaded: boolean
}) {
  if (!loaded) return null
  if (restaurants.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground sm:px-5">
        Chưa có nhà hàng nào trong khu vực này.
      </p>
    )
  }
  return (
    <ul className="divide-y divide-border">
      {restaurants.map((restaurant) => (
        <li key={restaurant.pageUserId}>
          <Link
            href={profilePath(restaurant.pageUserId)}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 sm:px-5"
          >
            <AuthorAvatar
              author={toAuthor({
                id: restaurant.pageUserId,
                username: restaurant.username,
                fullName: restaurant.name,
                avatarUrl: restaurant.avatarUrl,
              })}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{restaurant.name}</span>
              <span className="block truncate text-sm text-muted-foreground">
                {restaurant.address}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
