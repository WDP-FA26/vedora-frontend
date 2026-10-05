import type { PlaceholderTone } from "@/features/shared/components/media-placeholder"

export type Author = {
  /** The vedora-api user id. Absent on illustrative fixtures, which have no profile. */
  id?: string
  name: string
  /** Profile photo; the avatar falls back to `initials` without one. */
  avatarUrl?: string | null
  handle: string
  initials: string
  tone: PlaceholderTone
  /** Shown in the verified badge tooltip, e.g. "Verified chef". Badge only. */
  verified?: string
}

