"use client"

import { useEffect, useRef } from "react"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { trackPostView } from "@/features/posts/lib/view-tracker"

/** The MRC viewable-impression bar: half on screen for one continuous second. */
const VISIBLE_RATIO = 0.5
const VISIBLE_MS = 1_000

/**
 * Counts a view of post `id` once the element the returned ref is on has been
 * visible long enough. Pass `null` for posts that aren't counted.
 */
export function usePostView<T extends HTMLElement>(id: string | null) {
  const ref = useRef<T>(null)
  const { accessToken } = useAuth()

  useEffect(() => {
    const element = ref.current
    if (!id || !element) return

    let timer: ReturnType<typeof setTimeout> | undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        // A post taller than the screen can't be half visible; filling half
        // the screen counts instead.
        const visible =
          entry.intersectionRatio >= VISIBLE_RATIO ||
          entry.intersectionRect.height >= (entry.rootBounds?.height ?? Infinity) / 2
        if (!visible) {
          clearTimeout(timer)
          timer = undefined
        } else {
          timer ??= setTimeout(() => {
            trackPostView(id, accessToken)
            observer.disconnect()
          }, VISIBLE_MS)
        }
      },
      { threshold: [0, 0.25, VISIBLE_RATIO, 0.75, 1] }
    )
    observer.observe(element)
    return () => {
      clearTimeout(timer)
      observer.disconnect()
    }
  }, [id, accessToken])

  return ref
}
