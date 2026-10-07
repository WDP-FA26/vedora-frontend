"use client"

import useSWR, { useSWRConfig } from "swr"

import { ADMIN_REPORTS_KEY } from "@/features/admin/admin-cache"
import { fetchAllReports, reviewReport } from "@/features/admin/lib/admin-api"
import type { AdminReport } from "@/features/admin/schemas"
import { useAuth } from "@/features/auth/hooks/use-auth"

// TanStack Table rebuilds its row models whenever `data` changes identity.
const NO_REPORTS: AdminReport[] = []

export function useAdminReports() {
  const { accessToken } = useAuth()
  const { data, error, isLoading } = useSWR(
    accessToken ? ([ADMIN_REPORTS_KEY, accessToken] as const) : null,
    fetchAllReports
  )
  return { reports: data ?? NO_REPORTS, error, isLoading }
}

/** Closes a pending report and writes the result into the list. */
export function useReviewReport() {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()

  return async (id: string, status: "RESOLVED" | "DISMISSED") => {
    if (!accessToken) throw new Error("Not signed in")
    try {
      const reviewed = await reviewReport(accessToken, id, status)
      await mutate<AdminReport[]>(
        [ADMIN_REPORTS_KEY, accessToken],
        (reports) => reports?.map((report) => (report.id === id ? reviewed : report)),
        { revalidate: false }
      )
    } catch {
      // Most likely another admin closed it first; show what the server has.
      await mutate([ADMIN_REPORTS_KEY, accessToken])
    }
  }
}
