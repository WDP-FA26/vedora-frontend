import type { Metadata } from "next"
import { Suspense } from "react"
import { MessagesView } from "@/features/messaging/components/messages-view"

export const metadata: Metadata = { title: "Tin nhắn" }

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-5">
          Đang tải tin nhắn…
        </p>
      }
    >
      <MessagesView />
    </Suspense>
  )
}
