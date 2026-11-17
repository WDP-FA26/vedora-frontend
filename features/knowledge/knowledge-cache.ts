import { API_URL } from "@/features/auth/lib/api"

/**
 * SWR key for the knowledge-base document list: `[url, accessToken]`, fetched
 * with `fetchKnowledgeDocuments`, like the posts keys.
 */
export const KNOWLEDGE_DOCUMENTS_KEY = `${API_URL}/knowledge/documents`

export const knowledgeDocumentKey = (id: string) =>
  `${KNOWLEDGE_DOCUMENTS_KEY}/${id}`
export const knowledgePagesKey = (id: string) =>
  `${KNOWLEDGE_DOCUMENTS_KEY}/${id}/pages`
export const knowledgeFileUrlKey = (id: string) =>
  `${KNOWLEDGE_DOCUMENTS_KEY}/${id}/file-url`
