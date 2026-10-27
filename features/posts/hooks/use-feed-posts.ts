"use client"

import useSWR, { useSWRConfig } from "swr"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import { fetchPost, fetchPostPage } from "@/features/posts/lib/posts-api"
import { FOR_YOU_KEY, POSTS_KEY, postKey } from "@/features/posts/posts-cache"
import type { ApiPost, PostPage } from "@/features/posts/schemas"

/** First page of published posts from vedora-api. */
export function useFeedPosts() {
  const { data, error, isLoading } = useAuthedSWR(POSTS_KEY, fetchPostPage)
  return { posts: data?.items ?? [], error, isLoading }
}

/**
 * First page of "Dành cho bạn": recent posts like the ones the user liked,
 * saved or commented on, newest posts in between. Never the user's own.
 */
export function useForYouPosts() {
  const { data, error, isLoading } = useAuthedSWR(FOR_YOU_KEY, fetchPostPage)
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

/**
 * Writes a post into the cached feeds: prepends it, or replaces it by id.
 * "Dành cho bạn" never ranks the user's own posts, but a post they just
 * wrote still shows at its top until the next load.
 */
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
