import type { Metadata } from "next"

import { MySupportDetailView } from "@/features/support/components/my-support-detail-view"

export const metadata: Metadata = {
  title: "Chi tiết hồ sơ hỗ trợ · Vedora",
}

export default async function MySupportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <MySupportDetailView id={id} />
}
