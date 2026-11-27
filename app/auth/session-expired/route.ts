import { NextResponse, type NextRequest } from "next/server"

import { ACCOUNT_BLOCK_PARAM, parseAccountBlock } from "@/features/auth/lib/account-block"
import { safeRedirectPath } from "@/features/auth/lib/redirect"
import { clearTokenCookies } from "@/features/auth/lib/tokens"

export function GET(request: NextRequest) {
  const loginUrl = new URL("/login", request.url)
  const next = request.nextUrl.searchParams.get("next")
  if (next) loginUrl.searchParams.set("next", safeRedirectPath(next))
  const block = parseAccountBlock(request.nextUrl.searchParams.get(ACCOUNT_BLOCK_PARAM))
  if (block) loginUrl.searchParams.set(ACCOUNT_BLOCK_PARAM, block)

  const response = NextResponse.redirect(loginUrl)
  clearTokenCookies(response.cookies)
  return response
}
