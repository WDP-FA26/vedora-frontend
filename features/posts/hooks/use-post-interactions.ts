"use client"

import { usePathname, useRouter } from "next/navigation"
import { useSWRConfig } from "swr"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { setPostBookmark, setPostLike, setPostRepost } from "@/features/posts/lib/posts-api"
import { POSTS_KEY } from "@/features/posts/posts-cache"
import type { ApiPost, PostPage } from "@/features/posts/schemas"

type PostPatch = (post: ApiPost) => Partial<ApiPost>

const isPostsKey = (key: unknown) =>
  Array.isArray(key) && typeof key[0] === "string" && key[0].startsWith(POSTS_KEY)

/**
 * Likes, reposts and saved posts for the signed-in user. A post can sit in several caches
 * at once (feed, profile, its own page), so changes are written to all of
 * them: first optimistically, then with the counts the API returns.
 */
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

  /** Runs `request` around an optimistic `change`, undone with `revert` if it fails. */
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
  }
}
