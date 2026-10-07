import type { Metadata } from "next"

import { DietaryView } from "@/features/dietary/components/dietary-view"

export const metadata: Metadata = {
  title: "Thực phẩm tôi không ăn · Vedora",
}

export default function DietaryPage() {
  return <DietaryView />
}
