import type { Metadata } from "next"

import { DietaryView } from "@/features/dietary/components/dietary-view"

export const metadata: Metadata = {
  title: "Hồ sơ ăn uống · Vedora",
}

export default function DietaryPage() {
  return <DietaryView />
}
