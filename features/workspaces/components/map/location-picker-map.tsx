"use client"

import { useEffect, useRef, useState } from "react"
import { GeolocateControl, Marker, type MapRef } from "react-map-gl/mapbox"

import { BaseMap } from "./base-map"
import { Pin } from "./pin"
import { GEOLOCATION_OPTIONS } from "@/features/workspaces/lib/geolocation"
import { DEFAULT_CENTER } from "@/features/workspaces/lib/mapbox"
import type { LngLat } from "@/features/workspaces/schemas"

const PINNED_ZOOM = 16
const OVERVIEW_ZOOM = 12

function samePoint(a: LngLat | null, b: LngLat | null) {
  if (!a || !b) return a === b
  return a.longitude === b.longitude && a.latitude === b.latitude
}

export default function LocationPickerMap({
  value,
  onChange,
}: {
  value: LngLat | null
  onChange: (point: LngLat) => void
}) {
  const [map, setMap] = useState<MapRef | null>(null)
  const placedHere = useRef<LngLat | null>(value)

  useEffect(() => {
    if (!map || !value || samePoint(value, placedHere.current)) return
    placedHere.current = value
    map.flyTo({ center: [value.longitude, value.latitude], zoom: PINNED_ZOOM })
  }, [map, value])

  function place(point: LngLat) {
    placedHere.current = point
    onChange(point)
  }

  const start = value ?? DEFAULT_CENTER
  return (
    <BaseMap
      ref={setMap}
      initialViewState={{ ...start, zoom: value ? PINNED_ZOOM : OVERVIEW_ZOOM }}
      cursor="crosshair"
      style={{ width: "100%", height: "100%" }}
      onClick={(event) => place({ longitude: event.lngLat.lng, latitude: event.lngLat.lat })}
    >
      <GeolocateControl position="top-right" positionOptions={GEOLOCATION_OPTIONS} />
      {value && (
        <Marker
          longitude={value.longitude}
          latitude={value.latitude}
          anchor="bottom"
          draggable
          onDragEnd={(event) => place({ longitude: event.lngLat.lng, latitude: event.lngLat.lat })}
        >
          <Pin />
        </Marker>
      )}
    </BaseMap>
  )
}
