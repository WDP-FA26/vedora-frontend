"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { postJson } from "@/features/auth/lib/api"
import { safeRedirectPath } from "@/features/auth/lib/redirect"
import {
  REFRESH_TOKEN_COOKIE,
  clearTokenCookies,
  writeTokenCookies,
} from "@/features/auth/lib/tokens"
import {
  loginSchema,
  registerSchema,
  type FormErrors,
  type LoginValues,
  type RegisterValues,
} from "@/features/auth/schemas"

const UNREACHABLE = "Không kết nối được máy chủ. Vui lòng thử lại sau."
const INVALID = "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại."

/** Signs in through the API and stores the token pair. Returns the failed response, if any. */
async function authenticate(path: string, body: unknown) {
  const response = await postJson(path, body).catch(() => null)
  if (!response?.ok) return response ?? "unreachable"

  writeTokenCookies(await cookies(), await response.json())
  return null
}

export async function login(
  values: LoginValues,
  next?: string
): Promise<FormErrors<LoginValues>> {
  const parsed = loginSchema.safeParse(values)
  if (!parsed.success) return { root: INVALID }

  const failure = await authenticate("/auth/login", parsed.data)
  if (failure === "unreachable") return { root: UNREACHABLE }
  if (failure) return { root: "Tên đăng nhập hoặc mật khẩu không đúng." }

  redirect(safeRedirectPath(next))
}

export async function register(
  values: RegisterValues,
  next?: string
): Promise<FormErrors<RegisterValues>> {
  const parsed = registerSchema.safeParse(values)
  if (!parsed.success) return { root: INVALID }

  const { fullName, username, email, password } = parsed.data
  const failure = await authenticate("/auth/register", {
    fullName,
    username,
    email,
    password,
  })
  if (failure === "unreachable") return { root: UNREACHABLE }
  if (failure?.status === 409) {
    // The API names the taken column: "username already exists".
    const { message } = await failure.json()
    if (message === "username already exists") {
      return { username: "Tên đăng nhập này đã có người dùng" }
    }
    if (message === "email already exists") {
      return { email: "Email này đã được đăng ký" }
    }
    return { root: "Tên đăng nhập hoặc email đã được đăng ký." }
  }
  if (failure) return { root: INVALID }

  redirect(safeRedirectPath(next))
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
