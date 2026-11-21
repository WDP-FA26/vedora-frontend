import { Badge } from "@/components/ui/badge"
import { WORKSPACE_STATUS_LABELS, type Workspace } from "@/features/workspaces/schemas"

const VARIANTS = {
  PENDING: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
} as const

export function WorkspaceStatusBadge({ status }: { status: Workspace["status"] }) {
  return <Badge variant={VARIANTS[status]}>{WORKSPACE_STATUS_LABELS[status]}</Badge>
}
