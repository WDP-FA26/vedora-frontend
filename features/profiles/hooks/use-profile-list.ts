"use client"

import useSWRInfinite from "swr/infinite"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { fetchProfilePage } from "@/features/profiles/lib/profiles-api"
import { profileListKey, type ProfileListKind } from "@/features/profiles/profiles-cache"
import type { ProfilePage } from "@/features/profiles/schemas"

/** A profile's followers or following, loaded a page at a time. Works signed out. */
export function useProfileList(id: string, kind: ProfileListKind) {
  const { accessToken } = useAuth()
  const { data, error, isLoading, isValidating, size, setSize } = useSWRInfinite(
    (_index: number, previous: ProfilePage | null) => {
      // The last page has no cursor.
      if (previous && !previous.nextCursor) return null
      const cursor = previous?.nextCursor
      const url = profileListKey(id, kind)
      return [cursor ? `${url}?cursor=${cursor}` : url, accessToken] as const
    },
    fetchProfilePage
  )

  const pages = data ?? []
  return {
    profiles: pages.flatMap((page) => page.items),
    hasMore: Boolean(pages.at(-1)?.nextCursor),
    loadMore: () => setSize(size + 1),
    error,
    isLoading,
    isLoadingMore: isValidating && size > pages.length,
  }
}
