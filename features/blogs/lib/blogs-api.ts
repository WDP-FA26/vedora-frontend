import { BLOGS_KEY, blogKey } from "@/features/blogs/blogs-cache"
import {
  apiBlogSchema,
  blogImageUploadSchema,
  blogPageSchema,
  blogVideoUploadSchema,
  type BlogStatus,
} from "@/features/blogs/schemas"
import { sendJson } from "@/features/shared/lib/api-client"

/** SWR fetcher for `[MY_BLOGS_KEY, accessToken]`. */
export function fetchBlogPage([url, token]: readonly [string, string | undefined]) {
  return sendJson(blogPageSchema, url, token)
}

export type BlogInput = {
  title?: string
  content?: string
  status?: BlogStatus
  /** `null` clears the cover (PATCH only). */
  coverImageUrl?: string | null
}

export function createBlog(token: string, input: BlogInput) {
  return sendJson(apiBlogSchema, BLOGS_KEY, token, { method: "POST", body: JSON.stringify(input) })
}

export function updateBlog(token: string, id: string, input: BlogInput) {
  return sendJson(apiBlogSchema, blogKey(id), token, { method: "PATCH", body: JSON.stringify(input) })
}

export function requestBlogImageUpload(token: string, file: File) {
  return sendJson(blogImageUploadSchema, `${BLOGS_KEY}/images/uploads`, token, {
    method: "POST",
    body: JSON.stringify({ contentType: file.type, sizeBytes: file.size }),
  })
}

export function requestBlogVideoUpload(token: string) {
  return sendJson(blogVideoUploadSchema, `${BLOGS_KEY}/videos/uploads`, token, { method: "POST" })
}

