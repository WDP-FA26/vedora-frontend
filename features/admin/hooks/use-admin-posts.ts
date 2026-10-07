"use client"

import useSWR, { useSWRConfig } from "swr"

import {
  ADMIN_POSTS_KEY,
  ADMIN_REPORTS_KEY,
  adminPostKey,
} from "@/features/admin/admin-cache"
import {
  deleteAdminPost,
  fetchAdminPost,
  fetchAllPosts,
  fetchTranscript,
} from "@/features/admin/lib/admin-api"
import type { AdminPost, AdminReport } from "@/features/admin/schemas"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { POSTS_KEY } from "@/features/posts/posts-cache"

// TanStack Table rebuilds its row models whenever `data` changes identity.
const NO_POSTS: AdminPost[] = []

export function useAdminPosts() {
  const { accessToken } = useAuth()
  const { data, error, isLoading } = useSWR(
    accessToken ? ([ADMIN_POSTS_KEY, accessToken] as const) : null,
    fetchAllPosts
  )
  return { posts: data ?? NO_POSTS, error, isLoading }
}

/** One post with its videos' caption tracks, which the API reads from Mux. */
export function useAdminPost(id: string | null) {
  const { accessToken } = useAuth()
  const { data, error } = useSWR(
    id && accessToken ? ([adminPostKey(id), accessToken] as const) : null,
    fetchAdminPost
  )
  return { post: data ?? null, error }
}

/** The cues of one caption track; a track's file never changes. */
export function useTranscript(url: string | null) {
  const { data, error, isLoading } = useSWR(url, fetchTranscript, {
    revalidateIfStale: false,
  })
  return { cues: data ?? null, error, isLoading }
}

/** Deletes a post, drops it and its reports from the admin lists and refreshes the feeds. */
export function useDeleteAdminPost() {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()

  return async (id: string) => {
    if (!accessToken) throw new Error("Not signed in")
    await deleteAdminPost(accessToken, id)
    await mutate<AdminPost[]>(
      [ADMIN_POSTS_KEY, accessToken],
      (posts) => posts?.filter((post) => post.id !== id),
      { revalidate: false }
    )
    await mutate<AdminReport[]>(
      [ADMIN_REPORTS_KEY, accessToken],
      (reports) => reports?.filter((report) => report.postId !== id),
      { revalidate: false }
    )
    void mutate((key) => Array.isArray(key) && String(key[0]).startsWith(POSTS_KEY))
  }
}
