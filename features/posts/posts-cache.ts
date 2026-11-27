import { API_URL } from "@/features/auth/lib/api"

export const POSTS_KEY = `${API_URL}/posts`

export const FOR_YOU_KEY = `${POSTS_KEY}/feed?limit=20`

export const FOLLOWING_KEY = `${POSTS_KEY}/following?limit=20`

export function authorPostsKey(authorId: string) {
  return `${POSTS_KEY}?authorId=${authorId}&limit=20`
}

export function repostedByKey(userId: string, cursor?: string) {
  const params = new URLSearchParams({ limit: "20" })
  if (cursor) params.set("cursor", cursor)
  return `${POSTS_KEY}/reposted-by/${userId}?${params}`
}

export const BOOKMARKS_KEY = `${POSTS_KEY}/bookmarks?limit=50`

export const BOOKMARK_TABS = ["posts", "recipes"] as const
export type BookmarkTab = (typeof BOOKMARK_TABS)[number]

export function isBookmarkTab(value: unknown): value is BookmarkTab {
  return BOOKMARK_TABS.some((tab) => tab === value)
}

export const SEARCH_TABS = ["all", "people", "recipes", "dishes", "posts"] as const
export type SearchTab = (typeof SEARCH_TABS)[number]

export function isSearchTab(value: unknown): value is SearchTab {
  return SEARCH_TABS.some((tab) => tab === value)
}

export function searchPostsKey(q: string, cursor?: string) {
  const params = new URLSearchParams({ q, limit: "20" })
  if (cursor) params.set("cursor", cursor)
  return `${POSTS_KEY}/search?${params}`
}

export function postKey(id: string) {
  return `${POSTS_KEY}/${id}`
}

export function commentsKey(id: string) {
  return `${postKey(id)}/comments`
}

export function postPath(id: string) {
  return `/posts/${id}`
}

export const COMMENTS_ANCHOR = "comments"

export function commentsPath(id: string) {
  return `${postPath(id)}#${COMMENTS_ANCHOR}`
}
