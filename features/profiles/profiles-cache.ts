import { API_URL } from "@/features/auth/lib/api"

/**
 * SWR keys for profiles. Keys are `[url, accessToken]` tuples fetched with the
 * fetchers in `profiles-api.ts`, like `POSTS_KEY` is for posts.
 */
export const PROFILES_KEY = `${API_URL}/profiles`

/** The signed-in user's own profile. */
export const MY_PROFILE_KEY = `${PROFILES_KEY}/me`

export function profileKey(id: string) {
  return `${PROFILES_KEY}/${id}`
}

/** The page of profile `id`. Ids stay stable when a username changes. */
export function profilePath(id: string) {
  return `/profile/${id}`
}

/** Whether the signed-in user follows profile `id`. */
export function relationshipKey(id: string) {
  return `${profileKey(id)}/relationship`
}

export type ProfileListKind = "followers" | "following"

/** First page of a profile's followers or following; later pages add `?cursor=`. */
export function profileListKey(id: string, kind: ProfileListKind) {
  return `${profileKey(id)}/${kind}`
}
