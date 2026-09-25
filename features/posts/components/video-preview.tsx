"use client"

import {
  MediaControlBar,
  MediaController,
  MediaMuteButton,
  MediaPlayButton,
  MediaTimeDisplay,
  MediaTimeRange,
} from "media-chrome/react"
import { cn } from "cn"

/**
 * Plays a local file before it reaches Mux. Media Chrome (the UI Mux Player
 * is built on) over a native `<video>`, so any format the browser decodes
 * works and the controls match Mux Player in the feed.
 */
export function VideoPreview({
  src,
  label,
  fill,
}: {
  src: string
  label: string
  /** In a multi-item grid: fill the cell and crop, like X. */
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
        src={src}
        muted
        playsInline
        preload="metadata"
        className={cn(
          "w-full bg-black",
          fill ? "h-full object-cover" : "max-h-72 object-contain"
        )}
      />
      <MediaControlBar>
        <MediaPlayButton />
        <MediaTimeRange />
        <MediaTimeDisplay showDuration />
        <MediaMuteButton />
      </MediaControlBar>
    </MediaController>
  )
}
