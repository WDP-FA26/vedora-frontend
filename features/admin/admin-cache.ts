import { API_URL } from "@/features/auth/lib/api"

/** SWR key for the admin user list: `[url, accessToken]`, fetched with `fetchAllUsers`. */
export const ADMIN_USERS_KEY = `${API_URL}/users`

/** Every post whatever its status: `[url, accessToken]`, fetched with `fetchAllPosts`. */
export const ADMIN_POSTS_KEY = `${API_URL}/admin/posts`

/** One post with the caption tracks of its videos. */
export function adminPostKey(id: string) {
  return `${ADMIN_POSTS_KEY}/${id}`
}

/** Every post report: `[url, accessToken]`, fetched with `fetchAllReports`. */
export const ADMIN_REPORTS_KEY = `${API_URL}/admin/reports`
