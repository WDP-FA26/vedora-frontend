"use client"

import MuxPlayer from "@mux/mux-player-react/lazy"
import { ClapperboardIcon, TriangleAlertIcon } from "lucide-react"
import { cn } from "cn"

import { Spinner } from "@/components/ui/spinner"
import type { MediaPost, MuxVideo } from "@/features/home/types"
import { MediaGrid } from "@/features/posts/components/media-grid"
import { useProcessingPost } from "@/features/posts/hooks/use-feed-posts"
import { MediaPlaceholder } from "@/features/shared/components/media-placeholder"
import type { Author } from "@/features/shared/types"

/** A post's attachments in X's grid, or their processing state. */
export function PostMedia({ post }: { post: MediaPost }) {
  if (post.status === "processing") return <ProcessingMedia post={post} />

  const single = post.media.length === 1
  return (
    <MediaGrid className="mt-4">
      {post.media.map((video, index) => (
        <PostVideo
          key={video.id}
          video={video}
          author={post.author}
          label={
            single
              ? `Video của ${post.author.name}`
              : `Video ${index + 1}/${post.media.length} của ${post.author.name}`
          }
          fill={!single}
        />
      ))}
    </MediaGrid>
  )
}

function PostVideo({
  video,
  author,
  label,
  fill,
}: {
  video: MuxVideo
  author: Author
  label: string
  /** In a multi-item grid: fill the cell and crop, like X. */
  fill: boolean
}) {
  if (video.status !== "ready" || !video.playbackId) {
    return (
      <MediaPlaceholder
        tone={author.tone}
        label={label}
        icon={TriangleAlertIcon}
        className={fill ? "size-full" : "aspect-video"}
      >
        <span className="absolute bottom-3 left-3 text-sm font-semibold">
          Không xử lý được video này
        </span>
      </MediaPlaceholder>
    )
  }

  return (
    <MuxPlayer
      playbackId={video.playbackId}
      streamType="on-demand"
      accentColor="var(--primary)"
      title={label}
      metadata={{ video_title: label }}
      className={cn(
        "block w-full",
        fill ? "h-full [--media-object-fit:cover]" : "max-h-[32rem]"
      )}
      style={
        fill ? undefined : { aspectRatio: video.aspectRatio?.replace(":", " / ") ?? "16 / 9" }
      }
    />
  )
}

function ProcessingMedia({ post }: { post: MediaPost }) {
  useProcessingPost(post.id)
  const single = post.media.length === 1

  return (
    <div className="mt-4">
      <MediaGrid>
        {post.media.map((video) => (
          <MediaPlaceholder
            key={video.id}
            tone={post.author.tone}
            label={`Video của ${post.author.name}`}
            icon={ClapperboardIcon}
            className={single ? "aspect-video" : "size-full"}
          />
        ))}
      </MediaGrid>
      <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Spinner aria-hidden />
        Đang xử lý video… chỉ bạn thấy bài này
      </p>
    </div>
  )
}
