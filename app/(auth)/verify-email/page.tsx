import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { VerifyEmailForm } from "@/features/auth/components/verify-email-form"
import { getPendingEmail, maskEmail } from "@/features/auth/lib/pending-verification"

export const metadata: Metadata = {
  title: "Xác minh email · Vedora",
}

export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const { next } = await searchParams
  // Only reachable right after sign-up or an unverified login.
  const email = await getPendingEmail()
  if (!email) redirect("/login")

  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight">Xác minh email</h1>
      <p className="mt-1.5 mb-8 text-sm text-muted-foreground">
        Nhập mã 6 chữ số vừa được gửi tới{" "}
        <span className="font-semibold text-foreground">{maskEmail(email)}</span>. Mã có hiệu
        lực trong 10 phút.
      </p>
      <VerifyEmailForm next={typeof next === "string" ? next : undefined} />
    </>
  )
}
