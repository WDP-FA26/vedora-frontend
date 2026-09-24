import { NextResponse, type NextRequest } from "next/server"

import { rotateRefreshToken, type RefreshResult } from "@/features/auth/lib/api"
import { safeRedirectPath } from "@/features/auth/lib/redirect"
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  clearTokenCookies,
  isAccessTokenFresh,
  writeTokenCookies,
} from "@/features/auth/lib/tokens"

const PROTECTED_PREFIXES = ["/home", "/admin"]
const GUEST_ONLY_PATHS = ["/login", "/register"]

const matches = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`)

/**
 * Token rotation. Server Components can't write cookies, so the access token
 * is refreshed here, before rendering: when it is missing or about to expire
 * and a refresh token exists, the pair is rotated and the new cookies are
 * written both to the response (for the browser) and to the forwarded request
 * (so `cookies()` in this same render already sees them).
 *
 * The redirects below are a UX shortcut only. `requireAuth()` and each Server
 * Action / Route Handler still check the session themselves.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  let accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value

  let refresh: RefreshResult | undefined
  if (refreshToken && !isAccessTokenFresh(accessToken)) {
    refresh = await rotateRefreshToken(refreshToken)
    if (refresh.kind === "rotated") {
      accessToken = refresh.tokens.accessToken
      request.cookies.set(ACCESS_TOKEN_COOKIE, refresh.tokens.accessToken)
      request.cookies.set(REFRESH_TOKEN_COOKIE, refresh.tokens.refreshToken)
    } else if (refresh.kind === "rejected") {
      accessToken = undefined
      request.cookies.delete([ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE])
    }
  }

  const signedIn = Boolean(accessToken)
  let response: NextResponse

  if (!signedIn && PROTECTED_PREFIXES.some((p) => matches(pathname, p))) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("next", `${pathname}${search}`)
    response = NextResponse.redirect(loginUrl)
  } else if (signedIn && GUEST_ONLY_PATHS.some((p) => matches(pathname, p))) {
    const next = safeRedirectPath(request.nextUrl.searchParams.get("next"))
    response = NextResponse.redirect(new URL(next, request.url))
  } else if (refresh) {
    // `request.cookies` writes go through to `request.headers`.
    response = NextResponse.next({ request: { headers: request.headers } })
  } else {
    response = NextResponse.next()
  }

  if (refresh?.kind === "rotated") writeTokenCookies(response.cookies, refresh.tokens)
  if (refresh?.kind === "rejected") clearTokenCookies(response.cookies)

  return response
}

export const config = {
  matcher: [
    // Skip static assets and image optimization; Server Actions and Route
    // Handlers stay covered so they always see a fresh access token.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
}
