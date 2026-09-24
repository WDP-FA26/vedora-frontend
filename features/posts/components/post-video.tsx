"use client"

import MuxPlayer from "@mux/mux-player-react/lazy"
import { ClapperboardIcon, TriangleAlertIcon } from "lucide-react"

import { Spinner } from "@/components/ui/spinner"
import { MediaPlaceholder } from "@/features/shared/components/media-placeholder"
import { useProcessingPost } from "@/features/posts/hooks/use-feed-posts"
import type { VideoPost } from "@/features/home/types"

/** A post's Mux video, or its processing/failed state. */
export function PostVideo({ post }: { post: VideoPost }) {
  const { video } = post
  const label = `Video của ${post.author.name}`

  if (video.status === "processing") {
    return <ProcessingVideo post={post} label={label} />
  }
  if (video.status === "failed" || !video.playbackId) {
    return (
      <MediaPlaceholder
        tone={video.tone}
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
    <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-black">
      <MuxPlayer
        playbackId={video.playbackId}
        streamType="on-demand"
        accentColor="oklch(0.508 0.118 165.612)"
        title={label}
        metadata={{ video_title: label }}
        style={{
          aspectRatio: video.aspectRatio?.replace(":", " / ") ?? "16 / 9",
          maxHeight: "32rem",
          width: "100%",
        }}
      />
    </div>
  )
}

function ProcessingVideo({ post, label }: { post: VideoPost; label: string }) {
  useProcessingPost(post.id)

  return (
    <MediaPlaceholder
      tone={post.video.tone}
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
