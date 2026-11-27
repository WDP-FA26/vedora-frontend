"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { MapPinIcon, NavigationIcon, StarIcon, UtensilsIcon } from "lucide-react"
import { GeolocateControl, Marker, Popup, type MapRef } from "react-map-gl/mapbox"

import { BaseMap } from "./base-map"
import { Pin } from "./pin"
import { formatDistance, formatRatingScore } from "@/features/workspaces/lib/format"
import {
  GEOLOCATION_OPTIONS,
  geolocationErrorMessage,
} from "@/features/workspaces/lib/geolocation"
import { DEFAULT_CENTER, googleMapsDirectionsUrl } from "@/features/workspaces/lib/mapbox"
import { profilePath } from "@/features/profiles/profiles-cache"
import type { LngLat, RestaurantPin } from "@/features/workspaces/schemas"

const FOCUSED_ZOOM = 15

export type RestaurantFocusTarget = {
  restaurant: RestaurantPin
  seq: number
}

export type CameraCenterTarget = LngLat & {
  seq: number
}

export default function RestaurantsMap({
  restaurants,
  selectedId,
  focusTarget,
  cameraTarget,
  userLocation,
  onSelect,
  onUserLocation,
  onLocationError,
}: {
  restaurants: RestaurantPin[]
  selectedId: string | null
  focusTarget: RestaurantFocusTarget | null
  cameraTarget?: CameraCenterTarget | null
  userLocation?: LngLat | null
  onSelect: (restaurant: RestaurantPin | null) => void
  onUserLocation?: (point: LngLat) => void
  onLocationError?: (message: string) => void
}) {
  const [map, setMap] = useState<MapRef | null>(null)
  const appliedFocusSeqRef = useRef(0)
  const appliedCameraSeqRef = useRef(0)

  useEffect(() => {
    if (!map || !focusTarget || focusTarget.seq === appliedFocusSeqRef.current) return
    appliedFocusSeqRef.current = focusTarget.seq
    map.flyTo({
      center: [focusTarget.restaurant.longitude, focusTarget.restaurant.latitude],
      zoom: Math.max(map.getZoom(), FOCUSED_ZOOM),
    })
  }, [map, focusTarget])

  useEffect(() => {
    if (!map || !cameraTarget || cameraTarget.seq === appliedCameraSeqRef.current) return
    appliedCameraSeqRef.current = cameraTarget.seq
    map.flyTo({
      center: [cameraTarget.longitude, cameraTarget.latitude],
      zoom: Math.max(map.getZoom(), 13.5),
    })
  }, [map, cameraTarget])

  const selected = selectedId
    ? (restaurants.find((item) => item.pageUserId === selectedId) ?? null)
    : null

  return (
    <BaseMap
      ref={setMap}
      initialViewState={{ ...DEFAULT_CENTER, zoom: 12 }}
      style={{ width: "100%", height: "100%" }}
    >
      <GeolocateControl
        position="top-right"
        positionOptions={GEOLOCATION_OPTIONS}
        showUserLocation={false}
        onGeolocate={(event) =>
          onUserLocation?.({
            longitude: event.coords.longitude,
            latitude: event.coords.latitude,
          })
        }
        onError={(error) => onLocationError?.(geolocationErrorMessage(error))}
      />
      {userLocation && (
        <Marker
          longitude={userLocation.longitude}
          latitude={userLocation.latitude}
          anchor="center"
          style={{ pointerEvents: "none" }}
        >
          <span
            role="img"
            aria-label="Vị trí hiện tại của bạn"
            className="relative flex size-5 items-center justify-center"
          >
            <span className="absolute inset-0 animate-ping rounded-full bg-sky-500/40" />
            <span className="relative size-3.5 rounded-full border-2 border-white bg-sky-500 shadow-md" />
          </span>
        </Marker>
      )}
      {restaurants.map((restaurant) => {
        const isSelected = restaurant.pageUserId === selectedId
        return (
          <Marker
            key={restaurant.pageUserId}
            longitude={restaurant.longitude}
            latitude={restaurant.latitude}
            anchor="bottom"
            style={isSelected ? { zIndex: 10 } : undefined}
            onClick={(event) => {
              event.originalEvent.stopPropagation()
              onSelect(restaurant)
            }}
          >
            <button
              type="button"
              aria-label={restaurant.name}
              aria-pressed={isSelected}
              className="cursor-pointer"
            >
              <Pin
                className={
                  isSelected
                    ? "scale-125 drop-shadow-lg transition-transform"
                    : "transition-transform"
                }
              />
            </button>
          </Marker>
        )
      })}
      {selected && (
        <Popup
          key={selected.pageUserId}
          longitude={selected.longitude}
          latitude={selected.latitude}
          anchor="top"
          offset={8}
          onClose={() => onSelect(null)}
          closeButton={false}
          maxWidth="16rem"
        >
          <div className="text-foreground">
            <Link
              href={profilePath(selected.pageUserId)}
              className="font-bold hover:underline"
            >
              {selected.name}
            </Link>
            <p className="text-xs text-muted-foreground">@{selected.username}</p>
            {(selected.averageRating !== null || selected.distanceMeters !== null) && (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                {selected.averageRating !== null && selected.reviewCount > 0 && (
                  <Link
                    href={`${profilePath(selected.pageUserId)}?tab=reviews`}
                    className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
                  >
                    <StarIcon aria-hidden className="size-3 fill-amber-400 text-amber-500" />
                    <span>{formatRatingScore(selected.averageRating)}</span>
                    <span className="text-muted-foreground">({selected.reviewCount})</span>
                  </Link>
                )}
                {selected.distanceMeters !== null && (
                  <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                    <MapPinIcon aria-hidden className="size-3" />
                    {formatDistance(selected.distanceMeters)}
                  </span>
                )}
              </div>
            )}
            <p className="mt-1 text-xs">{selected.address}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              <Link
                href={`${profilePath(selected.pageUserId)}?tab=menu`}
                className="inline-flex items-center gap-1 text-xs font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
              >
                <UtensilsIcon aria-hidden className="size-3" />
                Thực đơn
              </Link>
              <a
                href={googleMapsDirectionsUrl(selected)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                <NavigationIcon aria-hidden className="size-3" />
                Chỉ đường
              </a>
            </div>
          </div>
        </Popup>
      )}
    </BaseMap>
  )
}
