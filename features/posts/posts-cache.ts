import { API_URL } from "@/features/auth/lib/api"

/**
 * SWR keys for posts. Keys are `[url, accessToken]` tuples fetched with
 * `fetchPostPage` / `fetchPost`, like `useAuth()` does for `/auth/me`.
 */
export const POSTS_KEY = `${API_URL}/posts`

export function postKey(id: string) {
  return `${POSTS_KEY}/${id}`
}
