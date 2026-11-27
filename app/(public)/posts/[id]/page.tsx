import type { Metadata } from "next"
import { cache } from "react"
import { SWRConfig, unstable_serialize } from "swr"

import { getAccessToken } from "@/features/auth/server/session"
import { blogKey } from "@/features/blogs/blogs-cache"
import { fetchBlog } from "@/features/blogs/lib/blogs-api"
import { PostDetail } from "@/features/posts/components/post-detail"
import { fetchPost } from "@/features/posts/lib/posts-api"
import { blogJsonLd, FALLBACK_POST_TITLE, postMetadata } from "@/features/posts/lib/post-metadata"
import { postKey } from "@/features/posts/posts-cache"

const loadPost = cache((id: string, token: string | undefined) =>
  fetchPost([postKey(id), token]).catch(() => null)
)
const loadBlog = cache((id: string, token: string | undefined) =>
  fetchBlog([blogKey(id), token]).catch(() => null)
)

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const post = await loadPost(id, undefined)
  return post ? postMetadata(post) : { title: FALLBACK_POST_TITLE }
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const token = await getAccessToken()
  const post = await loadPost(id, token)
  const article = post?.blog ? await loadBlog(id, token) : null
  const jsonLd = post && blogJsonLd(post, article)

  const fallback: Record<string, unknown> = {}
  if (post) fallback[unstable_serialize([postKey(id), token])] = post
  if (article) fallback[unstable_serialize([blogKey(id), token])] = article

  return (
    <SWRConfig value={{ fallback }}>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      )}
      <PostDetail id={id} />
    </SWRConfig>
  )
}
