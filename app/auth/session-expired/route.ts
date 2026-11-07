import { NextResponse, type NextRequest } from "next/server"

import { ACCOUNT_BLOCK_PARAM, parseAccountBlock } from "@/features/auth/lib/account-block"
import { safeRedirectPath } from "@/features/auth/lib/redirect"
import { clearTokenCookies } from "@/features/auth/lib/tokens"

// Server Components can't delete cookies, so `requireAuth` sends users whose
// token the API no longer accepts here. Without this, the proxy still sees the
// cookie, bounces `/login` back to `/home`, and the two redirect forever.
export function GET(request: NextRequest) {
  const loginUrl = new URL("/login", request.url)
  const next = request.nextUrl.searchParams.get("next")
  if (next) loginUrl.searchParams.set("next", safeRedirectPath(next))
  // A suspended account is told why it was signed out.
  const block = parseAccountBlock(request.nextUrl.searchParams.get(ACCOUNT_BLOCK_PARAM))
  if (block) loginUrl.searchParams.set(ACCOUNT_BLOCK_PARAM, block)

  const response = NextResponse.redirect(loginUrl)
  clearTokenCookies(response.cookies)
  return response
}
