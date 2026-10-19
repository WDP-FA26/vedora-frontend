import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { apiFetch } from "@/features/auth/lib/api"
import { getAccessToken } from "@/features/auth/server/session"
import { BlogEditor } from "@/features/blogs/components/blog-editor"
import { apiBlogSchema } from "@/features/blogs/schemas"

export const metadata: Metadata = {
  title: "Sửa blog · Vedora",
}

export default async function EditBlogPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const response = await apiFetch(`/blogs/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${await getAccessToken()}` },
  })
  // Someone else's draft answers 404 as well; a malformed id answers 400.
  if (response.status === 404 || response.status === 400) notFound()
  if (!response.ok) throw new Error(`GET /blogs/${id} failed (${response.status})`)
  const blog = apiBlogSchema.parse(await response.json())
  return <BlogEditor initial={blog} />
}
