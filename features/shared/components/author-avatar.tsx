import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toneClasses } from "@/features/shared/components/media-placeholder"
import type { Author } from "@/features/shared/types"

export function AuthorAvatar({
  author,
  size = "default",
  className,
}: {
  author: Author
  size?: "default" | "sm" | "lg" | "fill"
  className?: string
}) {
  return (
    <Avatar size={size} className={className}>
      {author.avatarUrl && <AvatarImage src={author.avatarUrl} alt="" />}
      <AvatarFallback
        className={toneClasses[author.tone]}
      >
        {author.initials}
      </AvatarFallback>
    </Avatar>
  )
}
