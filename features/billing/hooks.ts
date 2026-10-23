"use client"

import { API_URL } from "@/features/auth/lib/api"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import { sendJson } from "@/features/shared/lib/api-client"
import { catalogSchema, overviewSchema, paymentSchema } from "./schema"

const options = { keepPreviousData: false, shouldRetryOnError: false, revalidateOnFocus: true }
export function useCatalog() {
  return useAuthedSWR(`${API_URL}/billing/plans`, ([url, token]) => sendJson(catalogSchema, url, token, { cache: "no-store" }), options)
}
export function useBilling() {
  return useAuthedSWR(`${API_URL}/billing/me`, ([url, token]) => sendJson(overviewSchema, url, token, { cache: "no-store" }), { ...options, refreshInterval: 60000 })
}
export function usePayment(id: string) {
  return useAuthedSWR(`${API_URL}/payment-intents/${id}`, ([url, token]) => sendJson(paymentSchema, url, token, { cache: "no-store" }), {
    ...options, refreshInterval: data => data?.status === "PENDING" ? 4000 : 0,
  })
}
