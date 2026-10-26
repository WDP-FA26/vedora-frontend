import type { Metadata } from "next"

import { BookmarksView } from "@/features/posts/components/bookmarks-view"
import { isBookmarkTab } from "@/features/posts/posts-cache"

export const metadata: Metadata = {
  title: "Đã lưu · Vedora",
}

export default async function BookmarksPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>
}) {
  const { tab } = await searchParams
  return <BookmarksView initialTab={isBookmarkTab(tab) ? tab : "posts"} />
}
