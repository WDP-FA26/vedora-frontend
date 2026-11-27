"use client"

import { useEffect, useRef, useState } from "react"
import { CldVideoPlayer, type CldVideoPlayerProps } from "next-cloudinary"
import "next-cloudinary/dist/cld-video-player.css"
import { cn } from "cn"

import type { CaptionTrack } from "@/features/posts/schemas"

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
  aspectRatio: string | null
  captions: CaptionTrack[]
  label: string
  className?: string
  maxHeight?: string
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
        onLoadedMetadataCapture={(event) => {
          const { videoWidth, videoHeight } = event.target as HTMLVideoElement
          if (videoWidth && videoHeight) setMeasured([videoWidth, videoHeight])
        }}
        style={maxHeight ? { maxWidth: `calc(${maxHeight} * ${width / height})` } : undefined}
      >
        <DisposingCldVideoPlayer
          key={`${width}x${height}`}
          src={publicId}
          width={width * 100}
          height={height * 100}
          videoRef={video}
          sourceTypes={["hls"]}
          transformation={{ streaming_profile: "auto" }}
          quality={null as unknown as undefined}
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

const PLAYER_OVERRIDES: { cloudinaryAnalytics: boolean; fontFace: string } = {
  cloudinaryAnalytics: false,
  fontFace: "inherit",
}

type CloudinaryPlayer = NonNullable<NonNullable<CldVideoPlayerProps["playerRef"]>["current"]>

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
