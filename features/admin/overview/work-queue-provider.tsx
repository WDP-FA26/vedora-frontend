"use client"

import { createContext, use, useCallback, useEffect, useRef, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import { API_URL } from "@/features/auth/lib/api"
import { sendJson } from "@/features/shared/lib/api-client"
import { API_MUTATION_SETTLED } from "@/features/shared/lib/api-events"
import { workQueueSchema, type WorkQueue } from "./schema"

const fetchQueue = ([url, token]: readonly [string, string]) =>
  sendJson(workQueueSchema, url, token, { cache: "no-store" })
const WorkContext = createContext<{
  data: WorkQueue | undefined
  error: Error | undefined
  isLoading: boolean
  isValidating: boolean
  refresh: () => Promise<WorkQueue | undefined>
} | null>(null)

export function AdminWorkQueueProvider({ children }: { children: ReactNode }) {
  const { data, error, isLoading, isValidating, mutate } = useAuthedSWR(
    API_URL + "/admin/dashboard/work-queue",
    fetchQueue,
    {
      revalidateOnFocus: true,
    }
  )
  const refresh = useCallback(() => mutate().catch(() => undefined), [mutate])
  const intervalSeconds = data?.refreshAfterSeconds
  useEffect(() => {
    if (!intervalSeconds || error) return
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) void refresh()
    }, intervalSeconds * 1000)
    return () => clearInterval(timer)
  }, [intervalSeconds, error, refresh])
  const pathname = usePathname()
  const previous = useRef(pathname)
  useEffect(() => {
    if (previous.current !== pathname) {
      previous.current = pathname
      void refresh()
    }
  }, [pathname, refresh])
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const changed = () => {
      clearTimeout(timer)
      timer = setTimeout(() => void refresh(), 200)
    }
    window.addEventListener(API_MUTATION_SETTLED, changed)
    return () => {
      clearTimeout(timer)
      window.removeEventListener(API_MUTATION_SETTLED, changed)
    }
  }, [refresh])
  return (
    <WorkContext value={{ data, error, isLoading, isValidating, refresh }}>{children}</WorkContext>
  )
}

export function useAdminWorkQueue() {
  const value = use(WorkContext)
  if (!value) throw new Error("AdminWorkQueueProvider is required")
  return value
}
