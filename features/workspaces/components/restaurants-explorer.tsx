"use client"

import { useState } from "react"
import Link from "next/link"
import {
  LocateFixedIcon,
  MapPinIcon,
  MapPinOffIcon,
  NavigationIcon,
  StarIcon,
  UtensilsIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { toAuthor } from "@/features/auth/lib/to-author"
import { profilePath } from "@/features/profiles/profiles-cache"
import { AuthorAvatar } from "@/features/shared/components/author-avatar"
import {
  RestaurantsMap,
  type CameraCenterTarget,
  type RestaurantFocusTarget,
} from "@/features/workspaces/components/map"
import { PageHeader } from "@/features/workspaces/components/page-header"
import { useRestaurants } from "@/features/workspaces/hooks/use-workspaces"
import { formatDistance, formatRatingScore } from "@/features/workspaces/lib/format"
import {
  GEOLOCATION_OPTIONS,
  geolocationErrorMessage,
  isGeolocationSupported,
} from "@/features/workspaces/lib/geolocation"
import { googleMapsDirectionsUrl, MAPBOX_TOKEN } from "@/features/workspaces/lib/mapbox"
import type { LngLat, RestaurantPin } from "@/features/workspaces/schemas"
import { cn } from "@/lib/utils"

function countSummary(
  ready: boolean,
  count: number,
  truncated: boolean,
  nearestEnabled: boolean
): string {
  if (!ready) return "Đang tải danh sách nhà hàng…"
  if (count === 0) return "Chưa có nhà hàng nào"
  const sortLabel = nearestEnabled ? "Gần bạn nhất" : "Theo tên A–Z"
  if (truncated) return `Hiển thị ${count} nhà hàng đầu tiên · ${sortLabel}`
  return `${count} nhà hàng · ${sortLabel}`
}

/** A full-height map of approved vegetarian restaurants with clickable cards in the right column. */
export function RestaurantsExplorer() {
  const [userLocation, setUserLocation] = useState<LngLat | null>(null)
  const [sortByNearest, setSortByNearest] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locationNotice, setLocationNotice] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [focusTarget, setFocusTarget] = useState<RestaurantFocusTarget | null>(null)
  const [cameraTarget, setCameraTarget] = useState<CameraCenterTarget | null>(null)
  const nearestEnabled = sortByNearest && userLocation !== null
  const activeLocation = nearestEnabled ? userLocation : null
  const { restaurants, truncated, error, isLoading } = useRestaurants(activeLocation)

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

  function toggleNearestSort() {
    if (nearestEnabled) {
      setSortByNearest(false)
      setLocationNotice(null)
      return
    }
    if (userLocation !== null) {
      setSortByNearest(true)
      setLocationNotice(null)
      return
    }
    if (!isGeolocationSupported()) {
      setLocationNotice("Trình duyệt không hỗ trợ lấy vị trí hiện tại.")
      return
    }
    setLocating(true)
    setLocationNotice(null)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords: LngLat = {
          longitude: position.coords.longitude,
          latitude: position.coords.latitude,
        }
        setUserLocation(coords)
        setSortByNearest(true)
        setCameraTarget((prev) => ({ ...coords, seq: (prev?.seq ?? 0) + 1 }))
        setLocating(false)
      },
      (error) => {
        setLocationNotice(geolocationErrorMessage(error))
        setLocating(false)
      },
      GEOLOCATION_OPTIONS
    )
  }

  function handleUserLocation(point: LngLat) {
    setUserLocation(point)
    setSortByNearest(true)
    setLocationNotice(null)
  }

  function focusRestaurant(restaurant: RestaurantPin) {
    setSelectedId(restaurant.pageUserId)
    setFocusTarget((prev) => ({ restaurant, seq: (prev?.seq ?? 0) + 1 }))
  }

  function handleMapSelect(restaurant: RestaurantPin | null) {
    setSelectedId(restaurant ? restaurant.pageUserId : null)
  }

  const ready = !(isLoading && restaurants.length === 0)

  return (
    <section
      aria-labelledby="restaurants-title"
      className="flex h-[calc(100dvh-4rem)] flex-col overflow-hidden sm:h-dvh md:flex-row"
    >
      <div className="relative min-h-[45%] min-w-0 flex-1 md:min-h-0">
        <div className="absolute inset-0">
          <RestaurantsMap
            restaurants={restaurants}
            selectedId={selectedId}
            focusTarget={focusTarget}
            cameraTarget={cameraTarget}
            userLocation={userLocation}
            onSelect={handleMapSelect}
            onUserLocation={handleUserLocation}
            onLocationError={setLocationNotice}
          />
        </div>
      </div>

      <aside
        aria-label="Danh sách nhà hàng"
        className="flex h-[45%] min-h-0 flex-col border-t border-border bg-background md:h-full md:w-80 md:shrink-0 md:border-t-0 md:border-l lg:w-[21.875rem] xl:w-[23rem]"
      >
        <header className="shrink-0 border-b border-border bg-card/85 px-4 py-3 backdrop-blur-md">
          <div className="flex items-center justify-between gap-2">
            <h1 id="restaurants-title" className="text-lg font-bold">
              Nhà hàng chay
            </h1>
            <Button
              type="button"
              variant={nearestEnabled ? "default" : "outline"}
              size="xs"
              shape="pill"
              disabled={locating}
              aria-pressed={nearestEnabled}
              onClick={toggleNearestSort}
              title={
                nearestEnabled
                  ? "Đang sắp xếp gần bạn nhất · Nhấn để sắp xếp theo chữ cái A–Z"
                  : "Bật sắp xếp theo vị trí gần nhất"
              }
            >
              {locating ? <Spinner aria-hidden /> : <LocateFixedIcon aria-hidden />}
              Gần bạn
            </Button>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {countSummary(ready, restaurants.length, truncated, nearestEnabled)}
          </p>
          {locationNotice && (
            <p role="status" className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              {locationNotice}
            </p>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
          {error && (
            <p
              role="alert"
              className="mb-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              Không tải được danh sách nhà hàng. Thử tải lại trang nhé.
            </p>
          )}
          <RestaurantCards
            restaurants={restaurants}
            ready={ready}
            hasError={Boolean(error)}
            selectedId={selectedId}
            onSelect={focusRestaurant}
          />
        </div>
      </aside>
    </section>
  )
}

function RestaurantCards({
  restaurants,
  ready,
  hasError,
  selectedId,
  onSelect,
}: {
  restaurants: RestaurantPin[]
  ready: boolean
  hasError: boolean
  selectedId: string | null
  onSelect: (restaurant: RestaurantPin) => void
}) {
  if (!ready) {
    return (
      <div className="flex justify-center py-8">
        <Spinner aria-label="Đang tải danh sách nhà hàng" />
      </div>
    )
  }

  if (restaurants.length === 0) {
    if (hasError) return null
    return (
      <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        Chưa có nhà hàng chay nào được duyệt trên hệ thống.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {restaurants.map((restaurant) => (
        <li key={restaurant.pageUserId}>
          <RestaurantExplorerCard
            restaurant={restaurant}
            selected={restaurant.pageUserId === selectedId}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ul>
  )
}

function RestaurantExplorerCard({
  restaurant,
  selected,
  onSelect,
}: {
  restaurant: RestaurantPin
  selected: boolean
  onSelect: (restaurant: RestaurantPin) => void
}) {
  const hasReviews = restaurant.averageRating !== null && restaurant.reviewCount > 0

  return (
    <article
      className={cn(
        "group relative rounded-2xl border bg-card p-3.5 transition-colors",
        selected
          ? "border-primary bg-accent/40 ring-1 ring-primary/30"
          : "border-border hover:border-primary/40 hover:bg-muted/40"
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(restaurant)}
        aria-pressed={selected}
        aria-label={`Di chuyển bản đồ đến ${restaurant.name}`}
        className="absolute inset-0 z-0 cursor-pointer rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />

      <div className="pointer-events-none relative z-10 flex flex-col gap-2">
        <div className="flex items-start gap-3">
          <AuthorAvatar
            author={toAuthor({
              id: restaurant.pageUserId,
              username: restaurant.username,
              fullName: restaurant.name,
              avatarUrl: restaurant.avatarUrl,
            })}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <Link
                href={profilePath(restaurant.pageUserId)}
                className="pointer-events-auto relative z-10 inline-block max-w-full truncate font-heading text-sm font-bold text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {restaurant.name}
              </Link>
              {restaurant.distanceMeters !== null && (
                <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium tabular-nums text-secondary-foreground">
                  {formatDistance(restaurant.distanceMeters)}
                </span>
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">@{restaurant.username}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {hasReviews && restaurant.averageRating !== null ? (
            <Link
              href={`${profilePath(restaurant.pageUserId)}?tab=reviews`}
              className="pointer-events-auto relative z-10 inline-flex items-center gap-1 font-medium text-foreground hover:underline"
            >
              <StarIcon aria-hidden className="size-3.5 fill-amber-400 text-amber-500" />
              <span className="tabular-nums">{formatRatingScore(restaurant.averageRating)}</span>
              <span className="text-muted-foreground">({restaurant.reviewCount} đánh giá)</span>
            </Link>
          ) : (
            <Link
              href={`${profilePath(restaurant.pageUserId)}?tab=reviews`}
              className="pointer-events-auto relative z-10 inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline"
            >
              <StarIcon aria-hidden className="size-3.5" />
              Chưa có đánh giá
            </Link>
          )}
        </div>

        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <MapPinIcon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <span className="line-clamp-2">{restaurant.address}</span>
        </p>

        <div className="flex items-center justify-between gap-2 pt-0.5">
          {selected ? (
            <span className="text-xs font-medium text-primary">Đang xem trên bản đồ</span>
          ) : (
            <Link
              href={`${profilePath(restaurant.pageUserId)}?tab=menu`}
              className="pointer-events-auto relative z-10 inline-flex items-center gap-1 text-xs font-medium text-foreground/80 underline-offset-4 hover:text-primary hover:underline"
            >
              <UtensilsIcon aria-hidden className="size-3.5" />
              Thực đơn
            </Link>
          )}
          <Button
            variant="outline"
            size="sm"
            shape="pill"
            nativeButton={false}
            className="pointer-events-auto relative z-10 ml-auto"
            render={
              <a
                href={googleMapsDirectionsUrl(restaurant)}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <NavigationIcon aria-hidden className="size-3.5" />
            Chỉ đường
          </Button>
        </div>
      </div>
    </article>
  )
}
