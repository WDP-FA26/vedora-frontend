import { API_URL } from "@/features/auth/lib/api"

export const BLOGS_KEY = `${API_URL}/blogs`

export const MY_BLOGS_KEY = `${BLOGS_KEY}/mine?limit=50`

export const MY_BLOG_DRAFTS_KEY = `${BLOGS_KEY}/mine?status=DRAFT&limit=50`

export function blogKey(id: string) {
  return `${BLOGS_KEY}/${id}`
}

export const BLOGS_PATH = "/home/blogs"
export const NEW_BLOG_PATH = "/blogs/new"

export function editBlogPath(id: string) {
  return `/blogs/${id}/edit`
}

export function newBlogDraftPath(id: string) {
  return `${NEW_BLOG_PATH}?id=${encodeURIComponent(id)}`
}
