import type { Metadata } from "next"

import { MyBlogsView } from "@/features/blogs/components/my-blogs-view"

export const metadata: Metadata = {
  title: "Blog của tôi · Vedora",
}

export default function MyBlogsPage() {
  return <MyBlogsView />
}
