import "server-only"

import { cookies } from "next/headers"

// Between sign-up (or an unverified login) and entering the code, the email
// the code went to is kept in an httpOnly cookie rather than the URL, so it
// stays out of history, logs and Referer headers.

const PENDING_EMAIL_COOKIE = "vedora_verify_email"

/** Codes live 10 minutes; this leaves room to ask for a few more. */
const PENDING_EMAIL_MAX_AGE = 60 * 60

export async function setPendingEmail(email: string) {
  const cookieStore = await cookies()
  cookieStore.set(PENDING_EMAIL_COOKIE, email, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PENDING_EMAIL_MAX_AGE,
  })
}

export async function getPendingEmail(): Promise<string | undefined> {
  return (await cookies()).get(PENDING_EMAIL_COOKIE)?.value
}

export async function clearPendingEmail() {
  const cookieStore = await cookies()
  cookieStore.delete(PENDING_EMAIL_COOKIE)
}

/** `nguyenvan@gmail.com` → `ng•••@gmail.com`, for showing where the code went. */
export function maskEmail(email: string) {
  const [name, domain] = email.split("@")
  return `${name.slice(0, Math.min(2, name.length - 1))}•••@${domain}`
}
