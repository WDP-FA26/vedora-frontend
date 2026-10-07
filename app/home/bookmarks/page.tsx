import type { Metadata } from "next"

import { BookmarksView } from "@/features/posts/components/bookmarks-view"

export const metadata: Metadata = {
  title: "Đã lưu · Vedora",
}

export default function BookmarksPage() {
  return <BookmarksView />
}
