import type { MetadataRoute } from "next"

import { BLOGS_KEY } from "@/features/blogs/blogs-cache"
import { fetchPostPage } from "@/features/posts/lib/posts-api"
import { postPath } from "@/features/posts/posts-cache"
import { absoluteUrl } from "@/lib/site"

/** Rebuilt at most hourly, so new blogs reach search engines without a deploy. */
export const revalidate = 3600

/** The API serves at most 50 per page; this caps the sitemap at 1,000 blogs. */
const PAGE_SIZE = 50
const MAX_PAGES = 20

/** Published blogs, newest first, read as a guest. Stops at the first failed page. */
async function publishedBlogs() {
  const blogs: MetadataRoute.Sitemap = []
  let cursor: string | null = null
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) })
    if (cursor) params.set("cursor", cursor)
    const result = await fetchPostPage([`${BLOGS_KEY}?${params}`, undefined]).catch(() => null)
    if (!result) break
    for (const post of result.items) {
      blogs.push({
        url: absoluteUrl(postPath(post.id)),
        lastModified: post.publishedAt ?? post.createdAt,
        changeFrequency: "weekly",
      })
    }
    cursor = result.nextCursor
    if (!cursor) break
  }
  return blogs
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [{ url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 }, ...(await publishedBlogs())]
}
