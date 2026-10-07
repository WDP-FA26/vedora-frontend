"use client"

import { useSyncExternalStore } from "react"
import { z } from "zod"

import { API_URL } from "@/features/auth/lib/api"
import { sendJson } from "@/features/shared/lib/api-client"

// The nutrition chat is open to guests: a Turnstile check buys a guest session
// from vedora-api, kept in this browser until it expires.

export const TURNSTILE_SITE_KEY =
  // Cloudflare's always-pass test key, for local development
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA"

const STORAGE_KEY = "vedora-guest-session"
const EXPIRY_LEEWAY_MS = 60_000

const storedSchema = z.object({ token: z.string(), expiresAt: z.number() })
const guestSessionSchema = z.object({
  token: z.string(),
  expiresIn: z.number(),
  remaining: z.number(),
})

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function read(): string | null {
  try {
    const stored = storedSchema.safeParse(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"))
    if (!stored.success) return null
    return stored.data.expiresAt - Date.now() > EXPIRY_LEEWAY_MS ? stored.data.token : null
  } catch {
    return null
  }
}

function write(value: z.infer<typeof storedSchema> | null) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // private mode: the session lasts until the page is closed
  }
  listeners.forEach((listener) => listener())
}

/** The guest token, or null until the Turnstile check has passed. */
export function useGuestToken() {
  return useSyncExternalStore(subscribe, read, () => null)
}

export function clearGuestSession() {
  write(null)
}

export async function startGuestSession(turnstileToken: string) {
  const session = await sendJson(
    guestSessionSchema,
    `${API_URL}/nutrition-chat/guest-session`,
    undefined,
    { method: "POST", body: JSON.stringify({ turnstileToken }) }
  )
  write({ token: session.token, expiresAt: Date.now() + session.expiresIn * 1000 })
}
