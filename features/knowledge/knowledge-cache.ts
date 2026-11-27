import { API_URL } from "@/features/auth/lib/api"

export const KNOWLEDGE_DOCUMENTS_KEY = `${API_URL}/knowledge/documents`

export const knowledgeDocumentKey = (id: string) =>
  `${KNOWLEDGE_DOCUMENTS_KEY}/${id}`
export const knowledgePagesKey = (id: string) =>
  `${KNOWLEDGE_DOCUMENTS_KEY}/${id}/pages`
export const knowledgeFileUrlKey = (id: string) =>
  `${KNOWLEDGE_DOCUMENTS_KEY}/${id}/file-url`
