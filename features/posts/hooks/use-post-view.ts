"use client"

import { useEffect, useRef } from "react"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { trackPostView } from "@/features/posts/lib/view-tracker"

const VISIBLE_RATIO = 0.5
const VISIBLE_MS = 1_000

export function usePostView<T extends HTMLElement>(id: string | null) {
  const ref = useRef<T>(null)
  const { accessToken } = useAuth()

  useEffect(() => {
    const element = ref.current
    if (!id || !element) return

    let timer: ReturnType<typeof setTimeout> | undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
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
