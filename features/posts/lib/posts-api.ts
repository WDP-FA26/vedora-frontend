import { API_URL } from "@/features/auth/lib/api"
import { send, sendJson } from "@/features/shared/lib/api-client"
import {
  apiPostSchema,
  postPageSchema,
  videoUploadSchema,
} from "@/features/posts/schemas"

/** SWR fetcher for `[POSTS_KEY | authorPostsKey(id), accessToken]`. Guests may list posts. */
export function fetchPostPage([url, token]: readonly [string, string | undefined]) {
  return sendJson(postPageSchema, url, token)
}

/** SWR fetcher for `[postKey(id), accessToken]`. */
export function fetchPost([url, token]: readonly [string, string]) {
  return sendJson(apiPostSchema, url, token)
}

export function requestVideoUpload(token: string) {
  return sendJson(videoUploadSchema, `${API_URL}/media/uploads`, token, {
    method: "POST",
    body: JSON.stringify({ type: "VIDEO" }),
  })
}

/** `keepalive` lets the request finish even if the page is closing. */
export async function discardMedia(token: string, id: string) {
  await send(`${API_URL}/media/${id}`, token, { method: "DELETE", keepalive: true })
}

export function createPost(token: string, input: { body?: string; mediaIds?: string[] }) {
  return sendJson(apiPostSchema, `${API_URL}/posts`, token, {
    method: "POST",
    body: JSON.stringify({ type: "POST", ...input }),
  })
}
