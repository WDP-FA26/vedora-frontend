"use client"

import useSWRInfinite from "swr/infinite"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { fetchCommentPage } from "@/features/posts/lib/posts-api"
import { postKey } from "@/features/posts/posts-cache"
import type { CommentPage } from "@/features/posts/schemas"

export function useComments(postId: string) {
  const { accessToken } = useAuth()
  const { data, error, isLoading, isValidating, size, setSize, mutate } =
    useSWRInfinite(
      (index: number, previous: CommentPage | null) => {
        if (index > 0 && !previous?.nextCursor) return null
        const query = new URLSearchParams({ limit: "20" })
        if (previous?.nextCursor) query.set("cursor", previous.nextCursor)
        return [
          `${postKey(postId)}/comments?${query}`,
          accessToken ?? "",
        ] as const
      },
      fetchCommentPage,
      { shouldRetryOnError: false },
    )

  async function reload() {
    // A deleted cursor cannot be reused. Mutations restart at the first page.
    await setSize(1)
    await mutate()
  }

  const comments = [
    ...new Map(
      (data ?? [])
        .flatMap((page) => page.items)
        .map((comment) => [comment.id, comment]),
    ).values(),
  ]
  return {
    comments,
    error,
    isLoading,
    isValidating,
    hasMore: Boolean(data?.[data.length - 1]?.nextCursor),
    loadMore: async () => {
      try {
        await setSize(size + 1)
      } catch {
        /* SWR stores the error; the thread renders its retry control. */
      }
    },
    reload,
  }
}
