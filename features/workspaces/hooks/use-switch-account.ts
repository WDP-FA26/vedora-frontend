"use client"

import { useTransition } from "react"

import { switchAccount } from "@/features/auth/actions"
import { toast } from "@/components/ui/toast"
import { useDisconnectPostDrafts } from "@/features/post-drafts/provider"

export function useSwitchAccount() {
  const [pending, startTransition] = useTransition()
  const disconnectDrafts = useDisconnectPostDrafts()

  function switchTo(pageId: string | null, next: string) {
    startTransition(async () => {
      disconnectDrafts?.()
      const result = await switchAccount(pageId, next)
      if (result) toast.add({ title: "Chưa chuyển được tài khoản", description: result.error })
    })
  }

  return { pending, switchTo }
}
