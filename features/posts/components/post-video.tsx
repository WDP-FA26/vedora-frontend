"use client"

import MuxPlayer from "@mux/mux-player-react/lazy"
import { ClapperboardIcon, TriangleAlertIcon } from "lucide-react"

import { Spinner } from "@/components/ui/spinner"
import type { MuxVideo } from "@/features/home/types"
import { useProcessingPost } from "@/features/posts/hooks/use-feed-posts"
import { MediaPlaceholder } from "@/features/shared/components/media-placeholder"
import type { Author } from "@/features/shared/types"

/** A post's Mux video with Mux Player, or its processing/failed state. */
export function PostVideo({
  postId,
  author,
  video,
}: {
  postId: string
  author: Author
  video: MuxVideo
}) {
  const label = `Video của ${author.name}`

  if (video.status === "processing") {
    return <ProcessingVideo postId={postId} author={author} label={label} />
  }
  if (video.status === "failed" || !video.playbackId) {
    return (
      <MediaPlaceholder
        tone={author.tone}
        label={label}
        icon={TriangleAlertIcon}
        className="mt-4 aspect-video rounded-2xl border border-border"
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
      className="mt-4 block max-h-[32rem] w-full overflow-hidden rounded-2xl border border-border"
      style={{ aspectRatio: video.aspectRatio?.replace(":", " / ") ?? "16 / 9" }}
    />
  )
}

function ProcessingVideo({
  postId,
  author,
  label,
}: {
  postId: string
  author: Author
  label: string
}) {
  useProcessingPost(postId)

  return (
    <MediaPlaceholder
      tone={author.tone}
      label={label}
      icon={ClapperboardIcon}
      className="mt-4 aspect-video rounded-2xl border border-border"
    >
      <span className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full bg-card/90 px-3 py-1.5 text-sm font-semibold text-foreground">
        <Spinner aria-hidden />
        Đang xử lý video… chỉ bạn thấy bài này
      </span>
    </MediaPlaceholder>
  )
}
