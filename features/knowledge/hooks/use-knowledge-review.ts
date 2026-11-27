"use client"

import { useState } from "react"
import { useSWRConfig } from "swr"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import {
  KNOWLEDGE_DOCUMENTS_KEY,
  knowledgeDocumentKey,
  knowledgeFileUrlKey,
  knowledgePagesKey,
} from "@/features/knowledge/knowledge-cache"
import {
  fetchKnowledgeDocument,
  fetchKnowledgeFileUrl,
  fetchKnowledgePages,
  reviewKnowledgeDocument,
  updateKnowledgePage,
} from "@/features/knowledge/lib/knowledge-api"
import type { KnowledgeDocument, KnowledgePage } from "@/features/knowledge/schemas"

const INDEXING_POLL_MS = 3000

const isBusy = (document: KnowledgeDocument) =>
  document.status === "INDEXING" ||
  document.status === "PROCESSING" ||
  document.status === "WAITING_UPLOAD"

export function useKnowledgeDocumentDetail(id: string) {
  const [polling, setPolling] = useState(false)
  return useAuthedSWR(knowledgeDocumentKey(id), fetchKnowledgeDocument, {
    refreshInterval: polling ? INDEXING_POLL_MS : 0,
    onSuccess: (document) => setPolling(isBusy(document)),
  })
}

export function useKnowledgePages(id: string, skip: boolean) {
  return useAuthedSWR(skip ? null : knowledgePagesKey(id), fetchKnowledgePages, {
    revalidateOnFocus: false,
  })
}

export function useKnowledgeFileUrl(id: string, skip: boolean) {
  return useAuthedSWR(skip ? null : knowledgeFileUrlKey(id), fetchKnowledgeFileUrl, {
    revalidateOnFocus: false,
  })
}

export function useKnowledgeReviewActions(id: string) {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()

  async function savePages(edits: ReadonlyMap<number, string>) {
    if (!accessToken) throw new Error("Not signed in")
    for (const [page, text] of edits) {
      await updateKnowledgePage(accessToken, id, page, text)
    }
    await mutate(
      [knowledgePagesKey(id), accessToken],
      (pages: KnowledgePage[] = []) =>
        pages.map((page) => {
          const text = edits.get(page.page)
          return text === undefined ? page : { ...page, text, edited: true }
        }),
      { revalidate: false }
    )
  }

  async function review(action: "approve" | "reject" | "reopen", note: string | null) {
    if (!accessToken) throw new Error("Not signed in")
    const document = await reviewKnowledgeDocument(accessToken, id, action, note)
    await mutate([knowledgeDocumentKey(id), accessToken], document, {
      revalidate: document.status === "INDEXING",
    })
    await mutate(
      [KNOWLEDGE_DOCUMENTS_KEY, accessToken],
      (documents: KnowledgeDocument[] = []) =>
        documents.map((other) => (other.id === document.id ? document : other)),
      { revalidate: false }
    )
  }

  return {
    savePages,
    approve: (note: string | null) => review("approve", note),
    reject: (note: string | null) => review("reject", note),
    reopen: () => review("reopen", null),
  }
}
