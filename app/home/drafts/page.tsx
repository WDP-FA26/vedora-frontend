import { Suspense } from "react"
import { PostDraftsView } from "@/features/post-drafts/drafts-view"

export const metadata = { title: "Bản nháp · Vedora" }

/** The view reads its tab from the `tab` URL param, so it waits inside a Suspense boundary. */
export default function DraftsPage() {
  return (
    <Suspense fallback={null}>
      <PostDraftsView />
    </Suspense>
  )
}
