import { API_URL } from "@/features/auth/lib/api"

/**
 * SWR keys for posts. Keys are `[url, accessToken]` tuples fetched with
 * `fetchPostPage` / `fetchPost`, like `useAuth()` does for `/auth/me`.
 */
export const POSTS_KEY = `${API_URL}/posts`

/** First page of the signed-in user's "Dành cho bạn" feed, ranked by the API. */
export const FOR_YOU_KEY = `${POSTS_KEY}/feed?limit=20`

/** First page of one author's published posts. */
export function authorPostsKey(authorId: string) {
  return `${POSTS_KEY}?authorId=${authorId}&limit=20`
}

/** The posts the signed-in user saved, most recently saved first. */
export const BOOKMARKS_KEY = `${POSTS_KEY}/bookmarks?limit=50`

/** Tabs of the `/home/bookmarks` page, kept in `?tab=`. */
export const BOOKMARK_TABS = ["posts", "recipes"] as const
export type BookmarkTab = (typeof BOOKMARK_TABS)[number]

export function isBookmarkTab(value: unknown): value is BookmarkTab {
  return BOOKMARK_TABS.some((tab) => tab === value)
}

/** One page of posts matching `q`, best match first; `cursor` comes from the previous page. */
export function searchPostsKey(q: string, cursor?: string) {
  const params = new URLSearchParams({ q, limit: "20" })
  if (cursor) params.set("cursor", cursor)
  return `${POSTS_KEY}/search?${params}`
}

export function postKey(id: string) {
  return `${POSTS_KEY}/${id}`
}

/** First page of the comments on post `id`, newest first. Guests may read it. */
export function commentsKey(id: string) {
  return `${postKey(id)}/comments`
}

/** The public page of post `id`, also the link that "Chia sẻ" copies. */
export function postPath(id: string) {
  return `/posts/${id}`
}

/** Id of the comment thread on a post's page. */
export const COMMENTS_ANCHOR = "comments"

/** The comment thread on post `id`'s page. */
export function commentsPath(id: string) {
  return `${postPath(id)}#${COMMENTS_ANCHOR}`
}
