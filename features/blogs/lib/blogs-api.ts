import { BLOGS_KEY, blogKey } from "@/features/blogs/blogs-cache"
import {
  apiBlogSchema,
  blogImageUploadSchema,
  blogPageSchema,
  blogVideoUploadSchema,
  type BlogStatus,
} from "@/features/blogs/schemas"
import { send, sendJson } from "@/features/shared/lib/api-client"

export function fetchBlog([url, token]: readonly [string, string | undefined]) {
  return sendJson(apiBlogSchema, url, token)
}

export function fetchBlogPage([url, token]: readonly [string, string | undefined]) {
  return sendJson(blogPageSchema, url, token)
}

export type BlogInput = {
  title?: string
  content?: string
  status?: BlogStatus
  coverImageUrl?: string | null
}

export function createBlog(token: string, input: BlogInput) {
  return sendJson(apiBlogSchema, BLOGS_KEY, token, { method: "POST", body: JSON.stringify(input) })
}

export function updateBlog(token: string, id: string, input: BlogInput) {
  return sendJson(apiBlogSchema, blogKey(id), token, { method: "PATCH", body: JSON.stringify(input) })
}

export async function deleteBlog(token: string, id: string) {
  await send(blogKey(id), token, { method: "DELETE" })
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

