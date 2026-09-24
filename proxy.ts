import { NextResponse, type NextRequest } from "next/server"

import { rotateRefreshToken } from "@/features/auth/lib/api"
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

const matchesAny = (pathname: string, prefixes: string[]) =>
  prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))

/**
 * 1. Rotate the token pair when the access token is missing or about to
 *    expire. Server Components can't write cookies, so it happens here,
 *    before rendering.
 * 2. Redirect guests away from protected pages and signed-in users away from
 *    /login and /register. This is a UX shortcut only: `requireAuth()` and
 *    each Server Action / Route Handler still check the session themselves.
 */
export async function proxy(request: NextRequest) {
  const refresh = await refreshSession(request)
  const signedIn = Boolean(request.cookies.get(ACCESS_TOKEN_COOKIE)?.value)

  // Forwarding `request.headers` passes the updated cookies on to this render.
  const response =
    redirectFor(request, signedIn) ?? NextResponse.next({ request: { headers: request.headers } })

  if (refresh?.kind === "rotated") writeTokenCookies(response.cookies, refresh.tokens)
  if (refresh?.kind === "rejected") clearTokenCookies(response.cookies)
  return response
}

/** Rotates if needed and mirrors the result onto `request.cookies`. */
async function refreshSession(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value
  if (!refreshToken || isAccessTokenFresh(accessToken)) return

  const result = await rotateRefreshToken(refreshToken)
  if (result.kind === "rotated") {
    request.cookies.set(ACCESS_TOKEN_COOKIE, result.tokens.accessToken)
    request.cookies.set(REFRESH_TOKEN_COOKIE, result.tokens.refreshToken)
  } else if (result.kind === "rejected") {
    request.cookies.delete([ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE])
  }
  // "failed" (network/5xx) keeps the cookies so the next request retries.
  return result
}

function redirectFor(request: NextRequest, signedIn: boolean) {
  const { pathname, search, searchParams } = request.nextUrl

  if (!signedIn && matchesAny(pathname, PROTECTED_PREFIXES)) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("next", `${pathname}${search}`)
    return NextResponse.redirect(loginUrl)
  }
  if (signedIn && matchesAny(pathname, GUEST_ONLY_PATHS)) {
    const next = safeRedirectPath(searchParams.get("next"))
    return NextResponse.redirect(new URL(next, request.url))
  }
}

export const config = {
  matcher: [
    // Skip static assets and image optimization; Server Actions and Route
    // Handlers stay covered so they always see a fresh access token.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
}
