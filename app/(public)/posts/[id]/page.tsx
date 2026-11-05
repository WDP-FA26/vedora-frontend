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

// A failed load gives null: the page then loads it in the browser and shows the error there.
const loadPost = cache((id: string, token: string | undefined) =>
  fetchPost([postKey(id), token]).catch(() => null)
)
const loadBlog = cache((id: string, token: string | undefined) =>
  fetchBlog([blogKey(id), token]).catch(() => null)
)

/** Read as a guest: only a published post names the page; anything else keeps the generic title. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const post = await loadPost(id, undefined)
  return post ? postMetadata(post) : { title: FALLBACK_POST_TITLE }
}

/**
 * The post, and a blog's full article, load on the server as the visitor sees
 * them, so the first HTML already holds the text that crawlers read.
 */
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

  // Same keys as `usePost` and `BlogArticle`, so SWR starts from this data.
  const fallback: Record<string, unknown> = {}
  if (post) fallback[unstable_serialize([postKey(id), token])] = post
  if (article) fallback[unstable_serialize([blogKey(id), token])] = article

  return (
    <SWRConfig value={{ fallback }}>
      {jsonLd && (
        <script
          type="application/ld+json"
          // `<` is escaped so text in the blog cannot close the script tag.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      )}
      <PostDetail id={id} />
    </SWRConfig>
  )
}
