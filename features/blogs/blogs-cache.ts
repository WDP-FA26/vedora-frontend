import { API_URL } from "@/features/auth/lib/api"

/** Base URL of the blogs API. */
export const BLOGS_KEY = `${API_URL}/blogs`

/** The signed-in user (fetched with `fetchBlogPage` as `[key, accessToken]`)'s blogs, drafts included, newest first. */
export const MY_BLOGS_KEY = `${BLOGS_KEY}/mine?limit=50`

export function blogKey(id: string) {
  return `${BLOGS_KEY}/${id}`
}

/** The list lives in the app shell; the editor is a full-screen page outside it. */
export const BLOGS_PATH = "/home/blogs"
export const NEW_BLOG_PATH = "/blogs/new"

export function editBlogPath(id: string) {
  return `/blogs/${id}/edit`
}
