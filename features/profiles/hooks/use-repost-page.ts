"use client"

import useSWR from "swr"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { fetchPostPage } from "@/features/posts/lib/posts-api"
import { repostedByKey } from "@/features/posts/posts-cache"

/**
 * One page of the posts profile `userId` reposted. Each page has its own key under
 * `POSTS_KEY`, so likes and reposts made elsewhere reach it. Works signed out.
 */
export function useRepostPage(userId: string, cursor?: string) {
  const { accessToken } = useAuth()
  const { data, error, isLoading, mutate } = useSWR(
    [repostedByKey(userId, cursor), accessToken] as const,
    fetchPostPage
  )
  return {
    posts: data?.items ?? [],
    nextCursor: data?.nextCursor ?? null,
    error,
    isLoading,
    retry: () => mutate(),
  }
}
