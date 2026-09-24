import type { Metadata } from "next"

import { LoginForm } from "@/features/auth/components/login-form"
import type { GoogleError } from "@/features/auth/lib/google"

const GOOGLE_ERRORS: Record<GoogleError, string> = {
  google_unavailable: "Đăng nhập bằng Google hiện chưa khả dụng. Vui lòng thử lại sau.",
  google_cancelled: "Bạn đã huỷ đăng nhập bằng Google.",
  google_failed: "Không thể đăng nhập bằng Google. Vui lòng thử lại.",
}

export const metadata: Metadata = {
  title: "Đăng nhập · Vedora",
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams
  const googleError = typeof error === "string" ? GOOGLE_ERRORS[error as GoogleError] : undefined

  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight">Chào mừng trở lại</h1>
      <p className="mt-1.5 mb-8 text-sm text-muted-foreground">
        Đăng nhập để xem bảng tin và tiếp tục chia sẻ món ngon.
      </p>
      {googleError && (
        <p role="alert" className="mb-6 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {googleError}
        </p>
      )}
      <LoginForm next={typeof next === "string" ? next : undefined} />
    </>
  )
}
