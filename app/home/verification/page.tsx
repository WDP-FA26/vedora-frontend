import type { Metadata } from "next"

import { VerificationView } from "@/features/verification/components/verification-view"

export const metadata: Metadata = {
  title: "Xác minh chuyên gia · Vedora",
}

export default function VerificationPage() {
  return <VerificationView />
}
