"use client"

import { useEffect, useEffectEvent, useRef, useState } from "react"

import { useAuth } from "@/features/auth/hooks/use-auth"
import {
  useDeleteKnowledgeDocument,
  useUpsertKnowledgeDocument,
} from "@/features/knowledge/hooks/use-knowledge-documents"
import { requestKnowledgeUpload } from "@/features/knowledge/lib/knowledge-api"
import { MAX_KNOWLEDGE_FILE_MB } from "@/features/knowledge/schemas"
import { ApiError } from "@/features/shared/lib/api-client"
import { uploadToStorage } from "@/features/shared/lib/storage-upload"

export type KnowledgeUpload = {
  key: string
  name: string
  progress: number
}

type Entry = KnowledgeUpload & {
  abort: AbortController
  documentId: string | null
}

function failureMessage(error: unknown, name: string) {
  if (error instanceof ApiError && error.status === 415) {
    return `“${name}” không phải loại tệp được hỗ trợ.`
  }
  if (error instanceof ApiError && error.status === 413) {
    return `“${name}” lớn hơn ${MAX_KNOWLEDGE_FILE_MB} MB.`
  }
  return `Tải “${name}” lên thất bại. Thử lại nhé.`
}

export function useKnowledgeUploads() {
  const { accessToken } = useAuth()
  const upsert = useUpsertKnowledgeDocument()
  const deleteDocument = useDeleteKnowledgeDocument()
  const entries = useRef<Entry[]>([])
  const [uploads, setUploads] = useState<KnowledgeUpload[]>([])
  const [error, setError] = useState<string | null>(null)

  function sync() {
    setUploads(entries.current.map(({ key, name, progress }) => ({ key, name, progress })))
  }

  function drop(entry: Entry, { discard }: { discard: boolean }) {
    entries.current = entries.current.filter((other) => other !== entry)
    entry.abort.abort()
    if (discard && entry.documentId) {
      deleteDocument(entry.documentId).catch(() => {
        // Uploads that never complete are also failed by the API's cron.
      })
    }
    sync()
  }

  const discardAll = useEffectEvent(() => {
    for (const entry of [...entries.current]) drop(entry, { discard: true })
  })
  useEffect(() => () => discardAll(), [])

  async function upload(entry: Entry, file: File, token: string) {
    try {
      const target = await requestKnowledgeUpload(token, file)
      entry.documentId = target.document.id
      void upsert(target.document)
      // Cancelled while the token was being issued.
      if (entry.abort.signal.aborted) {
        await deleteDocument(target.document.id)
        return
      }

      await uploadToStorage(target.upload, file, {
        signal: entry.abort.signal,
        onProgress: (percentage) => {
          const progress = Math.round(percentage)
          if (progress === entry.progress) return
          entry.progress = progress
          sync()
        },
      })
      drop(entry, { discard: false })
    } catch (err) {
      if (entry.abort.signal.aborted) return
      drop(entry, { discard: true })
      setError(failureMessage(err, file.name))
    }
  }

  function add(files: File[]) {
    if (!accessToken) return
    setError(null)
    for (const file of files) {
      const entry: Entry = {
        key: crypto.randomUUID(),
        name: file.name,
        progress: 0,
        abort: new AbortController(),
        documentId: null,
      }
      entries.current = [...entries.current, entry]
      void upload(entry, file, accessToken)
    }
    sync()
  }

  function cancel(key: string) {
    const entry = entries.current.find((other) => other.key === key)
    if (entry) drop(entry, { discard: true })
  }

  return { uploads, error, add, cancel }
}
