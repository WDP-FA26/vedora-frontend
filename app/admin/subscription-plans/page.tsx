import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { requireAuth } from "@/features/auth/server/session"
import { SubscriptionPlansView } from "@/features/admin/subscription-plans/subscription-plans-view"

export const metadata: Metadata = { title: "Gói đăng ký · Vedora Quản trị" }
export default async function AdminSubscriptionPlansPage() {
  const user = await requireAuth("/admin/subscription-plans")
  if (user.role !== "ADMIN") redirect("/home")
  return <SubscriptionPlansView />
}
