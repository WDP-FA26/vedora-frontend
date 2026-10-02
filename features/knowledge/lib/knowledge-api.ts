import { KNOWLEDGE_DOCUMENTS_KEY } from "@/features/knowledge/knowledge-cache"
import {
  knowledgeDocumentListSchema,
  knowledgeUploadSchema,
} from "@/features/knowledge/schemas"
import { send, sendJson } from "@/features/shared/lib/api-client"

/** SWR fetcher for `[KNOWLEDGE_DOCUMENTS_KEY, accessToken]`. */
export function fetchKnowledgeDocuments([url, token]: readonly [string, string]) {
  return sendJson(knowledgeDocumentListSchema, url, token)
}

/** Creates the document and a Vercel Blob client token for its pathname. */
export function requestKnowledgeUpload(token: string, file: File) {
  return sendJson(knowledgeUploadSchema, KNOWLEDGE_DOCUMENTS_KEY, token, {
    method: "POST",
    body: JSON.stringify({ filename: file.name, sizeBytes: file.size }),
  })
}

export async function deleteKnowledgeDocument(token: string, id: string) {
  await send(`${KNOWLEDGE_DOCUMENTS_KEY}/${id}`, token, { method: "DELETE" })
}
