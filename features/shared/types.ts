import type { PlaceholderTone } from "@/features/shared/components/media-placeholder"

export type Author = {
  name: string
  handle: string
  initials: string
  tone: PlaceholderTone
  /** Shown in the verified badge tooltip, e.g. "Verified chef". Badge only. */
  verified?: string
}

