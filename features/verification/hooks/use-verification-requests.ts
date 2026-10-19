"use client"

import { useSWRConfig } from "swr"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import {
  fetchAllVerificationRequests,
  fetchVerificationRequest,
  reviewVerificationRequest,
} from "@/features/verification/lib/verification-api"
import type { AdminVerificationRequest } from "@/features/verification/schemas"
import {
  VERIFICATION_REQUESTS_KEY,
  verificationRequestKey,
} from "@/features/verification/verification-cache"

// TanStack Table rebuilds its row models whenever `data` changes identity.
const NO_REQUESTS: AdminVerificationRequest[] = []

export function useVerificationRequests() {
  const { data, error, isLoading } = useAuthedSWR(VERIFICATION_REQUESTS_KEY, fetchAllVerificationRequests)
  return { requests: data ?? NO_REQUESTS, error, isLoading }
}

/** One request with its proof images. The image URLs are signed and expire. */
export function useVerificationRequest(id: string | null) {
  const { data, error, isLoading } = useAuthedSWR(id ? verificationRequestKey(id) : null, fetchVerificationRequest,
    { dedupingInterval: 0 }
  )
  return { request: data ?? null, error, isLoading }
}

/** Approves or rejects a request and writes the result into the list. */
export function useReviewVerificationRequest() {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()

  return async (
    id: string,
    input: { decision: "APPROVED" | "REJECTED"; note?: string }
  ) => {
    if (!accessToken) throw new Error("Not signed in")
    const reviewed = await reviewVerificationRequest(accessToken, id, input)
    await Promise.all([
      mutate<AdminVerificationRequest[]>(
        [VERIFICATION_REQUESTS_KEY, accessToken],
        (requests) =>
          requests?.map((request) => (request.id === id ? reviewed : request)),
        { revalidate: false }
      ),
      mutate([verificationRequestKey(id), accessToken]),
    ])
  }
}
