"use client"

import { useRef } from "react"
import { useSWRConfig } from "swr"
import useSWR from "swr"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import { uploadToStorage } from "@/features/shared/lib/storage-upload"
import { sendJson } from "@/features/shared/lib/api-client"
import {
  addWorkspaceMember,
  createWorkspace,
  fetchMyWorkspaces,
  fetchWorkspace,
  removeWorkspaceMember,
  requestWorkspaceProofUpload,
  resubmitWorkspace,
  updateWorkspaceDetails,
} from "@/features/workspaces/lib/workspaces-api"
import {
  restaurantPinListSchema,
  type LngLat,
  type RestaurantDetailsFormValues,
  type Workspace,
  type WorkspaceDetail,
  type WorkspaceFormValues,
} from "@/features/workspaces/schemas"
import {
  MY_WORKSPACES_KEY,
  restaurantsKey,
  workspaceKey,
} from "@/features/workspaces/workspaces-cache"

const UPLOAD_TIMEOUT_MS = 60_000
const NO_WORKSPACES: Workspace[] = []

export function useMyWorkspaces() {
  const { data, error, isLoading } = useAuthedSWR(MY_WORKSPACES_KEY, fetchMyWorkspaces)
  return { workspaces: data ?? NO_WORKSPACES, error, isLoading }
}

export function useWorkspace(id: string) {
  const { data, error, isLoading } = useAuthedSWR(workspaceKey(id), fetchWorkspace)
  return { workspace: data ?? null, error, isLoading }
}

function useStoreWorkspace() {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()
  return async (workspace: WorkspaceDetail) => {
    await Promise.all([
      mutate([workspaceKey(workspace.id), accessToken], workspace, { revalidate: false }),
      mutate([MY_WORKSPACES_KEY, accessToken]),
    ])
  }
}

export function useSubmitWorkspace(resubmitId: string | null) {
  const { accessToken } = useAuth()
  const store = useStoreWorkspace()
  const uploaded = useRef(new WeakMap<File, string>())

  return async ({ proofs, ...application }: WorkspaceFormValues) => {
    if (!accessToken) throw new Error("Not signed in")
    const proofIds = await Promise.all(
      proofs.map(async ({ file, kind }) => {
        const known = uploaded.current.get(file)
        if (known) return known
        const target = await requestWorkspaceProofUpload(accessToken, file, kind)
        await uploadToStorage(target.upload, file, {
          signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
        })
        uploaded.current.set(file, target.id)
        return target.id
      })
    )
    const body = { ...application, proofIds }
    const workspace = resubmitId
      ? await resubmitWorkspace(accessToken, resubmitId, body)
      : await createWorkspace(accessToken, body)
    await store(workspace)
    return workspace
  }
}

export function useUpdateWorkspaceDetails(id: string) {
  const { accessToken } = useAuth()
  const store = useStoreWorkspace()
  return async (values: RestaurantDetailsFormValues) => {
    if (!accessToken) throw new Error("Not signed in")
    await store(await updateWorkspaceDetails(accessToken, id, values))
  }
}

export function useWorkspaceMembers(id: string) {
  const { accessToken } = useAuth()
  const store = useStoreWorkspace()
  const { mutate } = useSWRConfig()
  return {
    add: async (username: string) => {
      if (!accessToken) throw new Error("Not signed in")
      await store(await addWorkspaceMember(accessToken, id, username))
    },
    remove: async (userId: string) => {
      if (!accessToken) throw new Error("Not signed in")
      await removeWorkspaceMember(accessToken, id, userId)
      await Promise.all([
        mutate([workspaceKey(id), accessToken]),
        mutate([MY_WORKSPACES_KEY, accessToken]),
      ])
    },
  }
}

export function useRestaurants(userLocation?: LngLat | null) {
  const { data, error, isLoading } = useSWR(
    restaurantsKey(userLocation),
    (url: string) => sendJson(restaurantPinListSchema, url, undefined),
    { keepPreviousData: true }
  )
  return { restaurants: data?.items ?? [], truncated: data?.truncated ?? false, error, isLoading }
}
