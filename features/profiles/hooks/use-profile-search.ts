"use client"

import useSWRInfinite from "swr/infinite"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { fetchProfileSearchPage } from "@/features/profiles/lib/profiles-api"
import { searchProfilesKey } from "@/features/profiles/profiles-cache"
import type { ProfileSearchPage } from "@/features/profiles/schemas"

/** Active verified profiles matching `q` via BM25, best match first, a page at a time. */
export function useProfileSearch(q: string, limit = 20) {
  const { accessToken } = useAuth()
  const { data, error, isLoading, isValidating, size, setSize } = useSWRInfinite(
    (_index: number, previous: ProfileSearchPage | null) => {
      if (!q) return null
      if (previous && !previous.nextCursor) return null
      return [searchProfilesKey(q, limit, previous?.nextCursor ?? undefined), accessToken] as const
    },
    fetchProfileSearchPage
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
