"use client"

import useSWR from "swr"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { fetchPostPage } from "@/features/posts/lib/posts-api"
import { repostedByKey } from "@/features/posts/posts-cache"

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
