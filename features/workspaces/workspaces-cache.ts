import { API_URL } from "@/features/auth/lib/api"

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

/** Public: approved restaurants inside a map viewport. Rounded so panning a little reuses the cache. */
export function restaurantsInViewKey(bounds: MapBounds) {
  const params = new URLSearchParams({
    minLng: bounds.minLng.toFixed(3),
    minLat: bounds.minLat.toFixed(3),
    maxLng: bounds.maxLng.toFixed(3),
    maxLat: bounds.maxLat.toFixed(3),
  })
  return `${API_URL}/restaurants?${params}`
}

export const WORKSPACES_PATH = "/home/pages"
export const NEW_WORKSPACE_PATH = "/home/pages/new"
export const RESTAURANTS_PATH = "/home/restaurants"

export function workspacePath(id: string) {
  return `${WORKSPACES_PATH}/${id}`
}
