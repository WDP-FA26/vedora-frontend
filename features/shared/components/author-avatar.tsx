import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { toneClasses } from "@/features/shared/components/media-placeholder"
import type { Author } from "@/features/shared/types"

export function AuthorAvatar({
  author,
  size = "default",
  className,
}: {
  author: Author
  size?: "default" | "sm" | "lg"
  className?: string
}) {
  return (
    <Avatar size={size} className={className}>
      <AvatarFallback
        className={toneClasses[author.tone]}
      >
        {author.initials}
      </AvatarFallback>
    </Avatar>
  )
}
