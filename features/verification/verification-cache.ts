import { API_URL } from "@/features/auth/lib/api"

const VERIFICATION_KEY = `${API_URL}/verification`

export const MY_VERIFICATION_KEY = `${VERIFICATION_KEY}/me`

export const PROOF_UPLOADS_KEY = `${VERIFICATION_KEY}/proofs/uploads`

export const VERIFICATION_REQUESTS_KEY = `${VERIFICATION_KEY}/requests`

export function verificationRequestKey(id: string) {
  return `${VERIFICATION_REQUESTS_KEY}/${id}`
}

export const VERIFICATION_PATH = "/home/verification"
