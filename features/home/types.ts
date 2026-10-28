import type { CaptionTrack } from "@/features/posts/schemas"
import type { BlogSummary } from "@/features/posts/schemas"
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
  stats: { replies: number; reposts: number; likes: number; views: number }
  liked?: boolean
  reposted?: boolean
  bookmarked?: boolean
}

/** Illustrative fixture video, drawn as a placeholder. */
export type VideoPost = PostBase & {
  kind: "video"
  video: { duration: string; caption: string; tone: PlaceholderTone }
}

/** A video hosted on Cloudinary, from a vedora-api post. */
export type CloudinaryVideo = {
  type: "video"
  id: string
  /** "processing" until Cloudinary has built the stream. */
  status: "processing" | "ready" | "failed"
  publicId: string
  posterUrl: string | null
  /** e.g. "16:9". */
  aspectRatio: string | null
  duration: string
  captions: CaptionTrack[]
}

/** Up to four attachments; photos will join this union. */
export type PostAttachment = CloudinaryVideo

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

/** A long vedora-api blog, shown as a card that opens the full article. */
export type BlogPost = PostBase & {
  kind: "blog"
  blog: BlogSummary
}

export type Post = VideoPost | MediaPost | ArticlePost | PhotoPost | TextPost | BlogPost
