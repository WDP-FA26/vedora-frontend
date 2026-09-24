import type { AuthTokens } from "@/features/auth/types"

// Shared by the proxy, route handlers and Server Actions. Keep it free of
// `server-only` / `next/headers` so the proxy bundle can import it.

export const ACCESS_TOKEN_COOKIE = "vedora_at"
export const REFRESH_TOKEN_COOKIE = "vedora_rt"

/** Refresh this long before the access token actually expires. */
const EXPIRY_LEEWAY_MS = 30_000

type CookieOptions = {
  httpOnly: boolean
  secure: boolean
  sameSite: "lax"
  path: string
  maxAge: number
}

/** Minimal shape shared by `cookies()` and `NextResponse.cookies`. */
type CookieWriter = {
  set(name: string, value: string, options: CookieOptions): unknown
  delete(name: string): unknown
}

function cookieOptions(maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  }
}

export function writeTokenCookies(store: CookieWriter, tokens: AuthTokens) {
  store.set(
    ACCESS_TOKEN_COOKIE,
    tokens.accessToken,
    cookieOptions(tokens.accessTokenExpiresIn)
  )
  store.set(
    REFRESH_TOKEN_COOKIE,
    tokens.refreshToken,
    cookieOptions(tokens.refreshTokenExpiresIn)
  )
}

export function clearTokenCookies(store: CookieWriter) {
  store.delete(ACCESS_TOKEN_COOKIE)
  store.delete(REFRESH_TOKEN_COOKIE)
}

/**
 * Reads `exp` without verifying the signature. That is enough to decide when
 * to rotate; the API still verifies every token it receives.
 */
export function isAccessTokenFresh(token: string | undefined): boolean {
  if (!token) return false
  try {
    const payload = token.split(".")[1]
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    const { exp } = JSON.parse(json) as { exp?: number }
    return typeof exp === "number" && exp * 1000 - Date.now() > EXPIRY_LEEWAY_MS
  } catch {
    return false
  }
}
