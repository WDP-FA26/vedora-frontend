"use client"

import { API_URL } from "@/features/auth/lib/api"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import { sendJson } from "@/features/shared/lib/api-client"
import { dashboardSchema, type DashboardRange } from "./dashboard-schema"

function fetchDashboard([url, token]: readonly [string, string]) {
  return sendJson(dashboardSchema, url, token, { cache: "no-store" })
}

export function useDashboard(range: DashboardRange) {
  const params = new URLSearchParams(range)
  return useAuthedSWR(`${API_URL}/admin/dashboard?${params}`, fetchDashboard, {
    keepPreviousData: false,
    shouldRetryOnError: false,
  })
}
