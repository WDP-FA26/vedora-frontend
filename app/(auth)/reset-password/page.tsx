import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { ResetPasswordForm } from "@/features/auth/components/reset-password-form"
import { getPendingEmail, maskEmail } from "@/features/auth/lib/pending-verification"

export const metadata: Metadata = {
  title: "Đặt lại mật khẩu · Vedora",
}

export default async function ResetPasswordPage() {
  // Only reachable right after asking for a code on /forgot-password.
  const email = await getPendingEmail("reset")
  if (!email) redirect("/forgot-password")

  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight">Đặt lại mật khẩu</h1>
      <p className="mt-1.5 mb-8 text-sm text-muted-foreground">
        Nếu <span className="font-semibold text-foreground">{maskEmail(email)}</span> đã được đăng
        ký, mã 6 chữ số vừa được gửi tới đó. Mã có hiệu lực trong 10 phút.
      </p>
      <ResetPasswordForm />
    </>
  )
}
