import { toAuthor } from "@/features/auth/lib/to-author"
import type { MuxVideo, Post } from "@/features/home/types"
import type { ApiPost } from "@/features/posts/schemas"

function formatDuration(seconds: number | null) {
  if (seconds === null) return ""
  const total = Math.round(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}

const videoStatus: Record<ApiPost["status"], MuxVideo["status"]> = {
  PROCESSING: "processing",
  PUBLISHED: "ready",
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
  const video = post.media.find((media) => media.type === "VIDEO")
  if (!video) return { ...base, kind: "text" }

  return {
    ...base,
    kind: "video",
    video: {
      source: "mux",
      status: videoStatus[post.status],
      playbackId: video.playbackId,
      aspectRatio: video.aspectRatio,
      duration: formatDuration(video.durationSec),
    },
  }
}
