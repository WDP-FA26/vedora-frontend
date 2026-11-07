"use client"

import { useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import useSWR, { useSWRConfig } from "swr"
import useSWRInfinite from "swr/infinite"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import { ApiError } from "@/features/shared/lib/api-client"
import {
  contactKey,
  conversationKey,
  inboxPageKey,
  INBOX_REVISION_KEY,
  MESSAGING_CONNECTION_KEY,
  messagePageKey,
} from "../messaging-cache"
import {
  fetchConversations,
  fetchConversation,
  fetchMessagingContact,
  fetchMessages,
  markConversationRead,
  sendDirectMessage,
} from "../lib/messaging-api"
import { invalidateMessaging } from "../lib/invalidate-messaging"
import type { ConversationPage, Inbox, MessagePage } from "../schemas"

export function useMessagingConnection() {
  const { accessToken } = useAuth()
  const { data } = useSWR<boolean>(
    accessToken ? [MESSAGING_CONNECTION_KEY, accessToken] : null,
    null,
    { fallbackData: false },
  )
  return data ?? false
}

export function useConversations(box: Inbox) {
  const { accessToken } = useAuth()
  const connected = useMessagingConnection()
  const router = useRouter()
  const { data: revision = 0 } = useSWR<number>(
    accessToken ? [INBOX_REVISION_KEY, accessToken] : null,
    null,
    { fallbackData: 0 },
  )
  const result = useSWRInfinite(
    (index: number, previous: ConversationPage | null) => {
      if (!accessToken || (index > 0 && !previous?.nextCursor)) return null
      return [
        inboxPageKey(box, previous?.nextCursor ?? undefined),
        accessToken,
        revision,
      ] as const
    },
    ([url, token]: readonly [string, string, number]) =>
      fetchConversations([url, token]),
    {
      persistSize: false,
      shouldRetryOnError: false,
      refreshInterval: connected ? 0 : 5000,
      onError: (error: unknown) => {
        if (error instanceof ApiError && error.status === 401) router.refresh()
      },
    },
  )
  const pages = result.data ?? []
  return {
    conversations: [
      ...new Map(
        pages.flatMap((page) => page.items).map((item) => [item.id, item]),
      ).values(),
    ],
    hasMore: Boolean(pages.at(-1)?.nextCursor),
    loadMore: () => result.setSize(result.size + 1),
    isLoading: result.isLoading,
    isValidating: result.isValidating,
    error: result.error,
    retry: result.mutate,
  }
}

export function useConversation(id: string | null) {
  const connected = useMessagingConnection()
  return useAuthedSWR(id ? conversationKey(id) : null, fetchConversation, {
    shouldRetryOnError: false,
    refreshInterval: connected ? 0 : 5000,
  })
}
export function useMessagingContact(id: string | null) {
  const connected = useMessagingConnection()
  return useAuthedSWR(id ? contactKey(id) : null, fetchMessagingContact, {
    shouldRetryOnError: false,
    refreshInterval: connected ? 0 : 5000,
  })
}

export function useMessageHistory(id: string | null) {
  const { accessToken } = useAuth()
  const connected = useMessagingConnection()
  const router = useRouter()
  const result = useSWRInfinite(
    (index: number, previous: MessagePage | null) => {
      if (!id || !accessToken || (index > 0 && !previous?.nextCursor))
        return null
      return [
        messagePageKey(id, previous?.nextCursor ?? undefined),
        accessToken,
      ] as const
    },
    fetchMessages,
    {
      shouldRetryOnError: false,
      refreshInterval: connected ? 0 : 5000,
      onError: (error: unknown) => {
        if (error instanceof ApiError && error.status === 401) router.refresh()
      },
    },
  )
  const revalidate = result.mutate
  // A resumed stream has no replay guarantee. Reconcile every loaded history page.
  useEffect(() => {
    if (connected) void revalidate().catch(() => undefined)
  }, [connected, revalidate])
  const pages = result.data ?? []
  return {
    messages: [
      ...new Map(
        pages.flatMap((page) => page.items).map((item) => [item.id, item]),
      ).values(),
    ].sort((a, b) => a.sequence - b.sequence),
    hasMore: Boolean(pages.at(-1)?.nextCursor),
    loadMore: () => result.setSize(result.size + 1),
    isLoading: result.isLoading,
    isValidating: result.isValidating,
    error: result.error,
    retry: result.mutate,
  }
}

export function useMessagingActions() {
  const { accessToken } = useAuth()
  const router = useRouter()
  const { mutate } = useSWRConfig()
  const request = useCallback(
    async <T>(action: (token: string) => Promise<T>) => {
      if (!accessToken) {
        router.refresh()
        throw new ApiError(
          401,
          "UNAUTHORIZED",
          "Authentication required",
          undefined,
        )
      }
      try {
        return await action(accessToken)
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) router.refresh()
        throw error
      }
    },
    [accessToken, router],
  )
  const send = useCallback(
    async (
      target: { conversationId: string } | { userId: string },
      body: string,
      clientMessageId: string,
    ) => {
      const result = await request((token) =>
        sendDirectMessage(token, target, body, clientMessageId),
      )
      if (accessToken)
        void invalidateMessaging(
          mutate,
          accessToken,
          result.conversationId,
        ).catch(() => undefined)
      return result
    },
    [request, accessToken, mutate],
  )
  const markRead = useCallback(
    async (id: string, messageId: string) => {
      const result = await request((token) =>
        markConversationRead(token, id, messageId),
      )
      if (accessToken)
        void invalidateMessaging(mutate, accessToken, id, false).catch(
          () => undefined,
        )
      return result
    },
    [request, accessToken, mutate],
  )
  return { send, markRead }
}
