import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { requireAuth } from "@/features/auth/server/session"
import { PaymentView } from "@/features/billing/payment-view"

export const metadata: Metadata = { title: "Thanh toán · Vedora" }
export default async function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound()
  await requireAuth(`/payment/${id}`)
  return <PaymentView id={id} />
}
