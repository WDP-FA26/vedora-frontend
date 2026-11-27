"use client"

import {
  MediaControlBar,
  MediaController,
  MediaFullscreenButton,
  MediaMuteButton,
  MediaPlayButton,
  MediaTimeDisplay,
  MediaTimeRange,
  MediaVolumeRange,
} from "media-chrome/react"
import { cn } from "cn"

export function VideoPreview({
  src,
  label,
  fill,
}: {
  src: string
  label: string
  fill?: boolean
}) {
  return (
    <MediaController
      aria-label={label}
      className={cn(
        "block w-full [--media-accent-color:var(--primary)]",
        fill && "h-full"
      )}
    >
      <video
        slot="media"
        src={src || undefined}
        muted
        playsInline
        preload="metadata"
        className={cn(
          "w-full bg-black",
          fill ? "h-full object-contain" : "max-h-72 object-contain"
        )}
      />
      <MediaControlBar>
        <MediaPlayButton />
        <MediaTimeRange />
        <MediaTimeDisplay showDuration />
        <MediaMuteButton />
        <MediaVolumeRange className="hidden sm:block" />
        <MediaFullscreenButton />
      </MediaControlBar>
    </MediaController>
  )
}
