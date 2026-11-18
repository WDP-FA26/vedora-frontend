import type { Metadata } from "next"

import { SearchView } from "@/features/posts/components/search-view"
import { isSearchTab } from "@/features/posts/posts-cache"

export const metadata: Metadata = {
  title: "Tìm kiếm · Vedora",
}

export default async function SearchPage({ searchParams }: PageProps<"/home/search">) {
  const { q, tab } = await searchParams
  const query = (typeof q === "string" ? q : "").trim()
  const initialTab = isSearchTab(tab) ? tab : "all"
  return <SearchView q={query} initialTab={initialTab} />
}
