import { accountBlockOf, type AccountBlock } from "@/features/auth/lib/account-block"
import type { AuthTokens } from "@/features/auth/types"
import { PUBLIC_ENV } from "@/lib/env"

export const API_URL = PUBLIC_ENV.apiUrl

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
  | { kind: "rejected"; block: AccountBlock | null }
  | { kind: "failed" }

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
        ? { kind: "rejected", block: await accountBlockOf(response) }
        : { kind: "failed" }
    } catch {
      return { kind: "failed" }
    }
  })()

  inflight.set(refreshToken, promise)
  promise.then((result) => {
    const ttl = result.kind === "failed" ? 0 : SHARE_RESULT_MS
    setTimeout(() => inflight.delete(refreshToken), ttl)
  })
  return promise
}
