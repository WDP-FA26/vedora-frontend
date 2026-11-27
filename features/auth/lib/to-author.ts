import type { PlaceholderTone } from "@/features/shared/components/media-placeholder"
import type { CurrentUser } from "@/features/auth/types"
import type { Author } from "@/features/shared/types"
import { PROFESSIONAL_LABEL } from "@/features/verification/schemas"

const TONES: PlaceholderTone[] = ["basil", "sage", "grain", "beet", "tomato"]

export function toAuthor(
  user: Pick<CurrentUser, "id" | "username" | "fullName"> & {
    avatarUrl?: string | null
    isProfessional?: boolean
  }
): Author {
  const words = user.fullName.trim().split(/\s+/)
  const initials =
    words.length > 1
      ? `${words[0][0]}${words[words.length - 1][0]}`
      : user.fullName.slice(0, 2)
  const hash = [...user.id].reduce((sum, char) => sum + char.charCodeAt(0), 0)

  return {
    id: user.id,
    name: user.fullName,
    avatarUrl: user.avatarUrl,
    handle: user.username,
    initials: initials.toUpperCase(),
    tone: TONES[hash % TONES.length],
    verified: user.isProfessional ? PROFESSIONAL_LABEL : undefined,
  }
}
