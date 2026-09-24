import type { PlaceholderTone } from "@/features/shared/components/media-placeholder"
import type { Author } from "@/features/shared/types"

export type FeedTab = "for-you" | "following" | "blogs" | "recipes"

type PostBase = {
  id: string
  publishedAt: string
  body: string
  /** Rendered as hashtags after the body, without the leading "#". */
  tags: string[]
  author: Author
  stats: { replies: number; reposts: number; sprouts: number; views: number }
  sprouted?: boolean
  bookmarked?: boolean
}

/** Illustrative fixture video, drawn as a placeholder. */
export type PlaceholderVideo = {
  source: "placeholder"
  duration: string
  caption: string
  tone: PlaceholderTone
}

/** A video hosted on Mux, from a vedora-api post. */
export type MuxVideo = {
  source: "mux"
  /** "processing" until Mux finishes encoding; only the author sees it. */
  status: "processing" | "ready" | "failed"
  playbackId: string | null
  /** Mux aspect ratio, e.g. "16:9". */
  aspectRatio: string | null
  duration: string
}

export type VideoPost = PostBase & {
  kind: "video"
  video: PlaceholderVideo | MuxVideo
}

export type TextPost = PostBase & {
  kind: "text"
}

export type ArticlePost = PostBase & {
  kind: "article"
  attachment: { title: string; source: string; tone: PlaceholderTone }
}

export type PhotoPost = PostBase & {
  kind: "photo"
  photos: { alt: string; tone: PlaceholderTone }[]
}

export type Post = VideoPost | ArticlePost | PhotoPost | TextPost
