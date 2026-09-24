import { API_URL } from "@/features/auth/lib/api"
import type { ApiMedia, ApiPost } from "@/features/posts/types"

/** Mirrors vedora-api's `MAX_VIDEO_DURATION_SEC` default. */
export const MAX_VIDEO_DURATION_SEC = 180
export const MAX_POST_LENGTH = 280

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

async function request<T>(
  path: string,
  token: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(path.startsWith("http") ? path : `${API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  })
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null)
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? String(payload.message)
        : `Request failed (${response.status})`
    throw new ApiError(response.status, message)
  }
  return (response.status === 204 ? undefined : await response.json()) as T
}

/** SWR fetcher for `[url, accessToken]` keys. */
export function authedFetcher<T>([url, token]: [string, string]): Promise<T> {
  return request<T>(url, token)
}

export function requestVideoUpload(token: string) {
  return request<{ media: ApiMedia; uploadUrl: string }>("/media/uploads", token, {
    method: "POST",
    body: JSON.stringify({ type: "VIDEO" }),
  })
}

export function discardMedia(token: string, id: string) {
  return request<void>(`/media/${id}`, token, { method: "DELETE" })
}

export function createPost(
  token: string,
  input: { body?: string; mediaIds?: string[] }
) {
  return request<ApiPost>("/posts", token, {
    method: "POST",
    body: JSON.stringify({ type: "POST", ...input }),
  })
}
