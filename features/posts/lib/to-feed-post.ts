import { toAuthor } from "@/features/auth/lib/to-author"
import type { MediaPost, MuxVideo, Post } from "@/features/home/types"
import type { ApiMedia, ApiPost } from "@/features/posts/schemas"

function formatDuration(seconds: number | null) {
  if (seconds === null) return ""
  const total = Math.round(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}

const postStatus: Record<ApiPost["status"], MediaPost["status"]> = {
  PROCESSING: "processing",
  PUBLISHED: "published",
  FAILED: "failed",
}

const mediaStatus: Record<ApiMedia["status"], MuxVideo["status"]> = {
  WAITING_UPLOAD: "processing",
  PROCESSING: "processing",
  READY: "ready",
  FAILED: "failed",
}

/** Adapts an API post to the feed's `Post` shape that `PostCard` renders. */
export function toFeedPost(post: ApiPost): Post {
  const base = {
    id: post.id,
    publishedAt: post.publishedAt ?? post.createdAt,
    body: post.body ?? "",
    tags: [],
    author: toAuthor(post.author),
    stats: { replies: 0, reposts: 0, sprouts: 0, views: 0 },
  }
  const videos = post.media.filter((media) => media.type === "VIDEO")
  if (videos.length === 0) return { ...base, kind: "text" }

  return {
    ...base,
    kind: "media",
    status: postStatus[post.status],
    media: videos.map((video) => ({
      type: "video",
      id: video.id,
      status: mediaStatus[video.status],
      playbackId: video.playbackId,
      aspectRatio: video.aspectRatio,
      duration: formatDuration(video.durationSec),
    })),
  }
}
