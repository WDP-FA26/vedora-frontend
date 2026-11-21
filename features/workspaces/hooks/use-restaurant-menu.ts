"use client"

import useSWR, { useSWRConfig } from "swr"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import { uploadToStorage } from "@/features/shared/lib/storage-upload"
import {
  createMenuItem,
  deleteMenuItem,
  fetchPublicRestaurantMenu,
  fetchWorkspaceMenu,
  requestMenuImageUpload,
  updateMenuItem,
  type RestaurantMenuItemInput,
} from "@/features/workspaces/lib/workspaces-api"
import type { RestaurantMenuItem } from "@/features/workspaces/schemas"
import {
  publicRestaurantMenuKey,
  workspaceMenuKey,
} from "@/features/workspaces/workspaces-cache"

const UPLOAD_TIMEOUT_MS = 60_000
const NO_MENU_ITEMS: RestaurantMenuItem[] = []

export function useWorkspaceMenu(workspaceId: string | null, pageUserId: string | null = null) {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()
  const key = workspaceId ? workspaceMenuKey(workspaceId) : null
  const { data, error, isLoading } = useAuthedSWR(key, fetchWorkspaceMenu)

  async function refresh() {
    if (!workspaceId || !accessToken) return
    await Promise.all([
      mutate([workspaceMenuKey(workspaceId), accessToken]),
      pageUserId ? mutate(publicRestaurantMenuKey(pageUserId)) : Promise.resolve(),
    ])
  }

  return {
    items: data?.items ?? NO_MENU_ITEMS,
    error,
    isLoading,
    uploadImage: async (file: File) => {
      if (!accessToken || !workspaceId) throw new Error("Not signed in")
      const target = await requestMenuImageUpload(accessToken, workspaceId, file)
      await uploadToStorage(target.upload, file, {
        signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
      })
      return target.url
    },
    create: async (input: RestaurantMenuItemInput) => {
      if (!accessToken || !workspaceId) throw new Error("Not signed in")
      const created = await createMenuItem(accessToken, workspaceId, input)
      await refresh()
      return created
    },
    update: async (itemId: string, input: Partial<RestaurantMenuItemInput>) => {
      if (!accessToken || !workspaceId) throw new Error("Not signed in")
      const updated = await updateMenuItem(accessToken, workspaceId, itemId, input)
      await refresh()
      return updated
    },
    remove: async (itemId: string) => {
      if (!accessToken || !workspaceId) throw new Error("Not signed in")
      await deleteMenuItem(accessToken, workspaceId, itemId)
      await refresh()
    },
  }
}

export function usePublicRestaurantMenu(pageUserId: string) {
  const { data, error, isLoading } = useSWR(
    publicRestaurantMenuKey(pageUserId),
    fetchPublicRestaurantMenu
  )
  return {
    items: data?.items ?? NO_MENU_ITEMS,
    error,
    isLoading,
  }
}
