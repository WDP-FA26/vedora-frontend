"use client"

import { useEffect } from "react"
import { useSWRConfig } from "swr"

/**
 * The sign-in pages are only reached signed out, sign-out included. Nothing
 * signed-in is on screen any more, so the previous account's cached data
 * (drafts above all) is dropped here without the signed-in UI flashing empty.
 */
export function ClearSignedOutCache() {
  const { mutate } = useSWRConfig()
  useEffect(() => {
    void mutate(() => true, undefined, { revalidate: false })
  }, [mutate])
  return null
}
