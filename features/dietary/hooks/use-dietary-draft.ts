"use client"

import useSWR from "swr"

import { copyDraft, EMPTY_DRAFT, type DietaryDraft } from "@/features/dietary/dietary-draft"

/** Shares applied UI choices across pages, in memory and scoped to the account. */
export function useDietaryDraft(userId: string | undefined) {
  const { data, mutate } = useSWR<DietaryDraft>(
    userId ? ["dietary-ui-draft", userId] : null,
    null,
    {
      // Clear the app-wide HTTP fetcher for this in-memory state key.
      fetcher: undefined,
      fallbackData: EMPTY_DRAFT,
      revalidateIfStale: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  )

  function applyDraft(draft: DietaryDraft) {
    if (!userId) return
    void mutate(copyDraft(draft), { revalidate: false })
  }

  return { appliedDraft: data ?? EMPTY_DRAFT, applyDraft }
}
