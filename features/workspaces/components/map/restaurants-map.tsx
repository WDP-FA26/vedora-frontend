"use client"

import { useState } from "react"
import Link from "next/link"
import { GeolocateControl, Marker, Popup, type MapRef } from "react-map-gl/mapbox"

import { BaseMap } from "./base-map"
import { Pin } from "./pin"
import { DEFAULT_CENTER } from "@/features/workspaces/lib/mapbox"
import { profilePath } from "@/features/profiles/profiles-cache"
import type { RestaurantPin } from "@/features/workspaces/schemas"
import type { MapBounds } from "@/features/workspaces/workspaces-cache"

function boundsOf(map: Pick<MapRef, "getBounds">): MapBounds {
  const bounds = map.getBounds()
  if (!bounds) {
    return {
      minLng: DEFAULT_CENTER.longitude - 0.1,
      minLat: DEFAULT_CENTER.latitude - 0.1,
      maxLng: DEFAULT_CENTER.longitude + 0.1,
      maxLat: DEFAULT_CENTER.latitude + 0.1,
    }
  }
  return {
    minLng: bounds.getWest(),
    minLat: bounds.getSouth(),
    maxLng: bounds.getEast(),
    maxLat: bounds.getNorth(),
  }
}

/** Restaurants in view, refetched (by the parent) whenever the camera settles. */
export default function RestaurantsMap({
  restaurants,
  onBoundsChange,
}: {
  restaurants: RestaurantPin[]
  onBoundsChange: (bounds: MapBounds) => void
}) {
  const [selected, setSelected] = useState<RestaurantPin | null>(null)

  return (
    <BaseMap
      initialViewState={{ ...DEFAULT_CENTER, zoom: 12 }}
      style={{ width: "100%", height: "100%" }}
      onLoad={(event) => onBoundsChange(boundsOf(event.target))}
      onMoveEnd={(event) => onBoundsChange(boundsOf(event.target))}
    >
      <GeolocateControl position="top-right" />
      {restaurants.map((restaurant) => (
        <Marker
          key={restaurant.pageUserId}
          longitude={restaurant.longitude}
          latitude={restaurant.latitude}
          anchor="bottom"
          onClick={(event) => {
            // Keep the map's own click from closing the popup straight away.
            event.originalEvent.stopPropagation()
            setSelected(restaurant)
          }}
        >
          <button type="button" aria-label={restaurant.name} className="cursor-pointer">
            <Pin />
          </button>
        </Marker>
      ))}
      {selected && (
        <Popup
          longitude={selected.longitude}
          latitude={selected.latitude}
          anchor="top"
          offset={8}
          onClose={() => setSelected(null)}
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
            <p className="mt-1 text-xs">{selected.address}</p>
          </div>
        </Popup>
      )}
    </BaseMap>
  )
}
