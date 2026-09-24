"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { postJson } from "@/features/auth/lib/api"
import {
  clearPendingEmail,
  getPendingEmail,
  setPendingEmail,
} from "@/features/auth/lib/pending-verification"
import { safeRedirectPath } from "@/features/auth/lib/redirect"
import {
  REFRESH_TOKEN_COOKIE,
  clearTokenCookies,
  writeTokenCookies,
} from "@/features/auth/lib/tokens"
import {
  loginSchema,
  registerSchema,
  toFullName,
  verifyEmailSchema,
  type FormErrors,
  type LoginValues,
  type RegisterValues,
  type VerifyEmailValues,
} from "@/features/auth/schemas"

const UNREACHABLE = "Không kết nối được máy chủ. Vui lòng thử lại sau."
const INVALID = "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại."
const VERIFICATION_EXPIRED = "Phiên xác minh đã hết hạn. Vui lòng đăng nhập lại."

/** Keeps `?next=` when moving between the auth pages. */
function withNext(path: string, next?: string) {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path
}

/** Remembers where the code went, then asks for it. */
async function redirectToVerification(email: string, next?: string): Promise<never> {
  await setPendingEmail(email)
  redirect(withNext("/verify-email", next))
}

export async function login(
  values: LoginValues,
  next?: string
): Promise<FormErrors<LoginValues>> {
  const parsed = loginSchema.safeParse(values)
  if (!parsed.success) return { root: INVALID }

  const response = await postJson("/auth/login", parsed.data).catch(() => null)
  if (!response) return { root: UNREACHABLE }
  if (response.status === 403) {
    // Right password, unverified email: the API has just sent a code.
    const { code, email } = await response.json()
    if (code === "EMAIL_NOT_VERIFIED") return redirectToVerification(email, next)
  }
  if (!response.ok) return { root: "Tên đăng nhập hoặc mật khẩu không đúng." }

  writeTokenCookies(await cookies(), await response.json())
  redirect(safeRedirectPath(next))
}

export async function register(
  values: RegisterValues,
  next?: string
): Promise<FormErrors<RegisterValues>> {
  const parsed = registerSchema.safeParse(values)
  if (!parsed.success) return { root: INVALID }

  const { username, email, password } = parsed.data
  const response = await postJson("/auth/register", {
    fullName: toFullName(parsed.data),
    username,
    email,
    password,
  }).catch(() => null)
  if (!response) return { root: UNREACHABLE }
  if (response.status === 409) {
    // The API names the taken column: "username already exists".
    const { message } = await response.json()
    if (message === "username already exists") {
      return { username: "Tên đăng nhập này đã có người dùng" }
    }
    if (message === "email already exists") {
      return { email: "Email này đã được đăng ký" }
    }
    return { root: "Tên đăng nhập hoặc email đã được đăng ký." }
  }
  if (!response.ok) return { root: INVALID }

  // No tokens yet: the account is usable once the emailed code is entered.
  const { email: sentTo } = await response.json()
  return redirectToVerification(sentTo, next)
}

export async function verifyEmail(
  values: VerifyEmailValues,
  next?: string
): Promise<FormErrors<VerifyEmailValues>> {
  const parsed = verifyEmailSchema.safeParse(values)
  if (!parsed.success) return { code: "Nhập đủ 6 chữ số" }

  const email = await getPendingEmail()
  if (!email) return { root: VERIFICATION_EXPIRED }

  const response = await postJson("/auth/verify-email", {
    email,
    code: parsed.data.code,
  }).catch(() => null)
  if (!response) return { root: UNREACHABLE }
  if (response.status === 400) {
    return { code: "Mã không đúng hoặc đã hết hạn. Hãy kiểm tra lại hoặc gửi mã mới." }
  }
  if (response.status === 429) {
    return {
      root: "Bạn đã nhập sai mã quá nhiều lần. Vui lòng thử lại sau 24 giờ hoặc đăng nhập bằng Google.",
    }
  }
  if (!response.ok) return { root: UNREACHABLE }

  writeTokenCookies(await cookies(), await response.json())
  await clearPendingEmail()
  redirect(safeRedirectPath(next))
}

export type ResendResult =
  | { ok: true }
  /** `limitReached`: no more resends this hour, so hide the button. */
  | { ok: false; message: string; limitReached?: boolean }

/** Asks for a new code (every 2 minutes, at most 3 resends an hour). */
export async function resendVerificationCode(): Promise<ResendResult> {
  const email = await getPendingEmail()
  if (!email) return { ok: false, message: VERIFICATION_EXPIRED }

  const response = await postJson("/auth/verify-email/resend", { email }).catch(() => null)
  if (response?.status === 429) {
    return {
      ok: false,
      limitReached: true,
      message: "Bạn đã gửi lại mã 3 lần. Vui lòng thử lại sau 1 giờ.",
    }
  }
  if (!response?.ok) {
    return { ok: false, message: "Chưa gửi được mã. Vui lòng thử lại sau ít phút." }
  }
  return { ok: true }
}

export async function logout() {
  const cookieStore = await cookies()
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value
  if (refreshToken) {
    // Revoke the token family server-side; sign out locally even if this fails.
    await postJson("/auth/logout", { refreshToken }).catch(() => undefined)
  }
  clearTokenCookies(cookieStore)
  redirect("/login")
}
