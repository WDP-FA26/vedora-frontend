"use client"

import { useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import useSWR, { useSWRConfig } from "swr"

import { useAuth } from "@/features/auth/hooks/use-auth"
import {
  fetchMyRating,
  fetchRatingSummary,
  setRecipeRating,
} from "@/features/recipes/lib/recipes-api"
import { myRatingKey, ratingSummaryKey } from "@/features/recipes/recipes-cache"
import type { MyRating, RatingSummary } from "@/features/recipes/schemas"
import { ApiError } from "@/features/shared/lib/api-client"

function errorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return "Không gửi được đánh giá. Kiểm tra kết nối rồi thử lại."
  if (error.code === "SELF_RATING_NOT_ALLOWED") return "Bạn không thể tự đánh giá công thức của mình."
  if (error.code === "EMAIL_NOT_VERIFIED") return "Xác minh email trước khi đánh giá công thức."
  if (error.code === "RATING_CONFLICT") return "Đánh giá vừa thay đổi. Đã tải lại, vui lòng thử lại."
  if (error.status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng thử lại."
  if (error.status === 404) return "Công thức này không còn tồn tại."
  return "Không gửi được đánh giá. Vui lòng thử lại."
}

export function useRecipeRating(recipeId: string) {
  const { user, accessToken, error: authError } = useAuth()
  const { mutate } = useSWRConfig()
  const router = useRouter()
  const pathname = usePathname()

  const guest = !accessToken || Boolean(authError)
  const summaryKey = [ratingSummaryKey(recipeId), undefined] as const
  const mineKey =
    accessToken && user ? ([myRatingKey(recipeId), accessToken, user.id] as const) : null

  const summary = useSWR(guest ? summaryKey : null, fetchRatingSummary)
  const mine = useSWR(guest ? null : mineKey, fetchMyRating)
  const current = guest ? summary : mine
  const data: RatingSummary | MyRating | undefined = current.data

  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selfRating, setSelfRating] = useState(false)
  const inFlight = useRef(false)

  async function rate(value: number | null) {
    if (!accessToken) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`)
      return
    }
    if (!mineKey || inFlight.current || !data || !("myRating" in data)) return
    if (data.myRating === value) return

    inFlight.current = true
    setPending(true)
    setError(null)
    try {
      const saved = await setRecipeRating(accessToken, recipeId, value)
      await mutate(mineKey, saved, { revalidate: false })
      const { recipeId: id, ratingCount, averageRating } = saved
      await mutate(summaryKey, { recipeId: id, ratingCount, averageRating }, { revalidate: false })
    } catch (caught) {
      setError(errorMessage(caught))
      if (caught instanceof ApiError) {
        if (caught.code === "SELF_RATING_NOT_ALLOWED") setSelfRating(true)
        if (caught.status === 409) void mine.mutate()
        if (caught.status === 401) router.refresh()
      }
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  return {
    summary: data ?? null,
    myRating: data && "myRating" in data ? data.myRating : undefined,
    isLoading: !data && !current.error,
    loadError: data ? null : (current.error as unknown),
    retryLoad: () => current.mutate(),
    signedIn: !guest,
    pending,
    error,
    selfRating,
    rate: (value: number) => rate(value),
    clear: () => rate(null),
  }
}
