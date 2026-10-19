import type { Metadata } from "next"

import { BlogDetail } from "@/features/blogs/components/blog-detail"

export const metadata: Metadata = {
  title: "Blog · Vedora",
}

export default async function BlogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <BlogDetail id={id} />
}
