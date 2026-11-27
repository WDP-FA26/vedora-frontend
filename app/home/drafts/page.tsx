import { Suspense } from "react"
import { PostDraftsView } from "@/features/post-drafts/drafts-view"

export const metadata = { title: "Bản nháp · Vedora" }

export default function DraftsPage() {
  return (
    <Suspense fallback={null}>
      <PostDraftsView />
    </Suspense>
  )
}
