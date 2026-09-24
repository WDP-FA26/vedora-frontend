/** Shapes from vedora-api's `/media` and `/posts` endpoints. Dates are ISO strings. */

export type MediaStatus = "WAITING_UPLOAD" | "PROCESSING" | "READY" | "FAILED"

export type ApiMedia = {
  id: string
  type: "VIDEO" | "IMAGE"
  status: MediaStatus
  failureReason: string | null
  playbackId: string | null
  durationSec: number | null
  aspectRatio: string | null
}

export type PostStatus = "PROCESSING" | "PUBLISHED" | "FAILED"

export type ApiPost = {
  id: string
  type: "POST" | "BLOG"
  status: PostStatus
  body: string | null
  publishedAt: string | null
  createdAt: string
  author: { id: string; username: string; fullName: string }
  media: ApiMedia[]
}

export type PostPage = {
  items: ApiPost[]
  nextCursor: string | null
}
