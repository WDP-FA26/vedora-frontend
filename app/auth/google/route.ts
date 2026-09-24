import { NextResponse, type NextRequest } from "next/server"

import { apiFetch } from "@/features/auth/lib/api"
import {
  GOOGLE_STATE_COOKIE,
  GOOGLE_STATE_MAX_AGE,
  type GoogleError,
  type GoogleState,
} from "@/features/auth/lib/google"
import { safeRedirectPath } from "@/features/auth/lib/redirect"

export async function GET(request: NextRequest) {
  const next = safeRedirectPath(request.nextUrl.searchParams.get("next"))

  // vedora-api answers with a 302 to Google's consent screen, or 503 when
  // Google OAuth isn't configured.
  const response = await apiFetch("/auth/google", { redirect: "manual" }).catch(() => null)
  const location = response?.headers.get("location")
  if (!response || response.status < 300 || response.status >= 400 || !location) {
    const error: GoogleError = "google_unavailable"
    return NextResponse.redirect(
      new URL(`/login?error=${error}&next=${encodeURIComponent(next)}`, request.url)
    )
  }

  const state = crypto.randomUUID()
  const consentUrl = new URL(location)
  consentUrl.searchParams.set("state", state)

  const redirect = NextResponse.redirect(consentUrl)
  const value: GoogleState = { state, next }
  redirect.cookies.set(GOOGLE_STATE_COOKIE, JSON.stringify(value), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax still sends it on Google's top-level redirect back to the callback.
    sameSite: "lax",
    path: "/auth/google",
    maxAge: GOOGLE_STATE_MAX_AGE,
  })
  return redirect
}
