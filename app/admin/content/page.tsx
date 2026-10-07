import type { Metadata } from "next"

import { PostsTable } from "@/features/admin/components/content/posts-table"

export const metadata: Metadata = {
  title: "Bài đăng · Vedora Quản trị",
}

export default function AdminContentPage() {
  return <PostsTable />
}
