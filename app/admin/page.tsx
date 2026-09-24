import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Tổng quan · Vedora Quản trị",
}

export default function AdminPage() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <h1 className="text-2xl font-bold tracking-tight">Tổng quan</h1>
      <p className="mt-1 text-muted-foreground">
        Chọn một công cụ ở thanh bên để bắt đầu.
      </p>
    </div>
  )
}
