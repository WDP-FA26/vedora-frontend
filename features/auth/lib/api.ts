import type { AuthTokens } from "@/features/auth/types"

// Server-side calls to vedora-api (Server Actions, `getAuth`, the proxy).
// Client Components call the API directly with the token from `useAuth()`.

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"

export function apiFetch(path: string, init?: RequestInit) {
  return fetch(`${API_URL}${path}`, { ...init, cache: "no-store" })
}

export function postJson(path: string, body: unknown) {
  return apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

export type RefreshResult =
  | { kind: "rotated"; tokens: AuthTokens }
  /** The API rejected the token (expired, revoked or reused): sign out. */
  | { kind: "rejected" }
  /** Network or 5xx failure: keep the cookies and try again next request. */
  | { kind: "failed" }

/**
 * The API revokes the whole token family when a refresh token is used twice.
 * A page load fires several requests at once (document, RSC prefetches, SWR),
 * all carrying the same expired cookies, so concurrent rotations of one token
 * share a single API call. Results are kept briefly for requests that arrive
 * just after it settles, before the browser has stored the new cookies.
 *
 * This lives in module memory, so it covers one server process. With several
 * instances, add a short reuse grace period on the API side as well.
 */
const inflight = new Map<string, Promise<RefreshResult>>()
const SHARE_RESULT_MS = 10_000

export function rotateRefreshToken(refreshToken: string): Promise<RefreshResult> {
  const existing = inflight.get(refreshToken)
  if (existing) return existing

  const promise = (async (): Promise<RefreshResult> => {
    try {
      const response = await postJson("/auth/refresh", { refreshToken })
      if (response.ok) return { kind: "rotated", tokens: await response.json() }
      return response.status === 400 || response.status === 401
        ? { kind: "rejected" }
        : { kind: "failed" }
    } catch {
      return { kind: "failed" }
    }
  })()

  inflight.set(refreshToken, promise)
  promise.then((result) => {
    // Failures are retried on the next request instead of being cached.
    const ttl = result.kind === "failed" ? 0 : SHARE_RESULT_MS
    setTimeout(() => inflight.delete(refreshToken), ttl)
  })
  return promise
}
