"use client"

import { CATEGORY_LABELS } from "@/features/admin/components/content/moderation-panel"
import { useModerationSettings } from "@/features/admin/hooks/use-moderation-settings"

/** The admin name of a policy category, from the current policy. */
export function useCategoryLabel() {
  const { settings } = useModerationSettings()
  return (key: string) => {
    if (key === "allow") return CATEGORY_LABELS.allow
    return settings?.choices.find((choice) => choice.key === key)?.label ?? CATEGORY_LABELS[key] ?? key
  }
}
