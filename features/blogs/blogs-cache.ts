import { API_URL } from "@/features/auth/lib/api"

/** Base URL of the blogs API. */
export const BLOGS_KEY = `${API_URL}/blogs`

/** The signed-in user (fetched with `fetchBlogPage` as `[key, accessToken]`)'s blogs, drafts included, newest first. */
export const MY_BLOGS_KEY = `${BLOGS_KEY}/mine?limit=50`

/** The signed-in user's unpublished blogs only (same fetcher as `MY_BLOGS_KEY`). */
export const MY_BLOG_DRAFTS_KEY = `${BLOGS_KEY}/mine?status=DRAFT&limit=50`

export function blogKey(id: string) {
  return `${BLOGS_KEY}/${id}`
}

/** The list lives in the app shell; the editor is a full-screen page outside it. */
export const BLOGS_PATH = "/home/blogs"
export const NEW_BLOG_PATH = "/blogs/new"

export function editBlogPath(id: string) {
  return `/blogs/${id}/edit`
}

/**
 * A blog started at `NEW_BLOG_PATH`, once saved. It keeps that route so a
 * `router.refresh()` (e.g. rotating an expired token) re-renders the same
 * page and keeps the editor and the assistant chat mounted.
 */
export function newBlogDraftPath(id: string) {
  return `${NEW_BLOG_PATH}?id=${encodeURIComponent(id)}`
}
