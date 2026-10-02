"use client"

import { useRouter } from "next/navigation"
import { useSWRConfig } from "swr"

import { useAuth } from "@/features/auth/hooks/use-auth"
import {
  ApiError,
  fetchPost,
  setPostLike,
} from "@/features/posts/lib/posts-api"
import { POSTS_KEY, postKey } from "@/features/posts/posts-cache"
import type { ApiPost, PostPage } from "@/features/posts/schemas"

/** Uses the session's token; a 401 asks the existing proxy to refresh it. */
export function usePostRequest() {
  const { accessToken } = useAuth()
  const router = useRouter()

  return async <T>(action: (token: string) => Promise<T>): Promise<T> => {
    if (!accessToken) {
      router.push("/login?next=%2Fhome")
      throw new ApiError(401, undefined, "Authentication required")
    }
    try {
      return await action(accessToken)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) router.refresh()
      throw error
    }
  }
}

export function usePostInteractions(postId: string) {
  const { accessToken } = useAuth()
  const request = usePostRequest()
  const { mutate } = useSWRConfig()

  async function patchPost(fields: Partial<ApiPost>) {
    await Promise.all([
      mutate(
        [POSTS_KEY, accessToken],
        (page: PostPage | undefined) =>
          page && {
            ...page,
            items: page.items.map((post) =>
              post.id === postId ? { ...post, ...fields } : post,
            ),
          },
        { revalidate: false },
      ),
      mutate(
        [postKey(postId), accessToken],
        (post: ApiPost | undefined) => post && { ...post, ...fields },
        { revalidate: false },
      ),
    ])
  }

  async function setLike(isLiked: boolean) {
    const result = await request((token) => setPostLike(token, postId, isLiked))
    await patchPost({ isLiked: result.isLiked, likeCount: result.likeCount })
  }

  async function refreshPost() {
    const post = await request((token) => fetchPost([postKey(postId), token]))
    await patchPost(post)
  }

  return { setLike, refreshPost }
}
