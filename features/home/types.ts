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
export type VideoPost = PostBase & {
  kind: "video"
  video: { duration: string; caption: string; tone: PlaceholderTone }
}

/** A video hosted on Mux, from a vedora-api post. */
export type MuxVideo = {
  type: "video"
  id: string
  /** "processing" until Mux finishes encoding. */
  status: "processing" | "ready" | "failed"
  playbackId: string | null
  /** Mux aspect ratio, e.g. "16:9". */
  aspectRatio: string | null
  duration: string
}

/** Up to four attachments; photos will join this union. */
export type PostAttachment = MuxVideo

/** A vedora-api post with attachments, laid out like X's media grid. */
export type MediaPost = PostBase & {
  kind: "media"
  /** "processing" until every video is ready; only the author sees it. */
  status: "processing" | "published" | "failed"
  media: PostAttachment[]
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

export type Post = VideoPost | MediaPost | ArticlePost | PhotoPost | TextPost
