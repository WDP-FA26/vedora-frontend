"use client"

import { useEffect, useRef, useState } from "react"
import { CldVideoPlayer, type CldVideoPlayerProps } from "next-cloudinary"
// CldVideoPlayer injects its stylesheet with `next/head`, which the App Router ignores.
import "next-cloudinary/dist/cld-video-player.css"
import { cn } from "cn"

import type { CaptionTrack } from "@/features/posts/schemas"

/**
 * A Cloudinary video over adaptive HLS (`sp_auto`, prebuilt by the API's
 * eager job), with its caption tracks in the CC menu. The player script
 * loads from unpkg once per page.
 */
export function VideoPlayer({
  publicId,
  aspectRatio,
  captions,
  label,
  className,
  maxHeight,
  videoRef,
  onTimeUpdate,
  onError,
}: {
  publicId: string
  /** e.g. "16:9"; sizes the player before the video loads. */
  aspectRatio: string | null
  captions: CaptionTrack[]
  label: string
  className?: string
  /**
   * A CSS length the player never grows past, e.g. "32rem". The player is
   * narrowed to the width that fits it, so a portrait video shows whole,
   * centered on black, instead of being cropped by its container.
   */
  maxHeight?: string
  /** The underlying `<video>`, e.g. to seek from a transcript. */
  videoRef?: React.RefObject<HTMLVideoElement | null>
  onTimeUpdate?: (seconds: number) => void
  onError?: () => void
}) {
  const ownRef = useRef<HTMLVideoElement | null>(null)
  const video = videoRef ?? ownRef
  const [measured, setMeasured] = useState<[number, number] | null>(null)
  const [width, height] = measured ?? (aspectRatio ?? "16:9").split(":").map(Number)

  useEffect(() => {
    const element = video.current
    if (!element || !onTimeUpdate) return
    const update = () => onTimeUpdate(element.currentTime)
    element.addEventListener("timeupdate", update)
    return () => element.removeEventListener("timeupdate", update)
  }, [video, onTimeUpdate])

  return (
    <div aria-label={label} className={cn("w-full bg-black", className)}>
      <div
        className="mx-auto w-full"
        // Media events don't bubble, so catch the video's metadata on the way
        // down. Its real size beats the stored ratio, which can be wrong for
        // a rotated phone video.
        onLoadedMetadataCapture={(event) => {
          const { videoWidth, videoHeight } = event.target as HTMLVideoElement
          if (videoWidth && videoHeight) setMeasured([videoWidth, videoHeight])
        }}
        style={maxHeight ? { maxWidth: `calc(${maxHeight} * ${width / height})` } : undefined}
      >
        <DisposingCldVideoPlayer
          // The player reads its size once, so a measured ratio remounts it.
          key={`${width}x${height}`}
          src={publicId}
          width={width * 100}
          height={height * 100}
          videoRef={video}
          sourceTypes={["hls"]}
          transformation={{ streaming_profile: "auto" }}
          // The default `q_auto` can't combine with `sp_auto`; `null` skips it.
          quality={null as unknown as undefined}
          // The first frame; the player drops the extension of a full poster URL.
          poster={{ src: publicId, assetType: "video", format: "jpg", rawTransformations: ["so_0"] }}
          logo={false}
          colors={{ accent: "#75b65c", base: "#000000", text: "#ffffff" }}
          {...captionProps(captions)}
          onError={onError}
        />
      </div>
    </div>
  )
}

/**
 * `textTracks` only when there are captions. The player validates a present
 * `textTracks: undefined` against its nested schema and throws
 * (`s.value is not a function`), leaving a half-built player nothing disposes.
 */
function captionProps(captions: CaptionTrack[]): Pick<CldVideoPlayerProps, "textTracks"> {
  if (captions.length === 0) return {}
  return {
    textTracks: {
      subtitles: captions.map((track) => ({
        label: track.name,
        language: track.languageCode,
        url: track.url,
      })),
    },
  }
}

/**
 * Player options next-cloudinary forwards untouched but doesn't type.
 * - `cloudinaryAnalytics` adds a window "beforeunload" listener for every source
 *   and never removes it on dispose, so each disposed player kept its whole DOM
 *   alive (~300 nodes per video per visit).
 * - `fontFace` defaults to "Inter", loaded by injecting a Google Fonts `<link>`
 *   per player (blocked by our CSP, and never removed). "inherit" uses the app font.
 */
const PLAYER_OVERRIDES: { cloudinaryAnalytics: boolean; fontFace: string } = {
  cloudinaryAnalytics: false,
  fontFace: "inherit",
}

type CloudinaryPlayer = NonNullable<NonNullable<CldVideoPlayerProps["playerRef"]>["current"]>

/**
 * `CldVideoPlayer` that really tears its player down on unmount.
 * next-cloudinary 6.19 only disposes the Cloudinary plugin
 * (`player.videojs.cloudinary.dispose()`), so the video.js player behind it
 * keeps its controls, DOM and listeners alive: every remount, such as switching
 * a home tab, leaked ~575 nodes per video. A parent's effect cleanup runs before
 * its child's, so the instance is still here when this one runs.
 */
function DisposingCldVideoPlayer(props: CldVideoPlayerProps) {
  const playerRef = useRef<CloudinaryPlayer | null>(null)

  useEffect(() => {
    return () => {
      const player = playerRef.current
      playerRef.current = null
      player?.dispose()
    }
  }, [])

  return <CldVideoPlayer {...props} {...PLAYER_OVERRIDES} playerRef={playerRef} />
}
