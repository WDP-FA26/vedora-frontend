"use client"

import useSWR, { useSWRConfig } from "swr"

import { useAuth } from "@/features/auth/hooks/use-auth"
import {
  dismissSuggestion,
  fetchSuggestions,
  followProfile,
} from "@/features/profiles/lib/profiles-api"
import {
  MY_PROFILE_KEY,
  profileKey,
  relationshipKey,
  suggestionsKey,
} from "@/features/profiles/profiles-cache"
import type { FollowSuggestionList } from "@/features/profiles/schemas"

export function useSuggestions(limit: number) {
  const { accessToken, user } = useAuth()
  const { mutate } = useSWRConfig()
  const key = accessToken ? ([suggestionsKey(limit), accessToken] as const) : null
  const { data, isLoading } = useSWR(key, fetchSuggestions)

  function remove(id: string, request: (token: string) => Promise<void>) {
    if (!key || !accessToken) return Promise.resolve()
    return mutate(
      key,
      async (list: FollowSuggestionList | undefined) => {
        await request(accessToken)
        return list && { items: list.items.filter((item) => item.id !== id) }
      },
      {
        optimisticData: (list?: FollowSuggestionList) => ({
          items: (list?.items ?? []).filter((item) => item.id !== id),
        }),
        rollbackOnError: true,
        revalidate: true,
      }
    )
  }

  async function follow(id: string) {
    try {
      await remove(id, (token) => followProfile(token, id))
    } catch {
      return
    }
    await Promise.all([
      mutate([relationshipKey(id), accessToken]),
      mutate([profileKey(id), accessToken]),
      mutate([MY_PROFILE_KEY, accessToken]),
      user && mutate([profileKey(user.id), accessToken]),
    ])
  }

  async function dismiss(id: string) {
    try {
      await remove(id, (token) => dismissSuggestion(token, id))
    } catch {
    }
  }

  return { suggestions: data?.items ?? [], isLoading, follow, dismiss }
}
