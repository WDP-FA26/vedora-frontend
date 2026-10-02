"use client"

import { useState } from "react"
import useSWR, { useSWRConfig } from "swr"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { KNOWLEDGE_DOCUMENTS_KEY } from "@/features/knowledge/knowledge-cache"
import {
  deleteKnowledgeDocument,
  fetchKnowledgeDocuments,
} from "@/features/knowledge/lib/knowledge-api"
import type { KnowledgeDocument } from "@/features/knowledge/schemas"

const isPending = (document: KnowledgeDocument) =>
  document.status === "WAITING_UPLOAD" || document.status === "PROCESSING"

/**
 * Knowledge-base documents, newest first. Polls while any is waiting for its
 * Vercel Blob callback or being extracted, since the API settles them in the
 * background.
 *
 * The interval is a number rather than a function: once a function returns 0
 * SWR stops polling for good, so a list that loads with nothing pending would
 * never restart. Uploads revalidate the list, so `onSuccess` sees them.
 */
export function useKnowledgeDocuments() {
  const { accessToken } = useAuth()
  const [polling, setPolling] = useState(false)
  const { data, error, isLoading } = useSWR(
    accessToken ? ([KNOWLEDGE_DOCUMENTS_KEY, accessToken] as const) : null,
    fetchKnowledgeDocuments,
    {
      refreshInterval: polling ? 3000 : 0,
      onSuccess: (documents) => setPolling(documents.some(isPending)),
    }
  )
  return { documents: data ?? [], error, isLoading }
}

/**
 * Writes a document into the cached list (prepends it, or replaces it by id),
 * then revalidates, which starts polling while it is pending.
 */
export function useUpsertKnowledgeDocument() {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()

  return (document: KnowledgeDocument) =>
    mutate(
      [KNOWLEDGE_DOCUMENTS_KEY, accessToken],
      (documents: KnowledgeDocument[] = []) =>
        documents.some((other) => other.id === document.id)
          ? documents.map((other) => (other.id === document.id ? document : other))
          : [document, ...documents]
    )
}

/** Deletes a document, removing it from the list optimistically. */
export function useDeleteKnowledgeDocument() {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()

  return (id: string) => {
    if (!accessToken) return Promise.resolve()
    const without = (documents: KnowledgeDocument[] = []) =>
      documents.filter((document) => document.id !== id)
    return mutate(
      [KNOWLEDGE_DOCUMENTS_KEY, accessToken],
      async (documents: KnowledgeDocument[] = []) => {
        await deleteKnowledgeDocument(accessToken, id)
        return without(documents)
      },
      { optimisticData: without, rollbackOnError: true, revalidate: false }
    )
  }
}
