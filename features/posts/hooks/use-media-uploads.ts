"use client"

import { useEffect, useRef, useState } from "react"
import { UpChunk } from "@mux/upchunk"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { discardMedia, requestVideoUpload } from "@/features/posts/lib/posts-api"
import { ApiError } from "@/features/shared/lib/api-client"
import {
  MAX_POST_MEDIA,
  MAX_VIDEO_DURATION_SEC,
  type VideoUploadTarget,
} from "@/features/posts/schemas"

/** One attachment in the composer, in display order. */
export type MediaUpload = {
  key: string
  previewUrl: string
  fileName: string
  durationSec: number | null
  status: "uploading" | "ready" | "failed"
  error?: string
  /** 0–100 while uploading; set to 100 once Mux has the whole file. */
  progress: number
  /** Set once the upload finished and the attachment can be posted. */
  mediaId: string | null
}

/** Bookkeeping for one upload, with what's needed to cancel it. */
type Entry = MediaUpload & {
  file: File
  token: string
  /** Issued by the API before the file finished uploading. */
  pendingId: string | null
  task: UpChunk | null
  attempt: number
  cleanup: Promise<void> | null
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
      entries.current.map(({ key, previewUrl, fileName, durationSec, status, error, progress, mediaId }) => ({
        key,
        previewUrl,
        fileName,
        durationSec,
        status,
        error,
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
    entry.attempt += 1
    entry.task?.abort()
    entry.task = null
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

  function fail(entry: Entry, attempt: number, message: string) {
    if (!entries.current.includes(entry) || entry.attempt !== attempt || entry.status !== "uploading") return
    entry.status = "failed"
    entry.error = message
    entry.progress = 0
    entry.task?.abort()
    entry.task = null
    const pendingId = entry.pendingId
    entry.pendingId = null
    if (pendingId) {
      entry.cleanup = discardMedia(entry.token, pendingId).catch(() => {
        // The API also expires uploads that never became posts.
      })
    }
    setError(message)
    sync()
  }

  async function upload(entry: Entry, attempt: number) {
    let target: VideoUploadTarget
    try {
      target = await requestVideoUpload(entry.token)
    } catch (err) {
      fail(
        entry,
        attempt,
        err instanceof ApiError && err.code === "UPLOAD_LIMIT_REACHED"
          ? "Bạn có quá nhiều video chưa đăng. Hãy đăng hoặc bỏ bớt."
          : "Không bắt đầu tải lên được. Thử lại nhé."
      )
      return
    }
    const mediaId = target.media.id
    // Removed while the URL was being issued; already cleaned up.
    if (!entries.current.includes(entry) || entry.attempt !== attempt || entry.status !== "uploading") {
      discardMedia(entry.token, mediaId).catch(() => {})
      return
    }
    entry.pendingId = mediaId

    let task: UpChunk
    try {
      task = UpChunk.createUpload({
        endpoint: target.uploadUrl,
        file: entry.file,
        chunkSize: 5120,
      })
    } catch {
      fail(entry, attempt, "Không bắt đầu tải lên được. Thử lại nhé.")
      return
    }
    entry.task = task
    task.on("progress", (event: CustomEvent<number>) => {
      if (!entries.current.includes(entry) || entry.attempt !== attempt || entry.status !== "uploading") return
      entry.progress = event.detail
      sync()
    })
    task.on("success", () => {
      if (!entries.current.includes(entry) || entry.attempt !== attempt || entry.status !== "uploading") return
      entry.task = null
      entry.pendingId = null
      entry.progress = 100
      entry.mediaId = mediaId
      entry.status = "ready"
      entry.error = undefined
      sync()
    })
    task.on("error", () => fail(entry, attempt, "Tải video lên thất bại. Thử lại nhé."))
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
        fileName: file.name,
        durationSec: null,
        status: "uploading",
        error: undefined,
        progress: 0,
        mediaId: null,
        file,
        token: accessToken,
        pendingId: null,
        task: null,
        attempt: 1,
        cleanup: null,
      }
      // Reserve the slot now so a second pick can't go over the limit.
      entries.current = [...entries.current, entry]
      sync()

      const duration = await readDuration(file)
      if (!entries.current.includes(entry)) continue
      entry.durationSec = duration
      sync()
      if (duration !== null && duration > MAX_VIDEO_DURATION_SEC) {
        drop(entry, { discard: false })
        setError(`Mỗi video dài tối đa ${MAX_VIDEO_DURATION_SEC / 60} phút.`)
        sync()
        continue
      }
      void upload(entry, entry.attempt)
    }
  }

  /** Retries the same file without clearing the draft or its local preview. */
  async function retry(key: string) {
    const entry = entries.current.find((other) => other.key === key)
    if (!entry || entry.status !== "failed") return
    if (!accessToken) {
      const message = "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để thử tải lên."
      entry.error = message
      setError(message)
      sync()
      return
    }
    entry.token = accessToken
    entry.attempt += 1
    const attempt = entry.attempt
    entry.status = "uploading"
    entry.error = undefined
    entry.progress = 0
    setError(null)
    sync()
    if (entry.cleanup) await entry.cleanup
    entry.cleanup = null
    if (!entries.current.includes(entry) || entry.attempt !== attempt) return
    await upload(entry, attempt)
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

  return { uploads, error, add, retry, remove, release }
}
