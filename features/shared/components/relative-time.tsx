"use client"

import { useSyncExternalStore } from "react"

import { formatPostDate, formatPostDateLong } from "@/features/shared/lib/format"
import { formatRelativeTime } from "@/features/shared/lib/relative-time"

const TICK_MS = 30 * 1000

function subscribe(onChange: () => void) {
  const timer = setInterval(onChange, TICK_MS)
  return () => clearInterval(timer)
}

// A snapshot must be stable between ticks, so round to the tick.
function getNow() {
  return Math.floor(Date.now() / TICK_MS) * TICK_MS
}

function getServerNow() {
  return null
}

/**
 * "5 phút trước" style timestamp that keeps itself current. The server cannot
 * know the reader's clock, so it renders the absolute date; the browser
 * switches to relative time right after hydration. The full date stays in the
 * tooltip.
 */
export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  const now = useSyncExternalStore(subscribe, getNow, getServerNow)
  const label = now === null ? formatPostDate(iso) : formatRelativeTime(iso, now)

  return (
    <time dateTime={iso} title={formatPostDateLong(iso)} className={className}>
      {label}
    </time>
  )
}
