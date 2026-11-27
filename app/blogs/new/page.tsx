import type { Metadata } from "next"

import { BlogEditor } from "@/features/blogs/components/blog-editor"
import { loadBlogForEditing } from "@/features/blogs/server/load-blog"

export const metadata: Metadata = {
  title: "Viết blog · Vedora",
}

export default async function NewBlogPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>
}) {
  const { id } = await searchParams
  const blogId = typeof id === "string" && id ? id : null
  return <BlogEditor initial={blogId ? await loadBlogForEditing(blogId) : null} />
}
