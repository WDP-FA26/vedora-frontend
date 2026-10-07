import type { Metadata } from "next"

import { VerificationRequestsTable } from "@/features/verification/components/admin/requests-table"

export const metadata: Metadata = {
  title: "Xác minh chuyên gia · Vedora Quản trị",
}

export default function AdminVerificationPage() {
  return <VerificationRequestsTable />
}
