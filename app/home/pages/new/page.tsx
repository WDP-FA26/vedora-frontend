import type { Metadata } from "next"

import { NewWorkspaceView } from "@/features/workspaces/components/new-workspace-view"

export const metadata: Metadata = {
  title: "Mở trang nhà hàng · Vedora",
}

export default async function NewWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ resubmit?: string | string[] }>
}) {
  const { resubmit } = await searchParams
  const resubmitId = typeof resubmit === "string" && resubmit ? resubmit : null
  return <NewWorkspaceView resubmitId={resubmitId} />
}
