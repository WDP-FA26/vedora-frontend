"use client"

import useSWR, { useSWRConfig } from "swr"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { profileKey } from "@/features/profiles/profiles-cache"
import {
  deleteMyRestaurantReview,
  fetchRestaurantReviews,
  upsertMyRestaurantReview,
} from "@/features/workspaces/lib/workspaces-api"
import type {
  RestaurantReview,
  RestaurantReviewFormValues,
  RestaurantReviewSort,
} from "@/features/workspaces/schemas"
import {
  restaurantReviewsKey,
  restaurantReviewsPrefix,
} from "@/features/workspaces/workspaces-cache"

const NO_REVIEWS: RestaurantReview[] = []

export function useRestaurantReviews(
  pageUserId: string,
  sort: RestaurantReviewSort,
  page: number,
  limit = 10
) {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()
  const key = [restaurantReviewsKey(pageUserId, sort, page, limit), accessToken] as const

  const { data, error, isLoading, isValidating } = useSWR(key, fetchRestaurantReviews, {
    keepPreviousData: true,
  })

  async function refreshAll() {
    const reviewsPrefix = restaurantReviewsPrefix(pageUserId)
    const profileUrl = profileKey(pageUserId)
    await mutate(
      (candidate) =>
        Array.isArray(candidate) &&
        typeof candidate[0] === "string" &&
        (candidate[0].startsWith(reviewsPrefix) || candidate[0] === profileUrl)
    )
  }

  return {
    summary: data?.summary ?? null,
    myReview: data?.myReview ?? null,
    items: data?.items ?? NO_REVIEWS,
    meta: data?.meta ?? null,
    error,
    isLoading,
    isValidating,
    upsert: async (input: RestaurantReviewFormValues) => {
      if (!accessToken) throw new Error("Not signed in")
      const res = await upsertMyRestaurantReview(accessToken, pageUserId, input)
      await refreshAll()
      return res
    },
    remove: async () => {
      if (!accessToken) throw new Error("Not signed in")
      const summary = await deleteMyRestaurantReview(accessToken, pageUserId)
      await refreshAll()
      return summary
    },
  }
}
