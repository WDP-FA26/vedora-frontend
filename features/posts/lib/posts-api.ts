import { API_URL } from "@/features/auth/lib/api"
import { send, sendJson } from "@/features/shared/lib/api-client"
import {
  apiPostSchema,
  apiCommentSchema,
  commentPageSchema,
  postLikeSchema,
  postPageSchema,
  videoUploadSchema,
} from "@/features/posts/schemas"

// Client Components call vedora-api directly with the token from `useAuth()`.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    /** Machine-readable reason, e.g. `UPLOAD_LIMIT_REACHED`. */
    readonly code: string | undefined,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

async function send(url: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (token) headers.set("Authorization", `Bearer ${token}`)
  if (init.body) headers.set("Content-Type", "application/json")

  const response = await fetch(url, { ...init, headers })
  if (!response.ok) {
    const error = apiErrorSchema.safeParse(
      await response.json().catch(() => null),
    )
    throw new ApiError(
      response.status,
      error.data?.code,
      error.success
        ? [error.data.message].flat().join("; ")
        : response.statusText,
    )
  }
  return response
}

async function sendJson<S extends z.ZodType>(
  schema: S,
  url: string,
  token: string,
  init?: RequestInit,
): Promise<z.infer<S>> {
  const response = await send(url, token, init)
  return schema.parse(await response.json())
}

/** SWR fetcher for `[POSTS_KEY, accessToken]`. */
export function fetchPostPage([url, token]: readonly [string, string]) {
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
  await send(`${API_URL}/media/${id}`, token, {
    method: "DELETE",
    keepalive: true,
  })
}

export function createPost(
  token: string,
  input: { body?: string; mediaIds?: string[] },
) {
  return sendJson(apiPostSchema, `${API_URL}/posts`, token, {
    method: "POST",
    body: JSON.stringify({ type: "POST", ...input }),
  })
}

export function fetchCommentPage([url, token]: readonly [string, string]) {
  return sendJson(commentPageSchema, url, token)
}

export function createComment(token: string, postId: string, body: string) {
  return sendJson(
    apiCommentSchema,
    `${API_URL}/posts/${postId}/comments`,
    token,
    {
      method: "POST",
      body: JSON.stringify({ body }),
    },
  )
}

export function updateComment(
  token: string,
  postId: string,
  commentId: string,
  body: string,
) {
  return sendJson(
    apiCommentSchema,
    `${API_URL}/posts/${postId}/comments/${commentId}`,
    token,
    {
      method: "PATCH",
      body: JSON.stringify({ body }),
    },
  )
}

export async function deleteComment(
  token: string,
  postId: string,
  commentId: string,
) {
  await send(`${API_URL}/posts/${postId}/comments/${commentId}`, token, {
    method: "DELETE",
  })
}

export function setPostLike(token: string, postId: string, isLiked: boolean) {
  return sendJson(postLikeSchema, `${API_URL}/posts/${postId}/like`, token, {
    method: isLiked ? "PUT" : "DELETE",
  })
}

export function interactionError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return "Phiên đăng nhập đã hết hạn. Vui lòng thử lại sau khi tải lại trang."
    if (error.status === 403)
      return "Bạn không có quyền thực hiện thao tác này."
    if (error.status === 404)
      return "Bài đăng hoặc bình luận không còn tồn tại."
    if (error.status === 400)
      return "Dữ liệu không hợp lệ. Hãy kiểm tra nội dung hoặc tải lại danh sách."
  }
  return "Không kết nối được. Vui lòng thử lại."
}
