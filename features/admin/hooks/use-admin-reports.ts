"use client"

import { useSWRConfig } from "swr"

import { ADMIN_REPORTS_KEY } from "@/features/admin/admin-cache"
import { fetchAllReports, reviewReport } from "@/features/admin/lib/admin-api"
import type { AdminReport } from "@/features/admin/schemas"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"

const NO_REPORTS: AdminReport[] = []

export function useAdminReports() {
  const { data, error, isLoading } = useAuthedSWR(ADMIN_REPORTS_KEY, fetchAllReports)
  return { reports: data ?? NO_REPORTS, error, isLoading }
}

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
      await mutate([ADMIN_REPORTS_KEY, accessToken])
    }
  }
}
