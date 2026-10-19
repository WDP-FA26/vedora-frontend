"use client"

import useSWR, { useSWRConfig } from "swr"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import { fetchPost, fetchPostPage } from "@/features/posts/lib/posts-api"
import { POSTS_KEY, postKey } from "@/features/posts/posts-cache"
import type { ApiPost, PostPage } from "@/features/posts/schemas"

/** First page of published posts from vedora-api. */
export function useFeedPosts() {
  const { data, error, isLoading } = useAuthedSWR(POSTS_KEY, fetchPostPage)
  return { posts: data?.items ?? [], error, isLoading }
}

/** One post by id. Works signed out for published posts. */
export function usePost(id: string) {
  const { accessToken } = useAuth()
  const { data, error, isLoading } = useSWR(
    [postKey(id), accessToken] as const,
    fetchPost
  )
  return { post: data ?? null, error, isLoading }
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
 * Polls the author's PROCESSING post until Cloudinary finishes, then updates
 * it in the feed. `GET /posts/:id` is also what advances it when the API runs
 * without Cloudinary notifications.
 *
 * SWR asks `refreshInterval` whether to start polling only on mount, before
 * the first response, so it must keep polling while `latest` is undefined.
 */
export function useProcessingPost(id: string) {
  const upsert = useUpsertFeedPost()

  useAuthedSWR(postKey(id), fetchPost, {
    refreshInterval: (latest) =>
      !latest || latest.status === "PROCESSING" ? 3000 : 0,
    onSuccess: (post) => {
      if (post.status !== "PROCESSING") void upsert(post)
    },
  })
}
