"use client"

import { useEffect, useRef } from "react"
import { Marker, type MapRef } from "react-map-gl/mapbox"

import { BaseMap } from "./base-map"
import { Pin } from "./pin"
import { DEFAULT_CENTER } from "@/features/workspaces/lib/mapbox"
import type { LngLat } from "@/features/workspaces/schemas"

const PINNED_ZOOM = 16
const OVERVIEW_ZOOM = 12

function samePoint(a: LngLat | null, b: LngLat | null) {
  if (!a || !b) return a === b
  return a.longitude === b.longitude && a.latitude === b.latitude
}

/**
 * Click or drag to place the restaurant's pin. When `value` changes from
 * outside (an address picked in search), the camera flies there; pins placed
 * on the map leave the camera where it is.
 */
export default function LocationPickerMap({
  value,
  onChange,
}: {
  value: LngLat | null
  onChange: (point: LngLat) => void
}) {
  const mapRef = useRef<MapRef>(null)
  const placedHere = useRef<LngLat | null>(value)

  useEffect(() => {
    if (!value || samePoint(value, placedHere.current)) return
    placedHere.current = value
    mapRef.current?.flyTo({ center: [value.longitude, value.latitude], zoom: PINNED_ZOOM })
  }, [value])

  function place(point: LngLat) {
    placedHere.current = point
    onChange(point)
  }

  const start = value ?? DEFAULT_CENTER
  return (
    <BaseMap
      ref={mapRef}
      initialViewState={{ ...start, zoom: value ? PINNED_ZOOM : OVERVIEW_ZOOM }}
      cursor="crosshair"
      style={{ width: "100%", height: "100%" }}
      onClick={(event) => place({ longitude: event.lngLat.lng, latitude: event.lngLat.lat })}
    >
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
