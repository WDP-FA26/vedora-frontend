import type { BrowserContext } from "@playwright/test"

import { makeAccessToken, makeRefreshToken, users } from "../fixtures/data.mjs"

export type Persona = "member" | "admin" | "chef"

// Same names as features/auth/lib/tokens.ts.
const ACCESS_TOKEN_COOKIE = "vedora_at"
const REFRESH_TOKEN_COOKIE = "vedora_rt"

/**
 * Signs `persona` in by planting the cookies proxy.ts and the server session
 * helpers read. The access token is a fresh, unsigned JWT the mock API
 * understands, so no login round trip (or Turnstile) is needed.
 */
export async function signInAs(context: BrowserContext, persona: Persona = "member") {
  const user = users[persona]
  const base = { domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" as const }
  await context.addCookies([
    { ...base, name: ACCESS_TOKEN_COOKIE, value: makeAccessToken(user.id) },
    { ...base, name: REFRESH_TOKEN_COOKIE, value: makeRefreshToken(user.id) },
  ])
  return user
}
