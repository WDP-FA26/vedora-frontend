import { API_URL } from "@/features/auth/lib/api"

/** SWR key for the admin user list: `[url, accessToken]`, fetched with `fetchAllUsers`. */
export const ADMIN_USERS_KEY = `${API_URL}/users`

/** The user list narrowed by the API: `q` matches username, name or email; `status` is exact. */
export function adminUsersKey({ q, status }: { q?: string; status?: string }) {
  const params = new URLSearchParams()
  if (q) params.set("q", q)
  if (status) params.set("status", status)
  const query = params.toString()
  return query ? `${ADMIN_USERS_KEY}?${query}` : ADMIN_USERS_KEY
}

/** Every post whatever its status: `[url, accessToken]`, fetched with `fetchAllPosts`. */
export const ADMIN_POSTS_KEY = `${API_URL}/admin/posts`

/** One post with the caption tracks of its videos. */
export function adminPostKey(id: string) {
  return `${ADMIN_POSTS_KEY}/${id}`
}

/** Every post report: `[url, accessToken]`, fetched with `fetchAllReports`. */
export const ADMIN_REPORTS_KEY = `${API_URL}/admin/reports`
