import type { Metadata } from "next"

import { PostDetail } from "@/features/posts/components/post-detail"
import { fetchPost } from "@/features/posts/lib/posts-api"
import { FALLBACK_POST_TITLE, postMetadata } from "@/features/posts/lib/post-metadata"
import { postKey } from "@/features/posts/posts-cache"

/** Read as a guest: only a published post names the page; anything else keeps the generic title. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const post = await fetchPost([postKey(id), undefined]).catch(() => null)
  return post ? postMetadata(post) : { title: FALLBACK_POST_TITLE }
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <PostDetail id={id} />
}
