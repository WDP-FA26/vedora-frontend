"use client"

import useSWR, { unstable_serialize, useSWRConfig, type Key } from "swr"

export function useLocalSWRState<T>(key: Key, fallback: T): T {
  const { cache } = useSWRConfig()
  const { data } = useSWR<T>(
    key,
    () => readCached<T>(cache.get(unstable_serialize(key))?.data, fallback),
    {
      fallbackData: fallback,
      revalidateOnMount: false,
      revalidateIfStale: false,
      revalidateOnReconnect: false,
    }
  )
  return data ?? fallback
}

function readCached<T>(cached: T | undefined, fallback: T): T {
  if (cached === undefined) return fallback
  return cached
}
