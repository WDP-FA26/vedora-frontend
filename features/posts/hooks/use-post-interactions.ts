"use client"

import { usePathname, useRouter } from "next/navigation"
import { useSWRConfig } from "swr"

import { useAuth } from "@/features/auth/hooks/use-auth"
import {
  fetchPost,
  setPostBookmark,
  setPostLike,
  setPostRepost,
} from "@/features/posts/lib/posts-api"
import { POSTS_KEY, postKey } from "@/features/posts/posts-cache"
import type { ApiPost, PostPage } from "@/features/posts/schemas"

type PostPatch = (post: ApiPost) => Partial<ApiPost>

const isPostsKey = (key: unknown) =>
  Array.isArray(key) &&
  typeof key[0] === "string" &&
  key[0].startsWith(POSTS_KEY) &&
  !key[0].includes("/comments")

export function usePostInteractions() {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()
  const router = useRouter()
  const pathname = usePathname()

  function patch(id: string, change: PostPatch) {
    const apply = (post: ApiPost) => (post.id === id ? { ...post, ...change(post) } : post)
    return mutate(
      isPostsKey,
      (data: PostPage | ApiPost | undefined) => {
        if (!data) return data
        return "items" in data ? { ...data, items: data.items.map(apply) } : apply(data)
      },
      { revalidate: false }
    )
  }

  async function toggle(
    id: string,
    change: PostPatch,
    revert: PostPatch,
    request: (token: string) => Promise<Partial<ApiPost>>
  ) {
    if (!accessToken) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`)
      return
    }
    void patch(id, change)
    try {
      const saved = await request(accessToken)
      void patch(id, () => saved)
    } catch {
      void patch(id, revert)
    }
  }

  return {
    setLiked: (id: string, liked: boolean) =>
      toggle(
        id,
        (post) => ({ isLiked: liked, likeCount: post.likeCount + (liked ? 1 : -1) }),
        (post) => ({ isLiked: !liked, likeCount: post.likeCount + (liked ? -1 : 1) }),
        (token) => setPostLike(token, id, liked)
      ),
    setReposted: (id: string, reposted: boolean) =>
      toggle(
        id,
        (post) => ({
          isReposted: reposted,
          repostCount: post.repostCount + (reposted ? 1 : -1),
        }),
        (post) => ({
          isReposted: !reposted,
          repostCount: post.repostCount + (reposted ? -1 : 1),
        }),
        (token) => setPostRepost(token, id, reposted)
      ),
    setBookmarked: (id: string, bookmarked: boolean) =>
      toggle(
        id,
        () => ({ isBookmarked: bookmarked }),
        () => ({ isBookmarked: !bookmarked }),
        (token) => setPostBookmark(token, id, bookmarked)
      ),
    refreshCommentCount: async (id: string) => {
      const post = await fetchPost([postKey(id), accessToken])
      await patch(id, () => ({ commentCount: post.commentCount }))
    },
    countComment: (id: string, delta: number) =>
      patch(id, (post) => ({
        commentCount: Math.max(0, post.commentCount + delta),
      })),
  }
}
