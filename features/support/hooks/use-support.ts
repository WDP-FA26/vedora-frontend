"use client"

import { useSWRConfig } from "swr"

import { ADMIN_POSTS_KEY, adminPostKey } from "@/features/admin/admin-cache"
import {
  adminSupportTicketKey,
  adminSupportTicketsKey,
  mySupportTicketsKey,
  supportTicketKey,
} from "@/features/support/support-cache"
import {
  claimAdminSupportTicket,
  createSupportTicket,
  fetchAdminSupportTicket,
  fetchAdminSupportTickets,
  fetchMySupportTicket,
  fetchMySupportTickets,
  isAdminSupportCacheKey,
  isMySupportCacheKey,
  replyAdminSupportTicket,
  releaseAdminSupportTicket,
  replyMySupportTicket,
  requestSupportAttachmentUpload,
  resolveAdminSupportTicket,
  withdrawMySupportTicket,
  type CreateSupportTicketPayload,
  type SupportMessagePayload,
} from "@/features/support/lib/support-api"
import { uploadToStorage } from "@/features/shared/lib/storage-upload"
import type { AdminAssigneeFilter } from "@/features/support/support-cache"
import type {
  AppealTriggerStatus,
  SupportTicketCategory,
  SupportTicketStatus,
} from "@/features/support/schemas"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import { MY_BLOGS_KEY, blogKey } from "@/features/blogs/blogs-cache"
import { POSTS_KEY, postKey } from "@/features/posts/posts-cache"

export function useMySupportTickets(
  params: {
    status?: SupportTicketStatus
    category?: SupportTicketCategory
    page?: number
    limit?: number
  } = {}
) {
  const { data, error, isLoading, mutate } = useAuthedSWR(
    mySupportTicketsKey(params),
    fetchMySupportTickets
  )
  return { page: data ?? null, error, isLoading, refresh: mutate }
}

export function useMySupportTicket(id: string | null) {
  const { data, error, isLoading, mutate } = useAuthedSWR(
    id ? supportTicketKey(id) : null,
    fetchMySupportTicket
  )
  return { ticket: data ?? null, error, isLoading, refresh: mutate }
}

export function useCreateSupportTicket() {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()

  return async (payload: CreateSupportTicketPayload) => {
    if (!accessToken) throw new Error("Not signed in")
    const created = await createSupportTicket(accessToken, payload)
    await mutate([supportTicketKey(created.id), accessToken], created, { revalidate: false })
    void mutate(isMySupportCacheKey)
    if (payload.category === "CONTENT_APPEAL") {
      void mutate([postKey(payload.postId), accessToken])
      void mutate([blogKey(payload.postId), accessToken])
      void mutate([MY_BLOGS_KEY, accessToken])
    }
    return created
  }
}

export function useReplyMySupportTicket() {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()

  return async (id: string, payload: SupportMessagePayload) => {
    if (!accessToken) throw new Error("Not signed in")
    const updated = await replyMySupportTicket(accessToken, id, payload)
    await mutate([supportTicketKey(id), accessToken], updated, { revalidate: false })
    void mutate(isMySupportCacheKey)
    return updated
  }
}

export function useWithdrawMySupportTicket() {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()

  return async (id: string) => {
    if (!accessToken) throw new Error("Not signed in")
    const updated = await withdrawMySupportTicket(accessToken, id)
    await mutate([supportTicketKey(id), accessToken], updated, { revalidate: false })
    void mutate(isMySupportCacheKey)
    if (updated.appeal?.postId) {
      void mutate([postKey(updated.appeal.postId), accessToken])
      void mutate([blogKey(updated.appeal.postId), accessToken])
      void mutate([MY_BLOGS_KEY, accessToken])
    }
    return updated
  }
}

export function useAdminSupportTickets(
  params: {
    status?: SupportTicketStatus
    category?: SupportTicketCategory
    triggerStatus?: AppealTriggerStatus
    assignee?: AdminAssigneeFilter
    q?: string
    page?: number
    limit?: number
  } = {}
) {
  const { data, error, isLoading, mutate } = useAuthedSWR(
    adminSupportTicketsKey(params),
    fetchAdminSupportTickets
  )
  return { page: data ?? null, error, isLoading, refresh: mutate }
}

export function useAdminSupportTicket(id: string | null) {
  const { data, error, isLoading, mutate } = useAuthedSWR(
    id ? adminSupportTicketKey(id) : null,
    fetchAdminSupportTicket
  )
  return { ticket: data ?? null, error, isLoading, refresh: mutate }
}

export function useReplyAdminSupportTicket() {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()

  return async (id: string, payload: SupportMessagePayload & { isInternal?: boolean }) => {
    if (!accessToken) throw new Error("Not signed in")
    const updated = await replyAdminSupportTicket(accessToken, id, payload)
    await mutate([adminSupportTicketKey(id), accessToken], updated, { revalidate: false })
    void mutate(isAdminSupportCacheKey)
    return updated
  }
}

const UPLOAD_TIMEOUT_MS = 60_000

/** Uploads images to the private support bucket and returns their attachment ids. */
export function useUploadSupportImages() {
  const { accessToken } = useAuth()

  return async (files: readonly File[]) => {
    if (!accessToken) throw new Error("Not signed in")
    return Promise.all(
      files.map(async (file) => {
        const target = await requestSupportAttachmentUpload(accessToken, file)
        await uploadToStorage(target.upload, file, {
          signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
        })
        return target.id
      })
    )
  }
}

/** Claims (or with "takeover", forcibly takes) a ticket, or releases it back to the queue. */
export function useAdminSupportClaim() {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()

  return async (id: string, action: "claim" | "takeover" | "release") => {
    if (!accessToken) throw new Error("Not signed in")
    const updated =
      action === "release"
        ? await releaseAdminSupportTicket(accessToken, id)
        : await claimAdminSupportTicket(accessToken, id, action === "takeover")
    await mutate([adminSupportTicketKey(id), accessToken], updated, { revalidate: false })
    void mutate(isAdminSupportCacheKey)
    return updated
  }
}

export function useResolveAdminSupportTicket() {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()

  return async (
    id: string,
    payload: { decision: "APPROVE" | "REJECT" | "RESOLVE" | "CLOSE"; note?: string }
  ) => {
    if (!accessToken) throw new Error("Not signed in")
    const updated = await resolveAdminSupportTicket(accessToken, id, payload)
    await mutate([adminSupportTicketKey(id), accessToken], updated, { revalidate: false })
    void mutate(isAdminSupportCacheKey)
    if (updated.appeal?.postId) {
      void mutate([ADMIN_POSTS_KEY, accessToken])
      void mutate([adminPostKey(updated.appeal.postId), accessToken])
      void mutate((key) => Array.isArray(key) && String(key[0]).startsWith(POSTS_KEY))
    }
    return updated
  }
}
