"use client"

import "mapbox-gl/dist/mapbox-gl.css"

import { useTheme } from "@wrksz/themes/client"
import Map, { NavigationControl, type MapProps, type MapRef } from "react-map-gl/mapbox"

import { MAP_STYLE, MAP_STYLE_DARK, MAPBOX_TOKEN } from "@/features/workspaces/lib/mapbox"

export function BaseMap({
  children,
  ref,
  ...props
}: Omit<MapProps, "mapboxAccessToken" | "mapStyle"> & { ref?: React.Ref<MapRef> }) {
  const { resolvedTheme } = useTheme()
  if (!MAPBOX_TOKEN) return null
  return (
    <Map
      ref={ref}
      mapboxAccessToken={MAPBOX_TOKEN}
      mapStyle={resolvedTheme === "dark" ? MAP_STYLE_DARK : MAP_STYLE}
      language="vi"
      reuseMaps
      {...props}
    >
      <NavigationControl position="top-right" showCompass={false} />
      {children}
    </Map>
  )
}
