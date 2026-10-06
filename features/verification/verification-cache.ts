import { API_URL } from "@/features/auth/lib/api"

/** SWR keys for professional verification: `[url, accessToken]` tuples. */
const VERIFICATION_KEY = `${API_URL}/verification`

/** Whether the signed-in user is a verified professional, and their latest request. */
export const MY_VERIFICATION_KEY = `${VERIFICATION_KEY}/me`

export const PROOF_UPLOADS_KEY = `${VERIFICATION_KEY}/proofs/uploads`

/** Every request, for admins; also where a new request is posted. */
export const VERIFICATION_REQUESTS_KEY = `${VERIFICATION_KEY}/requests`

/** One request with signed proof image URLs, for admins. */
export function verificationRequestKey(id: string) {
  return `${VERIFICATION_REQUESTS_KEY}/${id}`
}

export const VERIFICATION_PATH = "/home/verification"
