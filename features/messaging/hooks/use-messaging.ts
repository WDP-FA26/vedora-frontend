"use client"

import { useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSWRConfig } from "swr"
import useSWRInfinite from "swr/infinite"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import { useLocalSWRState } from "@/features/shared/hooks/use-local-swr-state"
import { ApiError } from "@/features/shared/lib/api-client"
import {
  contactKey,
  conversationKey,
  inboxPageKey,
  INBOX_REVISION_KEY,
  MESSAGING_CONNECTION_KEY,
  MESSAGE_UNREAD_COUNT_KEY,
  messagePageKey,
} from "../messaging-cache"
import {
  fetchConversations,
  fetchConversation,
  fetchMessagingContact,
  fetchMessages,
  fetchMessagingUnreadCount,
  markConversationRead,
  sendDirectMessage,
  acceptMessageRequest,
  deleteMessageRequest,
} from "../lib/messaging-api"
import {
  forgetMessageRequest,
  invalidateMessaging,
} from "../lib/invalidate-messaging"
import type { ConversationPage, Inbox, MessagePage } from "../schemas"

export function useMessagingConnection() {
  const { accessToken } = useAuth()
  return useLocalSWRState<boolean>(
    accessToken ? [MESSAGING_CONNECTION_KEY, accessToken] : null,
    false,
  )
}

export function useUnreadMessageCount() {
  const connected = useMessagingConnection()
  const { data } = useAuthedSWR(MESSAGE_UNREAD_COUNT_KEY, fetchMessagingUnreadCount, {
    refreshInterval: connected ? 0 : 5000,
    shouldRetryOnError: false,
  })
  return data ?? 0
}

export function useConversations(box: Inbox) {
  const { accessToken } = useAuth()
  const connected = useMessagingConnection()
  const router = useRouter()
  const revision = useLocalSWRState<number>(
    accessToken ? [INBOX_REVISION_KEY, accessToken] : null,
    0,
  )
  const result = useSWRInfinite(
    (index: number, previous: ConversationPage | null) => {
      if (!accessToken || (index > 0 && !previous?.nextCursor)) return null
      return [
        inboxPageKey(box, previous?.nextCursor ?? undefined),
        accessToken,
      ] as const
    },
    fetchConversations,
    {
      persistSize: false,
      shouldRetryOnError: false,
      refreshInterval: connected ? 0 : 5000,
      onError: (error: unknown) => {
        if (error instanceof ApiError && error.status === 401) router.refresh()
      },
    },
  )
  const { setSize, mutate: revalidate } = result
  useEffect(() => {
    let active = true
    // Reuse cache keys; activity must not create a new cache generation per event.
    void setSize(1)
      .then(() => (active ? revalidate() : undefined))
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [revision, setSize, revalidate])
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
    retry: () => setSize(1).then(() => revalidate()),
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

export function useMessageHistory(
  id: string | null,
  deletedThroughSequence = 0,
) {
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
  const resetHistorySize = result.setSize
  useEffect(() => {
    if (deletedThroughSequence > 0)
      void resetHistorySize(1)
        .then(() => revalidate())
        .catch(() => undefined)
  }, [deletedThroughSequence, resetHistorySize, revalidate])
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
    ]
      .filter((message) => message.sequence > deletedThroughSequence)
      .sort((a, b) => a.sequence - b.sequence),
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
  const acceptRequest = useCallback(
    async (id: string) => {
      const result = await request((token) => acceptMessageRequest(token, id))
      if (accessToken) {
        await mutate([conversationKey(id), accessToken], result, {
          revalidate: false,
        })
        void invalidateMessaging(mutate, accessToken, id, false).catch(
          () => undefined,
        )
      }
      return result
    },
    [request, accessToken, mutate],
  )
  const deleteRequest = useCallback(
    async (id: string, throughMessageId: string) => {
      const result = await request((token) =>
        deleteMessageRequest(token, id, throughMessageId),
      )
      if (accessToken) {
        await forgetMessageRequest(mutate, accessToken, id)
        void invalidateMessaging(mutate, accessToken, id).catch(() => undefined)
      }
      return result
    },
    [request, accessToken, mutate],
  )
  return { send, markRead, acceptRequest, deleteRequest }
}
