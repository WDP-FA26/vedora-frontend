import { API_URL } from "@/features/auth/lib/api"
import { send, sendJson } from "@/features/shared/lib/api-client"
import { apiPostSchema } from "@/features/posts/schemas"
import { draftUploadSchema, postDraftPageSchema, postDraftSchema, type DraftKind } from "./schemas"

const root = `${API_URL}/posts/drafts`
export const listPostDrafts = (token: string) => sendJson(postDraftPageSchema, root, token)
export const getPostDraft = (token: string, id: string) =>
  sendJson(postDraftSchema, `${root}/${id}`, token)
export const createPostDraft = (token: string, id: string, kind: DraftKind) =>
  sendJson(postDraftSchema, root, token, { method: "POST", body: JSON.stringify({ id, kind }) })
export const savePostDraft = (
  token: string,
  id: string,
  expectedVersion: number,
  input: { body: string; title: string; description: string }
) =>
  sendJson(postDraftSchema, `${root}/${id}`, token, {
    method: "PATCH",
    body: JSON.stringify({ expectedVersion, ...input }),
  })
export const requestDraftUpload = (token: string, id: string, mediaId: string) =>
  sendJson(draftUploadSchema, `${root}/${id}/uploads`, token, {
    method: "POST",
    body: JSON.stringify({ mediaId }),
  })
export const removeDraftMedia = (
  token: string,
  id: string,
  mediaId: string,
  expectedVersion: number
) =>
  sendJson(postDraftSchema, `${root}/${id}/media/${mediaId}`, token, {
    method: "DELETE",
    body: JSON.stringify({ expectedVersion }),
  })
export const publishPostDraft = (token: string, id: string, expectedVersion: number) =>
  sendJson(apiPostSchema, `${root}/${id}/publish`, token, {
    method: "POST",
    body: JSON.stringify({ expectedVersion }),
  })
export const deletePostDraft = async (token: string, id: string) => {
  await send(`${root}/${id}`, token, { method: "DELETE" })
}
