"use client"

import useSWR from "swr"

import { ADMIN_USERS_KEY } from "@/features/admin/admin-cache"
import { fetchAllUsers } from "@/features/admin/lib/admin-api"
import type { AdminUser } from "@/features/admin/schemas"
import { useAuth } from "@/features/auth/hooks/use-auth"

// TanStack Table rebuilds its row models whenever `data` changes identity.
const NO_USERS: AdminUser[] = []

export function useAdminUsers() {
  const { accessToken } = useAuth()
  const { data, error, isLoading } = useSWR(
    accessToken ? ([ADMIN_USERS_KEY, accessToken] as const) : null,
    fetchAllUsers
  )
  return { users: data ?? NO_USERS, error, isLoading }
}
