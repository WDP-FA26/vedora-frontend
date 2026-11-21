import type { Metadata } from "next"

import { RestaurantsExplorer } from "@/features/workspaces/components/restaurants-explorer"

export const metadata: Metadata = {
  title: "Nhà hàng chay · Vedora",
}

export default function RestaurantsPage() {
  return <RestaurantsExplorer />
}
