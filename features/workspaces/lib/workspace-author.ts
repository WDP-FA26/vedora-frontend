import { toAuthor } from "@/features/auth/lib/to-author"
import type { Workspace } from "@/features/workspaces/schemas"

export function workspaceAuthor(workspace: Workspace) {
  return toAuthor({
    id: workspace.pageUserId ?? workspace.id,
    username: workspace.username,
    fullName: workspace.name,
    avatarUrl: workspace.avatarUrl,
  })
}
