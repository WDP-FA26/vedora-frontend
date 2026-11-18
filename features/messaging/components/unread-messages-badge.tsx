"use client"

import { useUnreadMessageCount } from "../hooks/use-messaging"

export function UnreadMessagesBadge() {
  const count = useUnreadMessageCount()
  if (count === 0) return null
  return (
    <span
      role="status"
      aria-label={`${count} tin nhắn chưa đọc`}
      className="absolute -top-1.5 -right-2 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.625rem] leading-4 font-bold text-primary-foreground ring-2 ring-background"
    >
      {count > 99 ? "99+" : count}
    </span>
  )
}
