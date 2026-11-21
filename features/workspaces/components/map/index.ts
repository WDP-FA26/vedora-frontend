"use client"

import dynamic from "next/dynamic"

// mapbox-gl touches `window` on import, so every map loads in the browser only.

export const LocationPickerMap = dynamic(() => import("./location-picker-map"), { ssr: false })
export const RestaurantLocationMap = dynamic(() => import("./restaurant-location-map"), {
  ssr: false,
})
export const RestaurantsMap = dynamic(() => import("./restaurants-map"), { ssr: false })
export type { CameraCenterTarget, RestaurantFocusTarget } from "./restaurants-map"
