import type { Metadata } from "next"

import { LoginForm } from "@/features/auth/components/login-form"

export const metadata: Metadata = {
  title: "Đăng nhập · Vedora",
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams

  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight">Chào mừng trở lại</h1>
      <p className="mt-1.5 mb-8 text-sm text-muted-foreground">
        Đăng nhập để xem bảng tin và tiếp tục chia sẻ món ngon.
      </p>
      <LoginForm next={typeof next === "string" ? next : undefined} />
    </>
  )
}
