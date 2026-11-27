import { KNOWLEDGE_DOCUMENTS_KEY } from "@/features/knowledge/knowledge-cache"
import {
  knowledgeDocumentListSchema,
  knowledgeDocumentSchema,
  knowledgeFileUrlSchema,
  knowledgePageListSchema,
  knowledgeUploadSchema,
} from "@/features/knowledge/schemas"
import { send, sendJson } from "@/features/shared/lib/api-client"

export function fetchKnowledgeDocuments([url, token]: readonly [string, string]) {
  return sendJson(knowledgeDocumentListSchema, url, token)
}

export function requestKnowledgeUpload(token: string, file: File) {
  return sendJson(knowledgeUploadSchema, KNOWLEDGE_DOCUMENTS_KEY, token, {
    method: "POST",
    body: JSON.stringify({ filename: file.name, sizeBytes: file.size }),
  })
}

export function confirmKnowledgeUpload(token: string, id: string) {
  return sendJson(knowledgeDocumentSchema, `${KNOWLEDGE_DOCUMENTS_KEY}/${id}/confirm`, token, {
    method: "POST",
  })
}

export async function deleteKnowledgeDocument(token: string, id: string) {
  await send(`${KNOWLEDGE_DOCUMENTS_KEY}/${id}`, token, { method: "DELETE" })
}

export function fetchKnowledgeDocument([url, token]: readonly [string, string]) {
  return sendJson(knowledgeDocumentSchema, url, token)
}

export function fetchKnowledgePages([url, token]: readonly [string, string]) {
  return sendJson(knowledgePageListSchema, url, token)
}

export function fetchKnowledgeFileUrl([url, token]: readonly [string, string]) {
  return sendJson(knowledgeFileUrlSchema, url, token)
}

export async function updateKnowledgePage(
  token: string,
  id: string,
  page: number,
  text: string
) {
  await send(`${KNOWLEDGE_DOCUMENTS_KEY}/${id}/pages/${page}`, token, {
    method: "PATCH",
    body: JSON.stringify({ text }),
  })
}

type ReviewAction = "approve" | "reject" | "reopen"

export function reviewKnowledgeDocument(
  token: string,
  id: string,
  action: ReviewAction,
  note: string | null
) {
  const body = action === "reopen" || !note ? {} : { note }
  return sendJson(knowledgeDocumentSchema, `${KNOWLEDGE_DOCUMENTS_KEY}/${id}/${action}`, token, {
    method: "POST",
    body: JSON.stringify(body),
  })
}
