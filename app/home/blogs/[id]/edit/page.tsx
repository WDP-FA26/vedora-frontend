import type { Metadata } from "next"

import { FIRST_SAVE_PARAM } from "@/features/blogs/blogs-cache"
import { EditBlog } from "@/features/blogs/components/edit-blog"

export const metadata: Metadata = {
  title: "Sửa blog · Vedora",
}

export default async function EditBlogPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  return <EditBlog id={id} justCreated={query[FIRST_SAVE_PARAM] === "1"} />
}
