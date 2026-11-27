import { API_URL } from "@/features/auth/lib/api"
import type { LngLat, RestaurantReviewSort } from "@/features/workspaces/schemas"

const WORKSPACES_KEY = `${API_URL}/workspaces`

export const MY_WORKSPACES_KEY = `${WORKSPACES_KEY}/mine`

export const WORKSPACE_PROOF_UPLOADS_KEY = `${WORKSPACES_KEY}/proofs/uploads`

export const WORKSPACES_URL = WORKSPACES_KEY

export function workspaceKey(id: string) {
  return `${WORKSPACES_KEY}/${id}`
}

export const ADMIN_WORKSPACES_KEY = `${API_URL}/admin/workspaces`

export function adminWorkspaceKey(id: string) {
  return `${ADMIN_WORKSPACES_KEY}/${id}`
}

export function adminTaxCodeKey(id: string) {
  return `${adminWorkspaceKey(id)}/tax-code`
}

export function restaurantsKey(userLocation?: LngLat | null) {
  if (!userLocation) return `${API_URL}/restaurants`
  const params = new URLSearchParams({
    userLng: userLocation.longitude.toFixed(4),
    userLat: userLocation.latitude.toFixed(4),
  })
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
