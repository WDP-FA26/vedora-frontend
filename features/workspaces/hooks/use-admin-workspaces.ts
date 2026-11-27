"use client"

import { useSWRConfig } from "swr"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import {
  fetchAdminWorkspace,
  fetchAllAdminWorkspaces,
  fetchTaxCodeLookup,
  reviewWorkspace,
  type WorkspaceReviewInput,
} from "@/features/workspaces/lib/workspaces-api"
import type { AdminWorkspace } from "@/features/workspaces/schemas"
import {
  ADMIN_WORKSPACES_KEY,
  adminTaxCodeKey,
  adminWorkspaceKey,
} from "@/features/workspaces/workspaces-cache"

// TanStack Table rebuilds its row models whenever `data` changes identity.
const NO_WORKSPACES: AdminWorkspace[] = []

export function useAdminWorkspaces() {
  const { data, error, isLoading } = useAuthedSWR(ADMIN_WORKSPACES_KEY, fetchAllAdminWorkspaces)
  return { workspaces: data ?? NO_WORKSPACES, error, isLoading }
}

/** One application with its proof images. The image URLs are signed and expire. */
export function useAdminWorkspace(id: string | null) {
  const { data, error, isLoading } = useAuthedSWR(
    id ? adminWorkspaceKey(id) : null,
    fetchAdminWorkspace,
    { dedupingInterval: 0 }
  )
  return { workspace: data ?? null, error, isLoading }
}

/**
 * The tax department's record of an application's company tax code. The
 * source allows only a few lookups a minute, so it is fetched once per sheet
 * and only refreshed on request.
 */
export function useTaxCodeLookup(id: string | null) {
  const { data, error, isLoading, isValidating, mutate } = useAuthedSWR(
    id ? adminTaxCodeKey(id) : null,
    fetchTaxCodeLookup,
    { revalidateOnFocus: false, revalidateIfStale: false, shouldRetryOnError: false }
  )
  return {
    lookup: data ?? null,
    error,
    loading: isLoading || isValidating,
    retry: () => void mutate(),
  }
}

/** Approves or rejects an application and writes the result into the list. */
export function useReviewWorkspace() {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()

  return async (id: string, input: WorkspaceReviewInput) => {
    if (!accessToken) throw new Error("Not signed in")
    const reviewed = await reviewWorkspace(accessToken, id, input)
    await Promise.all([
      mutate<AdminWorkspace[]>(
        [ADMIN_WORKSPACES_KEY, accessToken],
        (workspaces) =>
          workspaces?.map((workspace) => (workspace.id === id ? reviewed : workspace)),
        { revalidate: false }
      ),
      mutate([adminWorkspaceKey(id), accessToken]),
    ])
  }
}
