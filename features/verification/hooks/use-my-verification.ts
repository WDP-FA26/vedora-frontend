"use client"

import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"

import { fetchMyVerification } from "@/features/verification/lib/verification-api"
import { MY_VERIFICATION_KEY } from "@/features/verification/verification-cache"

export function useMyVerification() {
  const { data, error, isLoading, mutate } = useAuthedSWR(MY_VERIFICATION_KEY, fetchMyVerification)
  return { verification: data ?? null, error, isLoading, mutate }
}
