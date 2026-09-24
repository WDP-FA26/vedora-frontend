import { NextResponse, type NextRequest } from "next/server"

import { apiFetch } from "@/features/auth/lib/api"
import {
  GOOGLE_STATE_COOKIE,
  type GoogleError,
  type GoogleState,
} from "@/features/auth/lib/google"
import { safeRedirectPath } from "@/features/auth/lib/redirect"
import { writeTokenCookies } from "@/features/auth/lib/tokens"

function readState(value: string | undefined): GoogleState | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<GoogleState>
    return typeof parsed.state === "string" && typeof parsed.next === "string"
      ? { state: parsed.state, next: parsed.next }
      : null
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const saved = readState(request.cookies.get(GOOGLE_STATE_COOKIE)?.value)

  const finish = (target: string) => {
    const response = NextResponse.redirect(new URL(target, request.url))
    response.cookies.delete({ name: GOOGLE_STATE_COOKIE, path: "/auth/google" })
    return response
  }
  const fail = (error: GoogleError) => {
    const next = saved?.next ? `&next=${encodeURIComponent(saved.next)}` : ""
    return finish(`/login?error=${error}${next}`)
  }

  // The user closed the consent screen or denied access.
  if (params.get("error")) return fail("google_cancelled")

  const code = params.get("code")
  if (!code || !saved || params.get("state") !== saved.state) return fail("google_failed")

  // Only `code` is forwarded; vedora-api exchanges it with the same callback URL.
  const response = await apiFetch(
    `/auth/google/callback?${new URLSearchParams({ code })}`
  ).catch(() => null)
  if (!response) return fail("google_unavailable")
  if (!response.ok) return fail("google_failed")

  const redirect = finish(safeRedirectPath(saved.next))
  writeTokenCookies(redirect.cookies, await response.json())
  return redirect
}
