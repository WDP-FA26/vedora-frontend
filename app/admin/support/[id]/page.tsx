import type { Metadata } from "next"

import { AdminSupportDetailView } from "@/features/admin/components/support/support-detail-view"

export const metadata: Metadata = {
  title: "Chi tiết hồ sơ hỗ trợ · Vedora Quản trị",
}

export default async function AdminSupportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <AdminSupportDetailView id={id} />
}
