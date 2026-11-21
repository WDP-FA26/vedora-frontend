import type { Metadata } from "next"

import { WorkspacesView } from "@/features/workspaces/components/workspaces-view"

export const metadata: Metadata = {
  title: "Trang nhà hàng · Vedora",
}

export default function WorkspacesPage() {
  return <WorkspacesView />
}
