import type { Metadata } from "next"
import { requireAuth } from "@/features/auth/server/session"
import { BillingView } from "@/features/billing/billing-view"

export const metadata: Metadata = { title: "Gói của bạn · Vedora" }
export default async function BillingPage() {
  const user = await requireAuth("/billing")
  return <BillingView userId={user.id} />
}
