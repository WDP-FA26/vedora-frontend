"use client"

import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"

import { adminUsersKey } from "@/features/admin/admin-cache"
import { fetchAllUsers } from "@/features/admin/lib/admin-api"
import type { AdminUser } from "@/features/admin/schemas"

const NO_USERS: AdminUser[] = []

export function useAdminUsers(filters: { q?: string; status?: AdminUser["status"] } = {}) {
  const { data, error, isLoading, isValidating } = useAuthedSWR(
    adminUsersKey(filters),
    fetchAllUsers,
    { keepPreviousData: true }
  )
  return {
    users: data ?? NO_USERS,
    error,
    isLoading: isLoading && data === undefined,
    isRefreshing: isValidating && data !== undefined,
  }
}
