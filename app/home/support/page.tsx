import type { Metadata } from "next"

import { MySupportView } from "@/features/support/components/my-support-view"

export const metadata: Metadata = {
  title: "Trung tâm hỗ trợ · Vedora",
}

export default function MySupportPage() {
  return <MySupportView />
}
