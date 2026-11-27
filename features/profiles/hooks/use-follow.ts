"use client"

import { useState } from "react"
import { useSWRConfig } from "swr"
import { invalidateMessaging } from "@/features/messaging/lib/invalidate-messaging"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
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

export function useFollow(id: string, initialIsFollowing?: boolean) {
  const { accessToken, user } = useAuth()
  const { mutate } = useSWRConfig()
  const [isPending, setIsPending] = useState(false)
  const hasInitial = initialIsFollowing !== undefined
  const { data, isLoading } = useAuthedSWR(relationshipKey(id), fetchRelationship, {
    fallbackData: hasInitial ? { isFollowing: initialIsFollowing } : undefined,
    revalidateOnMount: !hasInitial,
  })

  function shift(key: string, field: "followerCount" | "followingCount", by: number) {
    return mutate(
      [key, accessToken],
      (profile: ApiProfile | undefined) =>
        profile && { ...profile, [field]: Math.max(0, profile[field] + by) },
      { revalidate: true }
    )
  }

  async function toggle() {
    if (!accessToken || isPending) return
    const current = data?.isFollowing ?? initialIsFollowing
    if (current === undefined) return
    const next: Relationship = { isFollowing: !current }
    const by = next.isFollowing ? 1 : -1

    setIsPending(true)
    try {
      await mutate(
        [relationshipKey(id), accessToken],
        async () => {
          await (next.isFollowing ? followProfile : unfollowProfile)(accessToken, id)
          return next
        },
        { optimisticData: next, rollbackOnError: true, revalidate: false }
      )
      await Promise.all([
        invalidateMessaging(mutate, accessToken),
        shift(profileKey(id), "followerCount", by),
        shift(MY_PROFILE_KEY, "followingCount", by),
        user && shift(profileKey(user.id), "followingCount", by),
      ])
    } catch {
    } finally {
      setIsPending(false)
    }
  }

  return {
    isFollowing: data?.isFollowing ?? initialIsFollowing ?? false,
    isLoading: !hasInitial && isLoading,
    isPending,
    toggle,
  }
}
