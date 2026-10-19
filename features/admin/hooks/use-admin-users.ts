"use client"

import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"

import { ADMIN_USERS_KEY } from "@/features/admin/admin-cache"
import { fetchAllUsers } from "@/features/admin/lib/admin-api"
import type { AdminUser } from "@/features/admin/schemas"

// TanStack Table rebuilds its row models whenever `data` changes identity.
const NO_USERS: AdminUser[] = []

export function useAdminUsers() {
  const { data, error, isLoading } = useAuthedSWR(ADMIN_USERS_KEY, fetchAllUsers)
  return { users: data ?? NO_USERS, error, isLoading }
}
