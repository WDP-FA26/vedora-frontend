import "server-only"

import { cookies } from "next/headers"

// Between asking for an emailed code (sign-up, an unverified login, or
// "forgot password") and entering it, the email the code went to is kept in an
// httpOnly cookie rather than the URL, so it stays out of history, logs and
// Referer headers. Each flow has its own cookie, so one can't hijack the other.

/** What the emailed code is for. */
export type PendingCodeKind = "verify" | "reset"

const PENDING_EMAIL_COOKIES: Record<PendingCodeKind, string> = {
  verify: "vedora_verify_email",
  reset: "vedora_reset_email",
}

/** Codes live 10 minutes; this leaves room to ask for a few more. */
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

/** `nguyenvan@gmail.com` → `ng•••@gmail.com`, for showing where the code went. */
export function maskEmail(email: string) {
  const [name, domain] = email.split("@")
  return `${name.slice(0, Math.min(2, name.length - 1))}•••@${domain}`
}
