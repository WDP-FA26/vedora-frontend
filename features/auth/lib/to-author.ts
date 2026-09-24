import type { PlaceholderTone } from "@/features/shared/components/media-placeholder"
import type { CurrentUser } from "@/features/auth/types"
import type { Author } from "@/features/shared/types"

const TONES: PlaceholderTone[] = ["basil", "sage", "grain", "beet", "tomato"]

/** Adapts the API user to the `Author` shape the avatar and nav components use. */
export function toAuthor(user: CurrentUser): Author {
  const words = user.fullName.trim().split(/\s+/)
  const initials =
    words.length > 1
      ? `${words[0][0]}${words[words.length - 1][0]}`
      : user.fullName.slice(0, 2)
  // Stable per user, so the avatar colour doesn't change between visits.
  const hash = [...user.id].reduce((sum, char) => sum + char.charCodeAt(0), 0)

  return {
    name: user.fullName,
    handle: user.username,
    initials: initials.toUpperCase(),
    tone: TONES[hash % TONES.length],
  }
}
