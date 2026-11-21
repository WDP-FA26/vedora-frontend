"use client"

import useSWRInfinite from "swr/infinite"

import { fetchMenuSearchPage } from "@/features/workspaces/lib/workspaces-api"
import type { RestaurantMenuSearchPage } from "@/features/workspaces/schemas"
import { searchRestaurantMenuKey } from "@/features/workspaces/workspaces-cache"

/** Available dishes from approved restaurants matching `q`, ranked by hybrid search. */
export function useMenuSearch(q: string, limit = 15) {
  const { data, error, isLoading, isValidating, size, setSize } = useSWRInfinite(
    (_index: number, previous: RestaurantMenuSearchPage | null) => {
      if (!q) return null
      if (previous && !previous.nextCursor) return null
      return searchRestaurantMenuKey(q, previous?.nextCursor ?? undefined, limit)
    },
    fetchMenuSearchPage
  )

  const pages = data ?? []
  return {
    items: pages.flatMap((page) => page.items),
    hasMore: Boolean(pages.at(-1)?.nextCursor),
    loadMore: () => setSize(size + 1),
    error,
    isLoading,
    isLoadingMore: isValidating && size > pages.length,
  }
}
