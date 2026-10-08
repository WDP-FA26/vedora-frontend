"use client"

import useSWR, { useSWRConfig } from "swr"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { POSTS_KEY } from "@/features/posts/posts-cache"
import { fetchProfile } from "@/features/profiles/lib/profiles-api"
import { MY_PROFILE_KEY, profileKey } from "@/features/profiles/profiles-cache"
import type { ApiProfile } from "@/features/profiles/schemas"

/** A public profile by user id. Works signed out. */
export function useProfile(id: string) {
  const { accessToken } = useAuth()
  const { data, error, isLoading, mutate } = useSWR(
    [profileKey(id), accessToken] as const,
    fetchProfile
  )
  return { profile: data ?? null, error, isLoading, retry: () => mutate() }
}

/**
 * Writes the signed-in user's profile, as returned by an edit, into both keys
 * it is cached under, then refreshes `useAuth()` and the cached posts, which
 * carry their author's name and username.
 */
export function useSetMyProfile() {
  const { accessToken, mutate: refreshAuth } = useAuth()
  const { mutate } = useSWRConfig()

  return async (profile: ApiProfile) => {
    await Promise.all([
      mutate([MY_PROFILE_KEY, accessToken], profile, { revalidate: false }),
      mutate([profileKey(profile.id), accessToken], profile, { revalidate: false }),
    ])
    void refreshAuth()
    void mutate((key) => Array.isArray(key) && String(key[0]).startsWith(POSTS_KEY))
  }
}
