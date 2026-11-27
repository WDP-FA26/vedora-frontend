"use client"

import { Marker } from "react-map-gl/mapbox"

import { BaseMap } from "./base-map"
import { Pin } from "./pin"
import type { LngLat } from "@/features/workspaces/schemas"

export default function RestaurantLocationMap({ point }: { point: LngLat }) {
  return (
    <BaseMap
      initialViewState={{ ...point, zoom: 15 }}
      scrollZoom={false}
      style={{ width: "100%", height: "100%" }}
    >
      <Marker longitude={point.longitude} latitude={point.latitude} anchor="bottom">
        <Pin />
      </Marker>
    </BaseMap>
  )
}
