import { API_URL } from "@/features/auth/lib/api"

export const PROFILES_KEY = `${API_URL}/profiles`

export const MY_PROFILE_KEY = `${PROFILES_KEY}/me`

export function profileKey(id: string) {
  return `${PROFILES_KEY}/${id}`
}

export function profilePath(id: string) {
  return `/profile/${id}`
}

export function relationshipKey(id: string) {
  return `${profileKey(id)}/relationship`
}

export type ProfileListKind = "followers" | "following"

export function profileListKey(id: string, kind: ProfileListKind) {
  return `${profileKey(id)}/${kind}`
}

export function suggestionsKey(limit: number) {
  return `${PROFILES_KEY}/suggestions?limit=${limit}`
}

export function searchProfilesKey(q: string, limit = 20, cursor?: string) {
  const params = new URLSearchParams({ q, limit: String(limit) })
  if (cursor) params.set("cursor", cursor)
  return `${PROFILES_KEY}/search?${params}`
}
