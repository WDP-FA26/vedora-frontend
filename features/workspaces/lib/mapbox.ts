import { z } from "zod"

import { PUBLIC_ENV } from "@/lib/env"
import type { LngLat } from "@/features/workspaces/schemas"

export const MAPBOX_TOKEN = PUBLIC_ENV.mapboxToken
export const MAP_STYLE = "mapbox://styles/mapbox/streets-v12"
export const MAP_STYLE_DARK = "mapbox://styles/mapbox/dark-v11"

/** Quận 1, TP.HCM: where a map starts until the visitor's own location is known. */
export const DEFAULT_CENTER: LngLat = { longitude: 106.7009, latitude: 10.7769 }

const GEOCODE_URL = "https://api.mapbox.com/search/geocode/v6"

const featureSchema = z.object({
  id: z.string(),
  geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
  properties: z.object({
    name: z.string().optional(),
    full_address: z.string().optional(),
    place_formatted: z.string().optional(),
  }),
})

const geocodeResponseSchema = z.object({ features: z.array(featureSchema) })

export type AddressSuggestion = LngLat & { id: string; label: string }

function labelOf(feature: z.infer<typeof featureSchema>) {
  const { full_address, name, place_formatted } = feature.properties
  if (full_address) return full_address
  if (name && place_formatted) return `${name}, ${place_formatted}`
  return name ?? place_formatted ?? ""
}

function toSuggestions(body: unknown): AddressSuggestion[] {
  const { features } = geocodeResponseSchema.parse(body)
  const suggestions: AddressSuggestion[] = []
  for (const feature of features) {
    const label = labelOf(feature)
    if (!label) continue
    const [longitude, latitude] = feature.geometry.coordinates
    suggestions.push({ id: feature.id, label, longitude, latitude })
  }
  return suggestions
}

/** Addresses matching `query`, favouring Vietnam and places near `near`. */
export async function searchAddresses(
  token: string,
  query: string,
  near: LngLat | null,
  signal: AbortSignal
): Promise<AddressSuggestion[]> {
  const params = new URLSearchParams({
    q: query,
    access_token: token,
    language: "vi",
    country: "vn",
    limit: "5",
    autocomplete: "true",
  })
  if (near) params.set("proximity", `${near.longitude},${near.latitude}`)
  const response = await fetch(`${GEOCODE_URL}/forward?${params}`, { signal })
  if (!response.ok) throw new Error(`Mapbox geocoding failed (${response.status})`)
  return toSuggestions(await response.json())
}

/** The address at a pinned point, or `null` when Mapbox knows none. */
export async function addressAt(
  token: string,
  point: LngLat,
  signal: AbortSignal
): Promise<string | null> {
  const params = new URLSearchParams({
    longitude: String(point.longitude),
    latitude: String(point.latitude),
    access_token: token,
    language: "vi",
    limit: "1",
  })
  const response = await fetch(`${GEOCODE_URL}/reverse?${params}`, { signal })
  if (!response.ok) throw new Error(`Mapbox reverse geocoding failed (${response.status})`)
  const [first] = toSuggestions(await response.json())
  return first?.label ?? null
}

/** Google Maps directions link ending at `point`. */
export function googleMapsDirectionsUrl(point: LngLat): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${point.latitude},${point.longitude}`
}
