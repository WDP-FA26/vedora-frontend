import "server-only"

import { cookies } from "next/headers"

export type PendingCodeKind = "verify" | "reset"

const PENDING_EMAIL_COOKIES: Record<PendingCodeKind, string> = {
  verify: "vedora_verify_email",
  reset: "vedora_reset_email",
}

const PENDING_EMAIL_MAX_AGE = 60 * 60

export async function setPendingEmail(email: string, kind: PendingCodeKind = "verify") {
  const cookieStore = await cookies()
  cookieStore.set(PENDING_EMAIL_COOKIES[kind], email, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PENDING_EMAIL_MAX_AGE,
  })
}

export async function getPendingEmail(
  kind: PendingCodeKind = "verify"
): Promise<string | undefined> {
  return (await cookies()).get(PENDING_EMAIL_COOKIES[kind])?.value
}

export async function clearPendingEmail(kind: PendingCodeKind = "verify") {
  const cookieStore = await cookies()
  cookieStore.delete(PENDING_EMAIL_COOKIES[kind])
}

export function maskEmail(email: string) {
  const [name, domain] = email.split("@")
  return `${name.slice(0, Math.min(2, name.length - 1))}•••@${domain}`
}
