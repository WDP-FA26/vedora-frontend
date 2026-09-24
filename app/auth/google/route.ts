import { NextResponse, type NextRequest } from "next/server"

import { postJson } from "@/features/auth/lib/api"
import {
  GOOGLE_STATE_COOKIE,
  GOOGLE_STATE_MAX_AGE,
  type GoogleAuthorization,
  type GoogleError,
  type GoogleState,
} from "@/features/auth/lib/google"
import { safeRedirectPath } from "@/features/auth/lib/redirect"
import { writeTokenCookies } from "@/features/auth/lib/tokens"

const STATE_COOKIE_PATH = "/auth/google"

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  // Google comes back to this same URL with `code` (or `error`).
  return params.has("code") || params.has("error") ? finish(request) : start(request)
}

/** Step 1: send the browser to Google's consent screen. */
async function start(request: NextRequest) {
  const next = safeRedirectPath(request.nextUrl.searchParams.get("next"))

  // vedora-api returns the consent URL plus the `state` and PKCE verifier to
  // keep, or 503 when Google OAuth isn't configured.
  const response = await postJson("/auth/google/authorize", {}).catch(() => null)
  const authorization: GoogleAuthorization | null = response?.ok
    ? await response.json().catch(() => null)
    : null
  if (!authorization?.url) {
    const error: GoogleError = "google_unavailable"
    return NextResponse.redirect(
      new URL(`/login?error=${error}&next=${encodeURIComponent(next)}`, request.url)
    )
  }

  const redirect = NextResponse.redirect(authorization.url)
  const value: GoogleState = {
    state: authorization.state,
    codeVerifier: authorization.codeVerifier,
    next,
  }
  redirect.cookies.set(GOOGLE_STATE_COOKIE, JSON.stringify(value), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax still sends it on Google's top-level redirect back here.
    sameSite: "lax",
    path: STATE_COOKIE_PATH,
    maxAge: GOOGLE_STATE_MAX_AGE,
  })
  return redirect
}

/** Step 2: check `state`, trade the `code` for tokens and set the auth cookies. */
async function finish(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const saved = readState(request.cookies.get(GOOGLE_STATE_COOKIE)?.value)

  const redirectTo = (target: string) => {
    const response = NextResponse.redirect(new URL(target, request.url))
    response.cookies.delete({ name: GOOGLE_STATE_COOKIE, path: STATE_COOKIE_PATH })
    return response
  }
  const fail = (error: GoogleError) => {
    const next = saved?.next ? `&next=${encodeURIComponent(saved.next)}` : ""
    return redirectTo(`/login?error=${error}${next}`)
  }

  // The user closed the consent screen or denied access.
  if (params.get("error")) return fail("google_cancelled")

  const code = params.get("code")
  if (!code || !saved || params.get("state") !== saved.state) return fail("google_failed")

  // vedora-api exchanges the code with Google, proving it with the verifier.
  const response = await postJson("/auth/google", {
    code,
    codeVerifier: saved.codeVerifier,
  }).catch(() => null)
  if (!response) return fail("google_unavailable")
  if (!response.ok) return fail("google_failed")

  const redirect = redirectTo(safeRedirectPath(saved.next))
  writeTokenCookies(redirect.cookies, await response.json())
  return redirect
}

function readState(value: string | undefined): GoogleState | null {
  if (!value) return null
  try {
    const { state, codeVerifier, next } = JSON.parse(value) as Partial<GoogleState>
    return typeof state === "string" &&
      typeof codeVerifier === "string" &&
      typeof next === "string"
      ? { state, codeVerifier, next }
      : null
  } catch {
    return null
  }
}
