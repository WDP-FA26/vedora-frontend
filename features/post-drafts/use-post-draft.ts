"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import type { MediaUpload } from "@/features/posts/hooks/use-media-uploads"
import { usePostDraftManager } from "./provider"
import type { DraftKind } from "./schemas"
import { EMPTY } from "./manager"

const subscribeEmpty = () => () => undefined
const getEmpty = () => EMPTY

export function usePostDraft({
  kind,
  draftId,
  onChange,
}: {
  kind: DraftKind
  draftId?: string
  onChange: (ids: string[], count: number) => void
}) {
  const manager = usePostDraftManager()
  const [localId, setLocalId] = useState(() => crypto.randomUUID())
  const id = draftId ?? localId
  const state = useSyncExternalStore(
    manager?.subscribe ?? subscribeEmpty,
    manager?.getSnapshot ?? getEmpty,
    getEmpty
  )
  const draft = state.drafts.find((item) => item.id === id)
  const callback = useRef(onChange)
  useEffect(() => {
    callback.current = onChange
  })
  useEffect(() => {
    if (manager && state.loaded && !draftId)
      void manager.ensure(id, kind).catch(() => undefined)
  }, [manager, state.loaded, id, kind, draftId])
  const uploads: MediaUpload[] = (draft?.files ?? []).map((file) => {
    const complete =
      file.state === "ready" || (file.state === "uploaded" && file.media?.status === "PROCESSING")
    return {
      key: file.key,
      fileName: file.name,
      previewUrl:
        state.previews[file.key] ??
        (file.media?.publicId && process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
          ? `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/video/upload/${file.media.publicId}.mp4`
          : ""),
      durationSec: file.media?.durationSec ?? null,
      status: file.state === "failed" ? "failed" : complete ? "ready" : "uploading",
      mediaId: complete ? file.mediaId : null,
      progress: complete || file.state === "uploaded" ? 100 : (state.progress[file.key] ?? 0),
      error: file.error,
    }
  })
  const signature = JSON.stringify([
    uploads.flatMap((file) => (file.mediaId ? [file.mediaId] : [])),
    uploads.length,
  ])
  useEffect(() => {
    const [ids, count] = JSON.parse(signature) as [string[], number]
    callback.current(ids, count)
  }, [signature])
  return {
    id,
    draft,
    uploads,
    loading: !state.loaded,
    error: state.storageError ?? draft?.error ?? null,
    hasDraft: Boolean(
      draft?.files.length || (draft?.version !== null && draft?.version !== undefined)
    ),
    update: (values: { body?: string; title?: string; description?: string }) =>
      manager?.update(id, values),
    add: (files: File[]) => manager?.add(id, files).catch(() => undefined) ?? Promise.resolve(),
    remove: (key: string) => manager?.removeFile(id, key),
    retry: (key: string) => manager?.retry(id, key),
    release: () => {
      if (!draftId) setLocalId(crypto.randomUUID())
    },
    publish: async () => {
      if (!manager) throw new Error("Nháp chưa sẵn sàng")
      return manager.publish(id)
    },
  }
}
