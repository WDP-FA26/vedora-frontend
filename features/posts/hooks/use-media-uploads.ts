"use client"

import { useEffect, useRef, useState } from "react"

import { useAuth } from "@/features/auth/hooks/use-auth"
import {
  CloudinaryUploadError,
  uploadToCloudinary,
  type UploadTask,
} from "@/features/posts/lib/cloudinary-upload"
import { discardMedia, requestVideoUpload } from "@/features/posts/lib/posts-api"
import { videoDuration } from "@/features/post-drafts/video-file"
import { ApiError } from "@/features/shared/lib/api-client"
import {
  MAX_POST_MEDIA,
  MAX_VIDEO_DURATION_SEC,
  type VideoUploadTarget,
} from "@/features/posts/schemas"

export type MediaUpload = {
  key: string
  previewUrl: string
  fileName: string
  durationSec: number | null
  status: "uploading" | "ready" | "failed"
  error?: string
  progress: number
  mediaId: string | null
}

type Entry = MediaUpload & {
  file: File
  token: string
  pendingId: string | null
  task: UploadTask | null
  attempt: number
  cleanup: Promise<void> | null
}

export function useMediaUploads({
  onChange,
  reserved = 0,
}: {
  onChange: (mediaIds: string[], count: number) => void
  reserved?: number
}) {
  const { accessToken } = useAuth()
  const entries = useRef<Entry[]>([])
  const [uploads, setUploads] = useState<MediaUpload[]>([])
  const [error, setError] = useState<string | null>(null)

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
    if (!entries.current.includes(entry) || entry.attempt !== attempt || entry.status !== "uploading") {
      discardMedia(entry.token, mediaId).catch(() => {})
      return
    }
    entry.pendingId = mediaId

    const current = () =>
      entries.current.includes(entry) && entry.attempt === attempt && entry.status === "uploading"
    const task = uploadToCloudinary(target.upload, entry.file, (percent) => {
      if (!current()) return
      entry.progress = percent
      sync()
    })
    entry.task = task
    task.done.then(
      () => {
        if (!current()) return
        entry.task = null
        entry.pendingId = null
        entry.progress = 100
        entry.mediaId = mediaId
        entry.status = "ready"
        entry.error = undefined
        sync()
      },
      (err: unknown) =>
        fail(
          entry,
          attempt,
          err instanceof CloudinaryUploadError && /too large/i.test(err.message)
            ? "Video quá lớn để tải lên."
            : "Tải video lên thất bại. Thử lại nhé."
        )
    )
  }

  async function add(files: File[]) {
    if (!accessToken) return
    setError(null)
    const room = MAX_POST_MEDIA - reserved - entries.current.length
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
      entries.current = [...entries.current, entry]
      sync()

      const duration = await videoDuration(file)
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

  function remove(key: string) {
    const entry = entries.current.find((other) => other.key === key)
    if (!entry) return
    drop(entry, { discard: true })
    setError(null)
    sync()
  }

  function release() {
    for (const entry of [...entries.current]) drop(entry, { discard: false })
    setError(null)
    sync()
  }

  return { uploads, error, add, retry, remove, release }
}
