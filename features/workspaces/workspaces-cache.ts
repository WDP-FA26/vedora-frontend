import { API_URL } from "@/features/auth/lib/api"
import type { LngLat, RestaurantReviewSort } from "@/features/workspaces/schemas"

/** SWR keys for restaurant pages: `[url, accessToken]` tuples, except the public map. */
const WORKSPACES_KEY = `${API_URL}/workspaces`

/** Pages you own or manage; also where a new application is posted. */
export const MY_WORKSPACES_KEY = `${WORKSPACES_KEY}/mine`

export const WORKSPACE_PROOF_UPLOADS_KEY = `${WORKSPACES_KEY}/proofs/uploads`

export const WORKSPACES_URL = WORKSPACES_KEY

/** One page you manage, with its members. */
export function workspaceKey(id: string) {
  return `${WORKSPACES_KEY}/${id}`
}

/** Every application, for admins. */
export const ADMIN_WORKSPACES_KEY = `${API_URL}/admin/workspaces`

/** One application with signed proof image URLs, for admins. */
export function adminWorkspaceKey(id: string) {
  return `${ADMIN_WORKSPACES_KEY}/${id}`
}

export type MapBounds = { minLng: number; minLat: number; maxLng: number; maxLat: number }

/** Public: approved restaurants inside a map viewport, sorted by proximity when location is set. */
export function restaurantsInViewKey(bounds: MapBounds, userLocation?: LngLat | null) {
  const params = new URLSearchParams({
    minLng: bounds.minLng.toFixed(3),
    minLat: bounds.minLat.toFixed(3),
    maxLng: bounds.maxLng.toFixed(3),
    maxLat: bounds.maxLat.toFixed(3),
  })
  if (userLocation) {
    params.set("userLng", userLocation.longitude.toFixed(4))
    params.set("userLat", userLocation.latitude.toFixed(4))
  }
  return `${API_URL}/restaurants?${params}`
}

export function workspaceMenuKey(id: string) {
  return `${workspaceKey(id)}/menu`
}

export function workspaceMenuImageUploadsKey(id: string) {
  return `${workspaceKey(id)}/menu/image-uploads`
}

export function publicRestaurantMenuKey(pageUserId: string) {
  return `${API_URL}/restaurants/${pageUserId}/menu`
}

export function searchRestaurantMenuKey(q: string, cursor?: string, limit = 15) {
  const params = new URLSearchParams({ q, limit: String(limit) })
  if (cursor) params.set("cursor", cursor)
  return `${API_URL}/restaurants/menu/search?${params}`
}

export function restaurantReviewsPrefix(pageUserId: string) {
  return `${API_URL}/restaurants/${pageUserId}/reviews`
}

export function restaurantReviewsKey(
  pageUserId: string,
  sort: RestaurantReviewSort,
  page: number,
  limit = 10
) {
  const params = new URLSearchParams({
    sort,
    page: String(page),
    limit: String(limit),
  })
  return `${restaurantReviewsPrefix(pageUserId)}?${params}`
}

export function myRestaurantReviewKey(pageUserId: string) {
  return `${restaurantReviewsPrefix(pageUserId)}/me`
}

export const WORKSPACES_PATH = "/home/pages"
export const NEW_WORKSPACE_PATH = "/home/pages/new"
export const RESTAURANTS_PATH = "/home/restaurants"

export function workspacePath(id: string) {
  return `${WORKSPACES_PATH}/${id}`
}
