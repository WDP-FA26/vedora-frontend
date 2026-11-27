import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { z } from "zod"
import { MySupportView } from "@/features/support/components/my-support-view"

export const metadata: Metadata = { title: "Hỗ trợ thanh toán · Vedora" }

export default async function PaymentSupportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  return <MySupportView paymentId={id} />
}
