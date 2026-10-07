import { API_URL } from "@/features/auth/lib/api"
import { send, sendJson } from "@/features/shared/lib/api-client"
import { postKey } from "@/features/posts/posts-cache"
import {
  apiPostSchema,
  postLikeSchema,
  postPageSchema,
  postRepostSchema,
  videoUploadSchema,
  type ReportReason,
} from "@/features/posts/schemas"

/** SWR fetcher for `[POSTS_KEY | authorPostsKey(id), accessToken]`. Guests may list posts. */
export function fetchPostPage([url, token]: readonly [string, string | undefined]) {
  return sendJson(postPageSchema, url, token)
}

/** SWR fetcher for `[postKey(id), accessToken]`. Guests may read published posts. */
export function fetchPost([url, token]: readonly [string, string | undefined]) {
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

/** Both are idempotent: PUT sets the state, DELETE clears it. */
export function setPostLike(token: string, id: string, liked: boolean) {
  return sendJson(postLikeSchema, `${postKey(id)}/like`, token, {
    method: liked ? "PUT" : "DELETE",
  })
}

export function setPostRepost(token: string, id: string, reposted: boolean) {
  return sendJson(postRepostSchema, `${postKey(id)}/repost`, token, {
    method: reposted ? "PUT" : "DELETE",
  })
}

export async function reportPost(
  token: string,
  id: string,
  input: { reason: ReportReason; details?: string }
) {
  await send(`${postKey(id)}/report`, token, {
    method: "POST",
    body: JSON.stringify(input),
  })
}
