"use client"

import useSWR, { useSWRConfig } from "swr"
import useSWRInfinite from "swr/infinite"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { BLOGS_KEY, blogKey, myBlogsKey } from "@/features/blogs/blogs-cache"
import { fetchBlog, fetchBlogPage } from "@/features/blogs/lib/blogs-api"
import type { ApiBlog, BlogStatus } from "@/features/blogs/schemas"
import { POSTS_KEY } from "@/features/posts/posts-cache"

/** First page of `GET /blogs` for the Explore "Blog" tab: published only, newest first. */
export const BLOG_FEED_KEY = `${BLOGS_KEY}?limit=20`

/** One blog with its full Markdown. Works signed out for published blogs. */
export function useBlog(id: string) {
  const { accessToken } = useAuth()
  const { data, error, isLoading, mutate } = useSWR(
    [blogKey(id), accessToken] as const,
    fetchBlog,
    // A 404 (deleted, someone else's draft) will not fix itself.
    { shouldRetryOnError: false }
  )
  return { blog: data ?? null, error, isLoading, retry: () => mutate() }
}

/** Published blogs only; the API never lists drafts here. */
export function useBlogFeed() {
  const { accessToken } = useAuth()
  const { data, error, isLoading, mutate } = useSWR(
    accessToken ? ([BLOG_FEED_KEY, accessToken] as const) : null,
    fetchBlogPage
  )
  return { posts: data?.items ?? [], error, isLoading, retry: () => mutate() }
}

/**
 * The signed-in user's blogs, a page at a time. Changing `status` starts a new
 * list from the first page: a cursor belongs to the filter it came from.
 */
export function useMyBlogs(status: BlogStatus | null) {
  const { accessToken } = useAuth()
  const { data, error, isLoading, isValidating, size, setSize, mutate } = useSWRInfinite(
    (_index: number, previous: { nextCursor: string | null } | null) => {
      if (!accessToken) return null
      // The last page has no cursor.
      if (previous && !previous.nextCursor) return null
      return [myBlogsKey(status, previous?.nextCursor), accessToken] as const
    },
    fetchBlogPage
  )

  const pages = data ?? []
  return {
    blogs: pages.flatMap((page) => page.items),
    hasMore: Boolean(pages.at(-1)?.nextCursor),
    loadMore: () => setSize(size + 1),
    error,
    isLoading,
    isLoadingMore: isValidating && size > pages.length,
    refresh: () => mutate(),
  }
}

/**
 * After a blog is saved, published, unpublished or deleted: store the new
 * article (or drop it) and refetch every list it might appear in, so a draft
 * never lingers in a feed and a published blog shows up.
 */
export function useBlogCacheSync() {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()

  // Lists only: a single post's key would just 404 once its blog is deleted.
  const isListUrl = (url: string) =>
    url === POSTS_KEY ||
    url.startsWith(`${POSTS_KEY}?`) ||
    url.startsWith(`${POSTS_KEY}/bookmarks`) ||
    url.startsWith(`${BLOGS_KEY}/mine`) ||
    url.startsWith(`${BLOGS_KEY}?`)

  function refetchLists() {
    return mutate((key) => Array.isArray(key) && typeof key[0] === "string" && isListUrl(key[0]))
  }

  return {
    saved: async (blog: ApiBlog) => {
      await mutate([blogKey(blog.id), accessToken], blog, { revalidate: false })
      await refetchLists()
    },
    deleted: async (id: string) => {
      await mutate([blogKey(id), accessToken], undefined, { revalidate: false })
      await refetchLists()
    },
  }
}
