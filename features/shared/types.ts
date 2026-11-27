import type { PlaceholderTone } from "@/features/shared/components/media-placeholder"

export type Author = {
  id?: string
  name: string
  avatarUrl?: string | null
  handle: string
  initials: string
  tone: PlaceholderTone
  verified?: string
}

