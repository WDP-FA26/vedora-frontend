import { BLOGS_KEY, blogKey } from "@/features/blogs/blogs-cache"
import { apiBlogSchema, blogPageSchema, type BlogInput } from "@/features/blogs/schemas"
import { send, sendJson } from "@/features/shared/lib/api-client"

/** SWR fetcher for `[blogKey(id), accessToken]`. Guests may read published blogs. */
export function fetchBlog([url, token]: readonly [string, string | undefined]) {
  return sendJson(apiBlogSchema, url, token)
}

/** SWR fetcher for `[myBlogsKey(...), accessToken]` pages. */
export function fetchBlogPage([url, token]: readonly [string, string | undefined]) {
  return sendJson(blogPageSchema, url, token)
}

/** New blogs start as drafts unless `status` says otherwise. */
export function createBlog(token: string, input: BlogInput) {
  return sendJson(apiBlogSchema, BLOGS_KEY, token, {
    method: "POST",
    body: JSON.stringify(input),
  })
}

/** Changes only the fields sent; the API refuses an empty body. */
export function updateBlog(token: string, id: string, input: BlogInput) {
  return sendJson(apiBlogSchema, blogKey(id), token, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
}

/** Removes the blog with its comments, likes, bookmarks and recipe links. */
export async function deleteBlog(token: string, id: string) {
  await send(blogKey(id), token, { method: "DELETE" })
}
