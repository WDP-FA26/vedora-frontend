"use client"

import useSWR from "swr"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { fetchMyVerification } from "@/features/verification/lib/verification-api"
import { MY_VERIFICATION_KEY } from "@/features/verification/verification-cache"

export function useMyVerification() {
  const { accessToken } = useAuth()
  const { data, error, isLoading, mutate } = useSWR(
    accessToken ? ([MY_VERIFICATION_KEY, accessToken] as const) : null,
    fetchMyVerification
  )
  return { verification: data ?? null, error, isLoading, mutate }
}
