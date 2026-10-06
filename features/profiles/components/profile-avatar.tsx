import { toAuthor } from "@/features/auth/lib/to-author"
import { AuthorAvatar } from "@/features/shared/components/author-avatar"
import type { ApiProfileSummary } from "@/features/profiles/schemas"

/** The profile's photo, or its initials on a stable colour when it has none. */
export function ProfileAvatar({
  profile,
  size = "default",
  className,
}: {
  profile: Pick<ApiProfileSummary, "id" | "username" | "fullName" | "avatarUrl">
  size?: "default" | "sm" | "lg" | "fill"
  className?: string
}) {
  return <AuthorAvatar author={toAuthor(profile)} size={size} className={className} />
}
