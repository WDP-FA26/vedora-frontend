"use client"

import { useState } from "react"
import { put } from "@vercel/blob/client"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { useSetMyProfile } from "@/features/profiles/hooks/use-profile"
import {
  activateImage,
  removeImage,
  requestImageUpload,
} from "@/features/profiles/lib/profiles-api"
import {
  IMAGE_CONTENT_TYPES,
  MAX_IMAGE_MB,
  type ImageKind,
} from "@/features/profiles/schemas"
import { ApiError } from "@/features/shared/lib/api-client"

const ACTIVATE_ATTEMPTS = 10
const ACTIVATE_RETRY_MS = 1000
/**
 * `put()` retries network and unknown errors up to 10 times with backoff,
 * which can take minutes; give up well before that so the dialog shows an error.
 */
const UPLOAD_TIMEOUT_MS = 30_000

function failureMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 415) {
    return "Ảnh phải là JPEG, PNG hoặc WebP."
  }
  if (error instanceof ApiError && error.status === 413) {
    return "Ảnh quá lớn. Chọn ảnh nhỏ hơn nhé."
  }
  return "Không cập nhật được ảnh. Thử lại nhé."
}

/**
 * vedora-api only activates an upload once Vercel Blob's callback confirmed
 * it, which can land a moment after `put()` resolves. Until then it answers
 * 409 "Image upload is not ready", which is retried. An API on localhost never
 * gets the callback, so there the retries run out.
 */
async function activateWhenConfirmed(token: string, uploadId: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await activateImage(token, uploadId)
    } catch (error) {
      const unconfirmed = error instanceof ApiError && error.status === 409
      if (!unconfirmed || attempt === ACTIVATE_ATTEMPTS) throw error
      await new Promise((resolve) => setTimeout(resolve, ACTIVATE_RETRY_MS))
    }
  }
}

/**
 * Changes or removes the signed-in user's avatar or cover. A change asks
 * vedora-api for a client token scoped to one pathname, uploads the file
 * straight to Vercel Blob with it, then activates the upload on the profile.
 */
export function useProfileImage() {
  const { accessToken } = useAuth()
  const setMyProfile = useSetMyProfile()
  /** Which image is being changed, so only its controls show as busy. */
  const [pending, setPending] = useState<ImageKind | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(kind: ImageKind, change: (token: string) => Promise<void>) {
    if (!accessToken || pending) return
    setError(null)
    setPending(kind)
    try {
      await change(accessToken)
    } catch (err) {
      setError(failureMessage(err))
    } finally {
      setPending(null)
    }
  }

  function upload(kind: ImageKind, file: File) {
    if (!IMAGE_CONTENT_TYPES.includes(file.type)) {
      setError("Ảnh phải là JPEG, PNG hoặc WebP.")
      return Promise.resolve()
    }
    if (file.size > MAX_IMAGE_MB[kind] * 1024 * 1024) {
      setError(`Ảnh lớn hơn ${MAX_IMAGE_MB[kind]} MB. Chọn ảnh nhỏ hơn nhé.`)
      return Promise.resolve()
    }
    return run(kind, async (token) => {
      const target = await requestImageUpload(token, kind, file)
      await put(target.pathname, file, {
        // Profile images are public. Vercel rejects this (400) when the API's
        // store is a Private one, as the shared knowledge-base store is.
        access: "public",
        token: target.clientToken,
        contentType: file.type,
        abortSignal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
      })
      await setMyProfile(await activateWhenConfirmed(token, target.id))
    })
  }

  function remove(kind: ImageKind) {
    return run(kind, async (token) => {
      await setMyProfile(await removeImage(token, kind))
    })
  }

  return { pending, error, upload, remove }
}
