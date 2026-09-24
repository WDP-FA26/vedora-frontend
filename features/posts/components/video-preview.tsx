"use client"

import {
  MediaControlBar,
  MediaController,
  MediaMuteButton,
  MediaPlayButton,
  MediaTimeDisplay,
  MediaTimeRange,
} from "media-chrome/react"

/**
 * Plays a local file before it reaches Mux. Media Chrome (the UI Mux Player
 * is built on) over a native `<video>`, so any format the browser decodes
 * works and the controls match Mux Player in the feed.
 */
export function VideoPreview({ src, label }: { src: string; label: string }) {
  return (
    <MediaController
      aria-label={label}
      className="block w-full [--media-accent-color:var(--primary)]"
    >
      <video
        slot="media"
        src={src}
        muted
        playsInline
        preload="metadata"
        className="max-h-72 w-full bg-black object-contain"
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
