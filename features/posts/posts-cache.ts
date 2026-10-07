import { API_URL } from "@/features/auth/lib/api"

/**
 * SWR keys for posts. Keys are `[url, accessToken]` tuples fetched with
 * `fetchPostPage` / `fetchPost`, like `useAuth()` does for `/auth/me`.
 */
export const POSTS_KEY = `${API_URL}/posts`

/** First page of one author's published posts. */
export function authorPostsKey(authorId: string) {
  return `${POSTS_KEY}?authorId=${authorId}&limit=20`
}

export function postKey(id: string) {
  return `${POSTS_KEY}/${id}`
}

/** The public page of post `id`, also the link that "Chia sẻ" copies. */
export function postPath(id: string) {
  return `/posts/${id}`
}
