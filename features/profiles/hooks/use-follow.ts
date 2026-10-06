"use client"

import { useState } from "react"
import useSWR, { useSWRConfig } from "swr"

import { useAuth } from "@/features/auth/hooks/use-auth"
import {
  fetchRelationship,
  followProfile,
  unfollowProfile,
} from "@/features/profiles/lib/profiles-api"
import {
  MY_PROFILE_KEY,
  profileKey,
  relationshipKey,
} from "@/features/profiles/profiles-cache"
import type { ApiProfile, Relationship } from "@/features/profiles/schemas"

/** Whether the signed-in user follows profile `id`, and a toggle for it. Idle when signed out. */
export function useFollow(id: string) {
  const { accessToken, user } = useAuth()
  const { mutate } = useSWRConfig()
  const [isPending, setIsPending] = useState(false)
  const { data, isLoading } = useSWR(
    accessToken ? ([relationshipKey(id), accessToken] as const) : null,
    fetchRelationship
  )

  /** Shifts a cached count at once, then refetches the profile to sync with the API. */
  function shift(key: string, field: "followerCount" | "followingCount", by: number) {
    return mutate(
      [key, accessToken],
      (profile: ApiProfile | undefined) =>
        profile && { ...profile, [field]: Math.max(0, profile[field] + by) },
      { revalidate: true }
    )
  }

  async function toggle() {
    if (!accessToken || !data || isPending) return
    const next: Relationship = { isFollowing: !data.isFollowing }
    const by = next.isFollowing ? 1 : -1

    setIsPending(true)
    try {
      // Shows the new state at once; rolls back if the API call fails.
      await mutate(
        [relationshipKey(id), accessToken],
        async () => {
          await (next.isFollowing ? followProfile : unfollowProfile)(accessToken, id)
          return next
        },
        { optimisticData: next, rollbackOnError: true, revalidate: false }
      )
      await Promise.all([
        shift(profileKey(id), "followerCount", by),
        shift(MY_PROFILE_KEY, "followingCount", by),
        user && shift(profileKey(user.id), "followingCount", by),
      ])
    } catch {
      // Rolled back above; the button returning to its old label is the feedback.
    } finally {
      setIsPending(false)
    }
  }

  return { isFollowing: data?.isFollowing ?? false, isLoading, isPending, toggle }
}
