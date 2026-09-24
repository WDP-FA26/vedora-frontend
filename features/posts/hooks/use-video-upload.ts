"use client"

import { useEffect, useRef, useState } from "react"
import { UpChunk } from "@mux/upchunk"

import { useAuth } from "@/features/auth/hooks/use-auth"
import {
  MAX_VIDEO_DURATION_SEC,
  discardMedia,
  requestVideoUpload,
} from "@/features/posts/lib/posts-api"

export type VideoUpload =
  | { status: "idle" }
  | { status: "uploading"; previewUrl: string; progress: number }
  | { status: "uploaded"; previewUrl: string; mediaId: string }
  | { status: "error"; message: string }

function readDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement("video")
    const url = URL.createObjectURL(file)
    video.preload = "metadata"
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      // Browser-recorded WebM reports Infinity until fully read: unknown.
      resolve(Number.isFinite(video.duration) ? video.duration : 0)
    }
    // Unknown lengths still upload; the API rejects videos that are too long.
    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(0)
    }
    video.src = url
  })
}

/**
 * Sends one video straight to Mux: asks vedora-api for a direct-upload URL,
 * then streams the file in chunks with UpChunk. `mediaId` goes into
 * `POST /posts` once `status` is "uploaded". Unmounting before `release()`
 * (e.g. closing the composer) cancels the upload and discards the media.
 */
export function useVideoUpload() {
  const { accessToken } = useAuth()
  const [upload, setUpload] = useState<VideoUpload>({ status: "idle" })
  const chunker = useRef<UpChunk | null>(null)
  const mediaId = useRef<string | null>(null)
  const previewUrl = useRef<string | null>(null)
  const tokenRef = useRef(accessToken)

  useEffect(() => {
    tokenRef.current = accessToken
  }, [accessToken])

  function cleanup(discard: boolean) {
    chunker.current?.abort()
    chunker.current = null
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
    previewUrl.current = null
    if (discard && mediaId.current && tokenRef.current) {
      void discardMedia(tokenRef.current, mediaId.current).catch(() => {})
    }
    mediaId.current = null
  }

  useEffect(() => () => cleanup(true), [])

  async function start(file: File) {
    cleanup(true)
    if (!accessToken) return
    if (!file.type.startsWith("video/")) {
      setUpload({ status: "error", message: "Hãy chọn một tệp video." })
      return
    }
    const duration = await readDuration(file)
    if (duration > MAX_VIDEO_DURATION_SEC) {
      setUpload({
        status: "error",
        message: `Video dài tối đa ${MAX_VIDEO_DURATION_SEC / 60} phút.`,
      })
      return
    }

    const url = URL.createObjectURL(file)
    previewUrl.current = url
    setUpload({ status: "uploading", previewUrl: url, progress: 0 })

    try {
      const { media, uploadUrl } = await requestVideoUpload(accessToken)
      // Removed or replaced while the URL was being issued.
      if (previewUrl.current !== url) {
        void discardMedia(accessToken, media.id).catch(() => {})
        return
      }
      mediaId.current = media.id

      const task = UpChunk.createUpload({ endpoint: uploadUrl, file, chunkSize: 5120 })
      chunker.current = task
      task.on("progress", (event: CustomEvent<number>) => {
        setUpload({ status: "uploading", previewUrl: url, progress: event.detail })
      })
      task.on("success", () => {
        chunker.current = null
        setUpload({ status: "uploaded", previewUrl: url, mediaId: media.id })
      })
      task.on("error", () => {
        cleanup(true)
        setUpload({ status: "error", message: "Tải video lên thất bại. Thử lại nhé." })
      })
    } catch (error) {
      cleanup(false)
      setUpload({
        status: "error",
        message:
          error instanceof Error && "status" in error && error.status === 429
            ? "Bạn có quá nhiều video chưa đăng. Hãy đăng hoặc xoá bớt."
            : "Không bắt đầu tải lên được. Thử lại nhé.",
      })
    }
  }

  /** Drops the video from the composer and deletes it on the API. */
  function remove() {
    cleanup(true)
    setUpload({ status: "idle" })
  }

  /** Call after the post was created: the media now belongs to the post. */
  function release() {
    mediaId.current = null
    cleanup(false)
    setUpload({ status: "idle" })
  }

  return { upload, start, remove, release }
}
