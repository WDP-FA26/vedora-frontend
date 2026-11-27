"use client"

import useSWR, { useSWRConfig } from "swr"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import { fetchPost, fetchPostPage } from "@/features/posts/lib/posts-api"
import { FOLLOWING_KEY, FOR_YOU_KEY, POSTS_KEY, postKey } from "@/features/posts/posts-cache"
import type { ApiPost, PostPage } from "@/features/posts/schemas"

export function useFeedPosts() {
  const { data, error, isLoading } = useAuthedSWR(POSTS_KEY, fetchPostPage)
  return { posts: data?.items ?? [], error, isLoading }
}

export function useForYouPosts() {
  const { data, error, isLoading } = useAuthedSWR(FOR_YOU_KEY, fetchPostPage)
  return { posts: data?.items ?? [], error, isLoading }
}

export function useFollowingPosts() {
  const { data, error, isLoading } = useAuthedSWR(FOLLOWING_KEY, fetchPostPage)
  return { posts: data?.items ?? [], error, isLoading }
}

export function usePost(id: string) {
  const { accessToken } = useAuth()
  const { data, error, isLoading } = useSWR(
    [postKey(id), accessToken] as const,
    fetchPost
  )
  return { post: data ?? null, error, isLoading }
}

export function useUpsertFeedPost() {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()

  return (post: ApiPost) =>
    Promise.all(
      [POSTS_KEY, FOR_YOU_KEY].map((url) =>
        mutate(
          [url, accessToken],
          (page: PostPage | undefined): PostPage => {
            const items = page?.items ?? []
            return {
              nextCursor: page?.nextCursor ?? null,
              items: items.some((item) => item.id === post.id)
                ? items.map((item) => (item.id === post.id ? post : item))
                : [post, ...items],
            }
          },
          { revalidate: false }
        )
      )
    )
}

export function useProcessingPost(id: string) {
  const upsert = useUpsertFeedPost()

  useAuthedSWR(postKey(id), fetchPost, {
    refreshInterval: (latest) =>
      !latest || latest.status === "PROCESSING" ? 3000 : 0,
    onSuccess: (post) => {
      if (post.status === "PUBLISHED") {
        void upsert(post)
      }
    },
  })
}
