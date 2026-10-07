import { API_URL } from "@/features/auth/lib/api"
import { send, sendJson } from "@/features/shared/lib/api-client"
import { MY_PROFILE_KEY, profileKey } from "@/features/profiles/profiles-cache"
import {
  apiProfileSchema,
  imageUploadSchema,
  profilePageSchema,
  relationshipSchema,
  type ImageKind,
} from "@/features/profiles/schemas"

export function fetchProfile([url, token]: readonly [string, string | undefined]) {
  return sendJson(apiProfileSchema, url, token)
}

export function fetchRelationship([url, token]: readonly [string, string]) {
  return sendJson(relationshipSchema, url, token)
}

export function fetchProfilePage([url, token]: readonly [string, string | undefined]) {
  return sendJson(profilePageSchema, url, token)
}

export function updateMyProfile(token: string, input: { fullName?: string; bio?: string }) {
  return sendJson(apiProfileSchema, MY_PROFILE_KEY, token, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
}

/** Usernames belong to the account, so they change through `/users`, not `/profiles`. */
export async function updateMyUsername(token: string, id: string, username: string) {
  await send(`${API_URL}/users/${id}`, token, {
    method: "PATCH",
    body: JSON.stringify({ username }),
  })
}

export async function followProfile(token: string, id: string) {
  await send(`${profileKey(id)}/follow`, token, { method: "PUT" })
}

export async function unfollowProfile(token: string, id: string) {
  await send(`${profileKey(id)}/follow`, token, { method: "DELETE" })
}

export function requestImageUpload(token: string, kind: ImageKind, file: File) {
  return sendJson(imageUploadSchema, `${MY_PROFILE_KEY}/images/uploads`, token, {
    method: "POST",
    body: JSON.stringify({ kind, contentType: file.type, sizeBytes: file.size }),
  })
}

export function activateImage(token: string, uploadId: string) {
  return sendJson(apiProfileSchema, `${MY_PROFILE_KEY}/images/${uploadId}/activate`, token, {
    method: "POST",
  })
}

export function removeImage(token: string, kind: ImageKind) {
  return sendJson(apiProfileSchema, `${MY_PROFILE_KEY}/images/${kind}`, token, {
    method: "DELETE",
  })
}
