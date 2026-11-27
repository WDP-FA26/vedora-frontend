"use client"

import useSWRInfinite from "swr/infinite"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { fetchPostPage } from "@/features/posts/lib/posts-api"
import { searchPostsKey } from "@/features/posts/posts-cache"
import type { PostPage } from "@/features/posts/schemas"

export function usePostSearch(q: string) {
  const { accessToken } = useAuth()
  const { data, error, isLoading, isValidating, size, setSize } = useSWRInfinite(
    (_index: number, previous: PostPage | null) => {
      if (!q) return null
      if (previous && !previous.nextCursor) return null
      return [searchPostsKey(q, previous?.nextCursor ?? undefined), accessToken] as const
    },
    fetchPostPage
  )

  const pages = data ?? []
  return {
    posts: pages.flatMap((page) => page.items),
    hasMore: Boolean(pages.at(-1)?.nextCursor),
    loadMore: () => setSize(size + 1),
    error,
    isLoading,
    isLoadingMore: isValidating && size > pages.length,
  }
}
