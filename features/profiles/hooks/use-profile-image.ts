"use client"

import { useState } from "react"

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
import { uploadToStorage } from "@/features/shared/lib/storage-upload"

const ACTIVATE_ATTEMPTS = 6
const ACTIVATE_FIRST_RETRY_MS = 250
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

async function activateWhenConfirmed(token: string, uploadId: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await activateImage(token, uploadId)
    } catch (error) {
      const unconfirmed = error instanceof ApiError && error.status === 409
      if (!unconfirmed || attempt === ACTIVATE_ATTEMPTS) throw error
      const delay = ACTIVATE_FIRST_RETRY_MS * 2 ** (attempt - 1)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
}

export function useProfileImage() {
  const { accessToken } = useAuth()
  const setMyProfile = useSetMyProfile()
  const [pending, setPending] = useState<ImageKind | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(kind: ImageKind, change: (token: string) => Promise<void>) {
    if (!accessToken) throw new Error("Phiên đăng nhập đã hết hạn.")
    if (pending) throw new Error("Đang cập nhật ảnh khác.")
    setError(null)
    setPending(kind)
    try {
      await change(accessToken)
    } catch (err) {
      setError(failureMessage(err))
      throw err
    } finally {
      setPending(null)
    }
  }

  function upload(kind: ImageKind, file: File) {
    if (!IMAGE_CONTENT_TYPES.includes(file.type)) {
      setError("Ảnh phải là JPEG, PNG hoặc WebP.")
      return Promise.reject(new Error("Ảnh phải là JPEG, PNG hoặc WebP."))
    }
    if (file.size > MAX_IMAGE_MB[kind] * 1024 * 1024) {
      setError(`Ảnh lớn hơn ${MAX_IMAGE_MB[kind]} MB. Chọn ảnh nhỏ hơn nhé.`)
      return Promise.reject(new Error(`Ảnh lớn hơn ${MAX_IMAGE_MB[kind]} MB.`))
    }
    return run(kind, async (token) => {
      const target = await requestImageUpload(token, kind, file)
      await uploadToStorage(target.upload, file, {
        signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
      })
      await setMyProfile(await activateWhenConfirmed(token, target.id))
    })
  }

  function remove(kind: ImageKind) {
    return run(kind, async (token) => {
      await setMyProfile(await removeImage(token, kind))
    })
  }

  return { pending, error, upload, remove, clearError: () => setError(null) }
}
