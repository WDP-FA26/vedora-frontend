import type { Metadata } from "next"

import { BlogEditor } from "@/features/blogs/components/blog-editor"
import { loadBlogForEditing } from "@/features/blogs/server/load-blog"

export const metadata: Metadata = {
  title: "Sửa blog · Vedora",
}

export default async function EditBlogPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <BlogEditor initial={await loadBlogForEditing(id)} />
}
