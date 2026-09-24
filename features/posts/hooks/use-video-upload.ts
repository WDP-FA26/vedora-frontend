"use client"

import { useEffect, useRef, useState } from "react"
import { UpChunk } from "@mux/upchunk"

import { useAuth } from "@/features/auth/hooks/use-auth"
import {
  ApiError,
  discardMedia,
  requestVideoUpload,
} from "@/features/posts/lib/posts-api"
import {
  MAX_VIDEO_DURATION_SEC,
  type VideoUploadTarget,
} from "@/features/posts/schemas"

export type VideoUpload =
  | { status: "idle" }
  | { status: "uploading"; previewUrl: string; progress: number }
  | { status: "uploaded"; previewUrl: string; mediaId: string }
  | { status: "error"; message: string }

/** The upload in flight, with what's needed to cancel it. */
type ActiveUpload = {
  token: string
  previewUrl: string
  mediaId: string | null
  task: UpChunk | null
}

/**
 * The file's length from its metadata, or `null` when the browser can't tell:
 * `duration` is NaN for undecodable files and +Infinity for streams such as
 * browser-recorded WebM. The API enforces the limit either way.
 */
function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video")
    const url = URL.createObjectURL(file)
    const done = (duration: number | null) => {
      URL.revokeObjectURL(url)
      resolve(duration)
    }
    video.preload = "metadata"
    video.onloadedmetadata = () =>
      done(Number.isFinite(video.duration) ? video.duration : null)
    video.onerror = () => done(null)
    video.src = url
  })
}

/**
 * Sends one video straight to Mux: vedora-api issues a direct-upload URL and
 * UpChunk streams the file to it in resumable chunks. `onUploaded` receives
 * the media ID for `POST /posts`. Unmounting (closing the composer) cancels
 * an unposted upload and discards its media.
 */
export function useVideoUpload({
  onUploaded,
  onCleared,
}: {
  onUploaded: (mediaId: string) => void
  onCleared: () => void
}) {
  const { accessToken } = useAuth()
  const [upload, setUpload] = useState<VideoUpload>({ status: "idle" })
  const active = useRef<ActiveUpload | null>(null)

  function cancel({ discard }: { discard: boolean }) {
    const current = active.current
    active.current = null
    if (!current) return
    current.task?.abort()
    URL.revokeObjectURL(current.previewUrl)
    if (discard && current.mediaId) {
      discardMedia(current.token, current.mediaId).catch(() => {
        // Unposted uploads are also deleted by the API after 24 hours.
      })
    }
  }

  useEffect(() => () => cancel({ discard: true }), [])

  function fail(message: string) {
    cancel({ discard: true })
    onCleared()
    setUpload({ status: "error", message })
  }

  async function start(file: File) {
    cancel({ discard: true })
    onCleared()
    if (!accessToken) return
    if (!file.type.startsWith("video/")) {
      fail("Hãy chọn một tệp video.")
      return
    }
    const duration = await readDuration(file)
    if (duration !== null && duration > MAX_VIDEO_DURATION_SEC) {
      fail(`Video dài tối đa ${MAX_VIDEO_DURATION_SEC / 60} phút.`)
      return
    }

    const attempt: ActiveUpload = {
      token: accessToken,
      previewUrl: URL.createObjectURL(file),
      mediaId: null,
      task: null,
    }
    active.current = attempt
    setUpload({ status: "uploading", previewUrl: attempt.previewUrl, progress: 0 })

    let target: VideoUploadTarget
    try {
      target = await requestVideoUpload(accessToken)
    } catch (error) {
      fail(
        error instanceof ApiError && error.code === "UPLOAD_LIMIT_REACHED"
          ? "Bạn có quá nhiều video chưa đăng. Hãy đăng hoặc bỏ bớt."
          : "Không bắt đầu tải lên được. Thử lại nhé."
      )
      return
    }
    // Removed or replaced while the URL was being issued; already cleaned up.
    if (active.current !== attempt) {
      discardMedia(accessToken, target.media.id).catch(() => {})
      return
    }
    attempt.mediaId = target.media.id

    const task = UpChunk.createUpload({
      endpoint: target.uploadUrl,
      file,
      chunkSize: 5120,
    })
    attempt.task = task
    task.on("progress", (event: CustomEvent<number>) => {
      setUpload({
        status: "uploading",
        previewUrl: attempt.previewUrl,
        progress: event.detail,
      })
    })
    task.on("success", () => {
      attempt.task = null
      setUpload({
        status: "uploaded",
        previewUrl: attempt.previewUrl,
        mediaId: target.media.id,
      })
      onUploaded(target.media.id)
    })
    task.on("error", () => fail("Tải video lên thất bại. Thử lại nhé."))
  }

  /** Drops the video from the composer and deletes it on the API. */
  function remove() {
    cancel({ discard: true })
    onCleared()
    setUpload({ status: "idle" })
  }

  /** After the post was created: the media belongs to it now, keep it. */
  function release() {
    cancel({ discard: false })
    setUpload({ status: "idle" })
  }

  return { upload, start, remove, release }
}
