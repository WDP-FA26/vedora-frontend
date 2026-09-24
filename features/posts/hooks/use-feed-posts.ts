"use client"

import useSWR, { useSWRConfig } from "swr"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { fetchPost, fetchPostPage } from "@/features/posts/lib/posts-api"
import { POSTS_KEY, postKey } from "@/features/posts/posts-cache"
import type { ApiPost, PostPage } from "@/features/posts/schemas"

/** First page of published posts from vedora-api. */
export function useFeedPosts() {
  const { accessToken } = useAuth()
  const { data, error, isLoading } = useSWR(
    accessToken ? ([POSTS_KEY, accessToken] as const) : null,
    fetchPostPage
  )
  return { posts: data?.items ?? [], error, isLoading }
}

/** Writes a post into the cached feed: prepends it, or replaces it by id. */
export function useUpsertFeedPost() {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()

  return (post: ApiPost) =>
    mutate(
      [POSTS_KEY, accessToken],
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
}

/**
 * Polls the author's PROCESSING post until Mux finishes, then updates it in
 * the feed. `GET /posts/:id` is also what advances it when the API runs
 * without Mux webhooks (local dev).
 */
export function useProcessingPost(id: string) {
  const { accessToken } = useAuth()
  const upsert = useUpsertFeedPost()

  useSWR(accessToken ? ([postKey(id), accessToken] as const) : null, fetchPost, {
    refreshInterval: (latest) => (latest?.status === "PROCESSING" ? 3000 : 0),
    onSuccess: (post) => {
      if (post.status !== "PROCESSING") void upsert(post)
    },
  })
}
