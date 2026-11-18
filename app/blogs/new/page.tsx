import type { Metadata } from "next"

import { BlogEditor } from "@/features/blogs/components/blog-editor"
import { loadBlogForEditing } from "@/features/blogs/server/load-blog"

export const metadata: Metadata = {
  title: "Viết blog · Vedora",
}

/**
 * A new blog. Once saved it stays on this route as `?id=` (see
 * `newBlogDraftPath`), so a refresh or reload loads it here instead of
 * remounting the editor on `/blogs/[id]/edit`.
 */
export default async function NewBlogPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>
}) {
  const { id } = await searchParams
  const blogId = typeof id === "string" && id ? id : null
  return <BlogEditor initial={blogId ? await loadBlogForEditing(blogId) : null} />
}
