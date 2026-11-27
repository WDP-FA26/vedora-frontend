"use client"

import { useEffect, useState } from "react"

type Deadline = { expiresAt: string; serverTime: string; receivedAt: number }

export function usePaymentCountdown(payment?: Deadline) {
  const [tick, setTick] = useState<{ sample: string; seconds: number } | null>(null)
  const expiresAt = payment?.expiresAt
  const serverTime = payment?.serverTime
  const receivedAt = payment?.receivedAt
  const sample = `${serverTime}:${receivedAt}`
  const initial = expiresAt && serverTime
    ? Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.parse(serverTime)) / 1000))
    : null

  useEffect(() => {
    if (!expiresAt || !serverTime || receivedAt === undefined) return
    const update = () => setTick({
      sample,
      seconds: Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.parse(serverTime) - (performance.now() - receivedAt)) / 1000)),
    })
    const interval = setInterval(update, 1000)
    document.addEventListener("visibilitychange", update)
    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", update)
    }
  }, [expiresAt, serverTime, receivedAt, sample])

  return tick?.sample === sample ? tick.seconds : initial
}

export function countdownLabel(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`
}
