import type { Metadata } from "next"

import { PostDetail } from "@/features/posts/components/post-detail"

export const metadata: Metadata = {
  title: "Bài viết · Vedora",
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <PostDetail id={id} />
}
