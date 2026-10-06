import { send, sendJson } from "@/features/shared/lib/api-client"
import { MY_PROFILE_KEY, profileKey } from "@/features/profiles/profiles-cache"
import {
  apiProfileSchema,
  imageUploadSchema,
  profilePageSchema,
  relationshipSchema,
  type ImageKind,
} from "@/features/profiles/schemas"

/** SWR fetcher for `[MY_PROFILE_KEY | profileKey(id), accessToken]`. Guests may read a profile by id. */
export function fetchProfile([url, token]: readonly [string, string | undefined]) {
  return sendJson(apiProfileSchema, url, token)
}

/** SWR fetcher for `[relationshipKey(id), accessToken]`. */
export function fetchRelationship([url, token]: readonly [string, string]) {
  return sendJson(relationshipSchema, url, token)
}

/** SWR fetcher for `[profileListKey(id, kind) (+ ?cursor=), accessToken]`. Guests may read these. */
export function fetchProfilePage([url, token]: readonly [string, string | undefined]) {
  return sendJson(profilePageSchema, url, token)
}

export function updateMyProfile(token: string, input: { fullName?: string; bio?: string }) {
  return sendJson(apiProfileSchema, MY_PROFILE_KEY, token, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
}

/** Idempotent: following a profile you already follow is not an error. */
export async function followProfile(token: string, id: string) {
  await send(`${profileKey(id)}/follow`, token, { method: "PUT" })
}

/** Idempotent, like `followProfile`. */
export async function unfollowProfile(token: string, id: string) {
  await send(`${profileKey(id)}/follow`, token, { method: "DELETE" })
}

/** Step 1 of an image change: a client token for uploading `file` to Vercel Blob. */
export function requestImageUpload(token: string, kind: ImageKind, file: File) {
  return sendJson(imageUploadSchema, `${MY_PROFILE_KEY}/images/uploads`, token, {
    method: "POST",
    body: JSON.stringify({ kind, contentType: file.type, sizeBytes: file.size }),
  })
}

/** Step 3, after the file is on Vercel Blob: put it on the profile. */
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
