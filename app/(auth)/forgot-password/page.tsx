import type { Metadata } from "next"

import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form"

export const metadata: Metadata = {
  title: "Quên mật khẩu · Vedora",
}

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight">Quên mật khẩu</h1>
      <p className="mt-1.5 mb-8 text-sm text-muted-foreground">
        Nhập email bạn dùng cho tài khoản Vedora. Nếu email đã được đăng ký, chúng tôi sẽ gửi mã
        6 chữ số để bạn đặt mật khẩu mới.
      </p>
      <ForgotPasswordForm />
    </>
  )
}
