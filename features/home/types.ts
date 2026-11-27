import type { CaptionTrack } from "@/features/posts/schemas"
import type { BlogSummary } from "@/features/posts/schemas"
import type { PlaceholderTone } from "@/features/shared/components/media-placeholder"
import type { Author } from "@/features/shared/types"

export type FeedTab = "for-you" | "following" | "blogs" | "recipes"

type PostBase = {
  id: string
  publishedAt: string
  body: string
  tags: string[]
  author: Author
  stats: { replies: number; reposts: number; likes: number; views: number }
  liked?: boolean
  reposted?: boolean
  bookmarked?: boolean
}

export type VideoPost = PostBase & {
  kind: "video"
  video: { duration: string; caption: string; tone: PlaceholderTone }
}

export type CloudinaryVideo = {
  type: "video"
  id: string
  status: "processing" | "ready" | "failed"
  publicId: string
  posterUrl: string | null
  aspectRatio: string | null
  duration: string
  captions: CaptionTrack[]
}

export type PostAttachment = CloudinaryVideo

export type MediaPost = PostBase & {
  kind: "media"
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

export type BlogPost = PostBase & {
  kind: "blog"
  blog: BlogSummary
}

export type Post = VideoPost | MediaPost | ArticlePost | PhotoPost | TextPost | BlogPost
