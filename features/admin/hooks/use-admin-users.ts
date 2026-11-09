"use client"

import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"

import { adminUsersKey } from "@/features/admin/admin-cache"
import { fetchAllUsers } from "@/features/admin/lib/admin-api"
import type { AdminUser } from "@/features/admin/schemas"

// TanStack Table rebuilds its row models whenever `data` changes identity.
const NO_USERS: AdminUser[] = []

/** Every account matching `q` and `status`, filtered by the API. */
export function useAdminUsers(filters: { q?: string; status?: AdminUser["status"] } = {}) {
  // The previous rows stay on screen while a new search loads, so the table
  // (and the search box the admin is typing in) is not swapped for a skeleton.
  const { data, error, isLoading, isValidating } = useAuthedSWR(
    adminUsersKey(filters),
    fetchAllUsers,
    { keepPreviousData: true }
  )
  return {
    users: data ?? NO_USERS,
    error,
    /** True only before the first rows arrive. */
    isLoading: isLoading && data === undefined,
    isRefreshing: isValidating && data !== undefined,
  }
}
