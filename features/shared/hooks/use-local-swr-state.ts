"use client"

import useSWR, { unstable_serialize, useSWRConfig, type Key } from "swr"

/**
 * Client-only state kept in the SWR cache under `key` and written with
 * `mutate(key, value)`. It never touches the network.
 *
 * Passing `null` as the fetcher does not do this: SWR falls back to the global
 * fetcher, which then requests the stringified tuple key as a URL (with the
 * access token in it). Revalidation here returns the cached value, so a
 * filter-based `mutate()` can't reset what was written.
 */
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
