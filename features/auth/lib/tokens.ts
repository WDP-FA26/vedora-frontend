import type { AuthTokens } from "@/features/auth/types"

export const ACCESS_TOKEN_COOKIE = "vedora_at"
export const REFRESH_TOKEN_COOKIE = "vedora_rt"

const EXPIRY_LEEWAY_MS = 30_000

type CookieOptions = {
  httpOnly: boolean
  secure: boolean
  sameSite: "lax"
  path: string
  maxAge: number
}

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
