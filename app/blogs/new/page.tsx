import type { Metadata } from "next"

import { BlogEditor } from "@/features/blogs/components/blog-editor"

export const metadata: Metadata = {
  title: "Viết blog · Vedora",
}

export default function NewBlogPage() {
  return <BlogEditor initial={null} />
}
