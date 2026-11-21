import { toAuthor } from "@/features/auth/lib/to-author"
import type { Workspace } from "@/features/workspaces/schemas"

/** A page in the shape avatar components take; before approval it has no account id yet. */
export function workspaceAuthor(workspace: Workspace) {
  return toAuthor({
    id: workspace.pageUserId ?? workspace.id,
    username: workspace.username,
    fullName: workspace.name,
    avatarUrl: workspace.avatarUrl,
  })
}
