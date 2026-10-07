import { sendJson } from "@/features/shared/lib/api-client"
import {
  adminVerificationRequestDetailSchema,
  adminVerificationRequestPageSchema,
  adminVerificationRequestSchema,
  myVerificationSchema,
  proofUploadSchema,
  submittedRequestSchema,
  type AdminVerificationRequest,
} from "@/features/verification/schemas"
import {
  PROOF_UPLOADS_KEY,
  VERIFICATION_REQUESTS_KEY,
  verificationRequestKey,
} from "@/features/verification/verification-cache"

/** The API's `MAX_PAGE_LIMIT`. */
const PAGE_LIMIT = 50

export function fetchMyVerification([url, token]: readonly [string, string]) {
  return sendJson(myVerificationSchema, url, token)
}

export function requestProofUpload(token: string, file: File) {
  return sendJson(proofUploadSchema, PROOF_UPLOADS_KEY, token, {
    method: "POST",
    body: JSON.stringify({ contentType: file.type, sizeBytes: file.size }),
  })
}

export function submitVerification(
  token: string,
  input: { statement: string; proofIds: string[] }
) {
  return sendJson(submittedRequestSchema, VERIFICATION_REQUESTS_KEY, token, {
    method: "POST",
    body: JSON.stringify(input),
  })
}

/**
 * Every request, newest first. The admin table sorts, filters and paginates
 * in the browser, so it needs the whole list.
 */
export async function fetchAllVerificationRequests([url, token]: readonly [
  string,
  string,
]) {
  const requests: AdminVerificationRequest[] = []
  for (let page = 1; ; page++) {
    const { items, meta } = await sendJson(
      adminVerificationRequestPageSchema,
      `${url}?page=${page}&limit=${PAGE_LIMIT}`,
      token
    )
    requests.push(...items)
    if (!meta.hasNextPage) return requests
  }
}

export function fetchVerificationRequest([url, token]: readonly [string, string]) {
  return sendJson(adminVerificationRequestDetailSchema, url, token)
}

export function reviewVerificationRequest(
  token: string,
  id: string,
  input: { decision: "APPROVED" | "REJECTED"; note?: string }
) {
  return sendJson(
    adminVerificationRequestSchema,
    `${verificationRequestKey(id)}/review`,
    token,
    { method: "POST", body: JSON.stringify(input) }
  )
}
