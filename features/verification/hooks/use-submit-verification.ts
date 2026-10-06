"use client"

import { useRef } from "react"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { uploadToStorage } from "@/features/shared/lib/storage-upload"
import {
  requestProofUpload,
  submitVerification,
} from "@/features/verification/lib/verification-api"
import type { VerificationFormValues } from "@/features/verification/schemas"

const UPLOAD_TIMEOUT_MS = 60_000

/** Uploads the proof images, then submits the request with their ids. */
export function useSubmitVerification() {
  const { accessToken } = useAuth()
  // Uploaded files keep their id, so a retry after a failure sends only the rest.
  const uploaded = useRef(new WeakMap<File, string>())

  return async ({ statement, proofs }: VerificationFormValues) => {
    if (!accessToken) throw new Error("Not signed in")
    const proofIds = await Promise.all(
      proofs.map(async ({ file }) => {
        const known = uploaded.current.get(file)
        if (known) return known
        const target = await requestProofUpload(accessToken, file)
        await uploadToStorage(target.upload, file, {
          signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
        })
        uploaded.current.set(file, target.id)
        return target.id
      })
    )
    return submitVerification(accessToken, { statement, proofIds })
  }
}
