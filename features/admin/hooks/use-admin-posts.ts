"use client"

import useSWR, { useSWRConfig } from "swr"

import {
  ADMIN_POSTS_KEY,
  ADMIN_REPORTS_KEY,
  adminPostKey,
} from "@/features/admin/admin-cache"
import {
  deleteAdminPost,
  explainAdminPost,
  fetchAdminPost,
  fetchAllPosts,
  fetchTranscript,
  moderateAdminPost,
  restoreAdminPost,
} from "@/features/admin/lib/admin-api"
import type { AdminPost } from "@/features/admin/schemas"
import { isAdminSupportCacheKey } from "@/features/support/lib/support-api"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import { POSTS_KEY } from "@/features/posts/posts-cache"

// TanStack Table rebuilds its row models whenever `data` changes identity.
const NO_POSTS: AdminPost[] = []

export function useAdminPosts() {
  const { data, error, isLoading } = useAuthedSWR(ADMIN_POSTS_KEY, fetchAllPosts)
  return { posts: data ?? NO_POSTS, error, isLoading }
}

/** One post with its videos' caption tracks. */
export function useAdminPost(id: string | null) {
  const { data, error } = useAuthedSWR(id ? adminPostKey(id) : null, fetchAdminPost)
  return { post: data ?? null, error }
}

/** The cues of one caption track; a track's file never changes. */
export function useTranscript(url: string | null) {
  const { data, error, isLoading } = useSWR(url, fetchTranscript, {
    revalidateIfStale: false,
  })
  return { cues: data ?? null, error, isLoading }
}

/** Soft-deletes a post, refreshes admin lists/reports/appeals and public feeds. */
export function useDeleteAdminPost() {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()

  return async (id: string, reason?: string) => {
    if (!accessToken) throw new Error("Not signed in")
    await deleteAdminPost(accessToken, id, reason)
    await Promise.all([
      mutate([ADMIN_POSTS_KEY, accessToken]),
      mutate([adminPostKey(id), accessToken]),
      mutate([ADMIN_REPORTS_KEY, accessToken]),
    ])
    void mutate(isAdminSupportCacheKey)
    void mutate((key) => Array.isArray(key) && String(key[0]).startsWith(POSTS_KEY))
  }
}

/** Restores a soft-deleted post, updates admin caches and refreshes public feeds. */
export function useRestoreAdminPost() {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()

  return async (id: string, note?: string) => {
    if (!accessToken) throw new Error("Not signed in")
    const updated = await restoreAdminPost(accessToken, id, note)
    await mutate<AdminPost[]>(
      [ADMIN_POSTS_KEY, accessToken],
      (posts) => posts?.map((post) => (post.id === id ? updated : post)),
      { revalidate: false }
    )
    await mutate([adminPostKey(id), accessToken], updated, { revalidate: false })
    void mutate(isAdminSupportCacheKey)
    void mutate((key) => Array.isArray(key) && String(key[0]).startsWith(POSTS_KEY))
    return updated
  }
}

/** Runs the explainer on a flagged post again, then updates the admin list and detail. */
export function useExplainAdminPost() {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()

  return async (id: string) => {
    if (!accessToken) throw new Error("Not signed in")
    const updated = await explainAdminPost(accessToken, id)
    await mutate<AdminPost[]>(
      [ADMIN_POSTS_KEY, accessToken],
      (posts) => posts?.map((post) => (post.id === id ? updated : post)),
      { revalidate: false }
    )
    await mutate([adminPostKey(id), accessToken], updated, { revalidate: false })
  }
}

/** Settles a held or rejected post, then updates the admin list and detail and refreshes the feeds. */
export function useModerateAdminPost() {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()

  return async (id: string, decision: "APPROVE" | "REJECT", note: string) => {
    if (!accessToken) throw new Error("Not signed in")
    const updated = await moderateAdminPost(accessToken, id, decision, note)
    await mutate<AdminPost[]>(
      [ADMIN_POSTS_KEY, accessToken],
      (posts) => posts?.map((post) => (post.id === id ? updated : post)),
      { revalidate: false }
    )
    await mutate([adminPostKey(id), accessToken], updated, { revalidate: false })
    void mutate(isAdminSupportCacheKey)
    void mutate((key) => Array.isArray(key) && String(key[0]).startsWith(POSTS_KEY))
  }
}
