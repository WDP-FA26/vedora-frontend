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
  MAX_POST_MEDIA,
  MAX_VIDEO_DURATION_SEC,
  type VideoUploadTarget,
} from "@/features/posts/schemas"

/** One attachment in the composer, in display order. */
export type MediaUpload = {
  key: string
  previewUrl: string
  /** 0–100 while uploading; set to 100 once Mux has the whole file. */
  progress: number
  /** Set once the upload finished and the attachment can be posted. */
  mediaId: string | null
}

/** Bookkeeping for one upload, with what's needed to cancel it. */
type Entry = MediaUpload & {
  token: string
  /** Issued by the API before the file finished uploading. */
  pendingId: string | null
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
 * Sends up to `MAX_POST_MEDIA` videos straight to Mux: vedora-api issues a
 * direct-upload URL per file and UpChunk streams it in resumable chunks.
 * `onChange` receives the finished media IDs, in order, for `POST /posts`,
 * and how many attachments the composer holds, finished or not.
 * Unmounting (closing the composer) cancels unposted uploads and discards
 * their media.
 */
export function useMediaUploads({
  onChange,
}: {
  onChange: (mediaIds: string[], count: number) => void
}) {
  const { accessToken } = useAuth()
  const entries = useRef<Entry[]>([])
  const [uploads, setUploads] = useState<MediaUpload[]>([])
  const [error, setError] = useState<string | null>(null)

  /** Publishes `entries` to React and the form after every change. */
  function sync() {
    setUploads(
      entries.current.map(({ key, previewUrl, progress, mediaId }) => ({
        key,
        previewUrl,
        progress,
        mediaId,
      }))
    )
    onChange(
      entries.current.flatMap((entry) => (entry.mediaId ? [entry.mediaId] : [])),
      entries.current.length
    )
  }

  function drop(entry: Entry, { discard }: { discard: boolean }) {
    entries.current = entries.current.filter((other) => other !== entry)
    entry.task?.abort()
    URL.revokeObjectURL(entry.previewUrl)
    const id = entry.mediaId ?? entry.pendingId
    if (discard && id) {
      discardMedia(entry.token, id).catch(() => {
        // Unposted uploads are also deleted by the API after 24 hours.
      })
    }
  }

  useEffect(
    () => () => {
      for (const entry of [...entries.current]) drop(entry, { discard: true })
    },
    []
  )

  function fail(entry: Entry, message: string) {
    if (!entries.current.includes(entry)) return
    drop(entry, { discard: true })
    setError(message)
    sync()
  }

  async function upload(entry: Entry, file: File) {
    let target: VideoUploadTarget
    try {
      target = await requestVideoUpload(entry.token)
    } catch (err) {
      fail(
        entry,
        err instanceof ApiError && err.code === "UPLOAD_LIMIT_REACHED"
          ? "Bạn có quá nhiều video chưa đăng. Hãy đăng hoặc bỏ bớt."
          : "Không bắt đầu tải lên được. Thử lại nhé."
      )
      return
    }
    const mediaId = target.media.id
    // Removed while the URL was being issued; already cleaned up.
    if (!entries.current.includes(entry)) {
      discardMedia(entry.token, mediaId).catch(() => {})
      return
    }
    entry.pendingId = mediaId

    const task = UpChunk.createUpload({
      endpoint: target.uploadUrl,
      file,
      chunkSize: 5120,
    })
    entry.task = task
    task.on("progress", (event: CustomEvent<number>) => {
      entry.progress = event.detail
      sync()
    })
    task.on("success", () => {
      entry.task = null
      entry.progress = 100
      entry.mediaId = mediaId
      sync()
    })
    task.on("error", () => fail(entry, "Tải video lên thất bại. Thử lại nhé."))
  }

  /** Adds files after the current attachments, up to the post's limit. */
  async function add(files: File[]) {
    if (!accessToken) return
    setError(null)
    const room = MAX_POST_MEDIA - entries.current.length
    if (files.length > room) {
      setError(`Mỗi bài đăng có tối đa ${MAX_POST_MEDIA} video.`)
    }

    for (const file of files.slice(0, Math.max(room, 0))) {
      if (!file.type.startsWith("video/")) {
        setError("Hãy chọn tệp video.")
        continue
      }
      const entry: Entry = {
        key: crypto.randomUUID(),
        previewUrl: URL.createObjectURL(file),
        progress: 0,
        mediaId: null,
        token: accessToken,
        pendingId: null,
        task: null,
      }
      // Reserve the slot now so a second pick can't go over the limit.
      entries.current = [...entries.current, entry]
      sync()

      const duration = await readDuration(file)
      if (duration !== null && duration > MAX_VIDEO_DURATION_SEC) {
        fail(entry, `Mỗi video dài tối đa ${MAX_VIDEO_DURATION_SEC / 60} phút.`)
        continue
      }
      if (entries.current.includes(entry)) void upload(entry, file)
    }
  }

  /** Drops one attachment and deletes it on the API. */
  function remove(key: string) {
    const entry = entries.current.find((other) => other.key === key)
    if (!entry) return
    drop(entry, { discard: true })
    setError(null)
    sync()
  }

  /** After the post was created: the media belongs to it now, keep it. */
  function release() {
    for (const entry of [...entries.current]) drop(entry, { discard: false })
    setError(null)
    sync()
  }

  return { uploads, error, add, remove, release }
}
