import { API_URL } from "@/features/auth/lib/api"
import type { BlogStatus } from "@/features/blogs/schemas"

/**
 * SWR keys for blogs. Keys are `[url, accessToken]` tuples, so one account's
 * drafts are never served from another account's cache; signing in clears the
 * whole cache as well.
 */
export const BLOGS_KEY = `${API_URL}/blogs`

/** The full article; drafts only for their author. */
export function blogKey(id: string) {
  return `${BLOGS_KEY}/${id}`
}

/** One page of the caller's own blogs, drafts included. */
export function myBlogsKey(status: BlogStatus | null, cursor?: string | null) {
  const params = new URLSearchParams({ limit: "20" })
  if (status) params.set("status", status)
  if (cursor) params.set("cursor", cursor)
  return `${BLOGS_KEY}/mine?${params}`
}

/** The public page of blog `id`, also the link that "Chia sẻ" copies. */
export function blogPath(id: string) {
  return `/blogs/${id}`
}

export const MY_BLOGS_PATH = "/home/blogs"
export const NEW_BLOG_PATH = `${MY_BLOGS_PATH}/new`

export function editBlogPath(id: string) {
  return `${MY_BLOGS_PATH}/${id}/edit`
}

/**
 * Set on the edit page's URL after a new blog's first save, which navigates
 * there, so the new editor can say the draft was saved.
 */
export const FIRST_SAVE_PARAM = "saved"
