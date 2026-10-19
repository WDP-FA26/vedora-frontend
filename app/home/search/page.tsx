import type { Metadata } from "next"

import { SearchView } from "@/features/posts/components/search-view"

export const metadata: Metadata = {
  title: "Tìm kiếm · Vedora",
}

export default async function SearchPage({ searchParams }: PageProps<"/home/search">) {
  const { q } = await searchParams
  const query = (typeof q === "string" ? q : "").trim()
  return <SearchView q={query} />
}
