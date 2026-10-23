"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSWRConfig } from "swr"
import { EventStreamContentType, fetchEventSource } from "@microsoft/fetch-event-source"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { API_URL } from "@/features/auth/lib/api"

class FatalStreamError extends Error {}

/** SSE is an invalidation hint. Only GET may establish the payment state. */
export function usePaymentStream(id: string, enabled: boolean) {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()
  const router = useRouter()
  const identity = `${id}:${accessToken}`
  const [connection, setConnection] = useState<{ identity: string; live: boolean } | null>(null)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (!enabled || !accessToken) return
    const controller = new AbortController()
    const paymentKey = [`${API_URL}/payment-intents/${id}`, accessToken]
    const billingKey = [`${API_URL}/billing/me`, accessToken]
    let lastFrame = Date.now(), live = false
    const reconcile = () => {
      if (!controller.signal.aborted) void Promise.all([mutate(paymentKey), mutate(billingKey)]).catch(() => undefined)
    }
    const health = (next: boolean) => {
      if (controller.signal.aborted) return
      if (next && !live) reconcile()
      live = next
      setConnection({ identity, live: next })
    }
    const fallback = setInterval(() => {
      if (!live && !controller.signal.aborted) void mutate(paymentKey).catch(() => undefined)
    }, 4000)
    // A half-open connection may never call onerror. Fall back and reconnect.
    const watchdog = setInterval(() => {
      if (Date.now() - lastFrame <= 35_000 || controller.signal.aborted) return
      health(false)
      controller.abort()
      setRetry(value => value + 1)
    }, 5000)

    void fetchEventSource(`${API_URL}/payment-intents/${id}/events`, {
      signal: controller.signal,
      openWhenHidden: true,
      headers: { Authorization: `Bearer ${accessToken}` },
      async onopen(response) {
        lastFrame = Date.now()
        if (response.ok && response.headers.get("content-type")?.startsWith(EventStreamContentType)) {
          health(false)
          reconcile() // Covers payment committed before subscription was ready.
          return
        }
        if (response.status === 401) router.refresh()
        if ([401, 403, 404].includes(response.status)) throw new FatalStreamError("Payment stream access denied")
        throw new Error("Payment stream unavailable")
      },
      onmessage(event) {
        if (controller.signal.aborted) return
        lastFrame = Date.now()
        if (event.event === "session.expired") {
          health(false)
          controller.abort()
          router.refresh()
          return
        }
        if (event.event === "stream.ready") { health(true); return }
        if (event.event === "stream.unavailable") { health(false); return }
        try {
          const data: unknown = JSON.parse(event.data)
          if (!data || typeof data !== "object") return
          if (event.event === "ping" && "connected" in data && typeof data.connected === "boolean") health(data.connected)
          if (event.event === "payment.changed" && "intentId" in data && data.intentId === id) reconcile()
        } catch { /* Ignore invalid frames; fallback GET remains authoritative. */ }
      },
      onclose() { health(false); throw new Error("Payment stream closed") },
      onerror(error: unknown) {
        health(false)
        lastFrame = Date.now()
        if (error instanceof FatalStreamError) throw error
        return 2000
      },
    }).catch(() => health(false)).finally(() => { clearInterval(watchdog); clearInterval(fallback) })

    return () => { controller.abort(); clearInterval(watchdog); clearInterval(fallback) }
  }, [accessToken, enabled, id, identity, mutate, router, retry])

  return Boolean(enabled && connection?.identity === identity && connection.live)
}
