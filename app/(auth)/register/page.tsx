import type { Metadata } from "next"

import { RegisterForm } from "@/features/auth/components/register-form"

export const metadata: Metadata = {
  title: "Tạo tài khoản · Vedora",
}

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const { next } = await searchParams

  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight">Tham gia Vedora</h1>
      <p className="mt-1.5 mb-8 text-sm text-muted-foreground">
        Tạo tài khoản để đăng công thức, theo dõi đầu bếp và lưu món yêu thích.
      </p>
      <RegisterForm next={typeof next === "string" ? next : undefined} />
    </>
  )
}
