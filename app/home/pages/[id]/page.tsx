import type { Metadata } from "next"

import { WorkspaceManageView } from "@/features/workspaces/components/workspace-manage-view"

export const metadata: Metadata = {
  title: "Quản lý trang nhà hàng · Vedora",
}

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <WorkspaceManageView id={id} />
}
