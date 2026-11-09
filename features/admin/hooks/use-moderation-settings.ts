"use client"

import { useSWRConfig } from "swr"

import { MODERATION_SETTINGS_KEY } from "@/features/admin/admin-cache"
import {
  fetchModerationSettings,
  resetModerationSettings,
  saveModerationSettings,
  testModeration,
} from "@/features/admin/lib/admin-api"
import type { ModerationPolicyDraft, ModerationSettings } from "@/features/admin/schemas"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"

export function useModerationSettings() {
  const { data, error, isLoading } = useAuthedSWR(MODERATION_SETTINGS_KEY, fetchModerationSettings)
  return { settings: data ?? null, error, isLoading }
}

/** Saves, resets and tries drafts of the policy, keeping the cached copy current. */
export function useModerationSettingsActions() {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()

  function requireToken() {
    if (!accessToken) throw new Error("Not signed in")
    return accessToken
  }

  async function store(saved: ModerationSettings) {
    await mutate([MODERATION_SETTINGS_KEY, accessToken], saved, { revalidate: false })
    return saved
  }

  return {
    save: async (draft: ModerationPolicyDraft, version: number) =>
      store(await saveModerationSettings(requireToken(), draft, version)),
    reset: async () => store(await resetModerationSettings(requireToken())),
    test: (text: string, draft: ModerationPolicyDraft) => testModeration(requireToken(), text, draft),
  }
}
