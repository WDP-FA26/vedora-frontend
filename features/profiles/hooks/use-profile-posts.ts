"use client"

import useSWR from "swr"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { fetchPostPage } from "@/features/posts/lib/posts-api"
import { authorPostsKey } from "@/features/posts/posts-cache"

/** First page of the published posts by profile `id`, newest first. Works signed out. */
export function useProfilePosts(id: string) {
  const { accessToken } = useAuth()
  const { data, error, isLoading, mutate } = useSWR(
    [authorPostsKey(id), accessToken] as const,
    fetchPostPage
  )
  return {
    posts: data?.items ?? [],
    error,
    isLoading,
    retry: () => mutate(),
  }
}
