import { API_URL } from "@/features/auth/lib/api"

export const ADMIN_USERS_KEY = `${API_URL}/users`

export function adminUsersKey({ q, status }: { q?: string; status?: string }) {
  const params = new URLSearchParams()
  if (q) params.set("q", q)
  if (status) params.set("status", status)
  const query = params.toString()
  return query ? `${ADMIN_USERS_KEY}?${query}` : ADMIN_USERS_KEY
}

export const ADMIN_POSTS_KEY = `${API_URL}/admin/posts`

export function adminPostKey(id: string) {
  return `${ADMIN_POSTS_KEY}/${id}`
}

export const ADMIN_REPORTS_KEY = `${API_URL}/admin/reports`

export const MODERATION_SETTINGS_KEY = `${API_URL}/admin/moderation/settings`
