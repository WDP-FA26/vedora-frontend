import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toneClasses } from "@/features/shared/components/media-placeholder"
import { LogoMark } from "@/features/shared/components/wordmark"
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
  const isAiAccount = author.handle === "vedora.ai"
  return (
    <Avatar size={size} className={className}>
      {author.avatarUrl && <AvatarImage src={author.avatarUrl} alt="" />}
      <AvatarFallback className={isAiAccount ? undefined : toneClasses[author.tone]}>
        {isAiAccount ? <LogoMark className="size-full" /> : author.initials}
      </AvatarFallback>
    </Avatar>
  )
}
