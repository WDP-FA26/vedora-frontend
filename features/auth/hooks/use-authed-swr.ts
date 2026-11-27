"use client"

import useSWR, { type SWRConfiguration } from "swr"

import { useAuth } from "@/features/auth/hooks/use-auth"

export function useAuthedSWR<Data>(
  url: string | null,
  fetcher: (key: readonly [string, string]) => Promise<Data>,
  config?: SWRConfiguration<Data, Error>
) {
  const { accessToken } = useAuth()
  const key = url && accessToken ? ([url, accessToken] as const) : null
  return useSWR(key, fetcher, config)
}
