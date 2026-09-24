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

export type VideoPost = PostBase & {
  kind: "video"
  video: {
    duration: string
    caption: string
    tone: PlaceholderTone
    /** Mux playback ID; fixtures without one render a placeholder. */
    playbackId?: string
    /** Mux aspect ratio, e.g. "16:9". */
    aspectRatio?: string
    /** Posts from the API: "processing" until Mux finishes encoding. */
    status?: "processing" | "ready" | "failed"
  }
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
