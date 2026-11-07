"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSWRConfig } from "swr"
import {
  EventStreamContentType,
  fetchEventSource,
} from "@microsoft/fetch-event-source"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { MESSAGING_CONNECTION_KEY } from "../messaging-cache"
import { MESSAGING_STREAM_URL } from "../lib/messaging-api"
import { invalidateMessaging } from "../lib/invalidate-messaging"
import { messagingEventSchema } from "../schemas"

class FatalStreamError extends Error {}

/** One authenticated stream per home layout, shared by the inbox and open chat. */
export function useMessagingStream() {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()
  const router = useRouter()
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!accessToken) return
    const controller = new AbortController()
    let live = false,
      lastFrame = Date.now()
    const health = (connected: boolean) => {
      live = connected
      if (!controller.signal.aborted)
        void mutate([MESSAGING_CONNECTION_KEY, accessToken], connected, {
          revalidate: false,
        })
    }
    const refresh = (id?: string, changed = true) => {
      if (!controller.signal.aborted)
        void invalidateMessaging(mutate, accessToken, id, changed).catch(
          () => undefined,
        )
    }
    const watchdog = setInterval(() => {
      if (Date.now() - lastFrame > 35_000) {
        health(false)
        controller.abort()
        setRetry((value) => value + 1)
      }
    }, 5000)
    void fetchEventSource(MESSAGING_STREAM_URL, {
      signal: controller.signal,
      openWhenHidden: true,
      headers: { Authorization: `Bearer ${accessToken}` },
      async onopen(response) {
        lastFrame = Date.now()
        if (
          response.ok &&
          response.headers
            .get("content-type")
            ?.startsWith(EventStreamContentType)
        ) {
          refresh()
          return
        }
        if (response.status === 401) router.refresh()
        if (response.status < 500)
          throw new FatalStreamError("Messaging stream access denied")
        throw new Error("Messaging stream unavailable")
      },
      onmessage(event) {
        lastFrame = Date.now()
        if (event.event === "session.expired") {
          health(false)
          controller.abort()
          router.refresh()
          return
        }
        if (event.event === "stream.ready") {
          health(true)
          refresh()
          return
        }
        if (event.event === "stream.unavailable") {
          health(false)
          return
        }
        try {
          if (event.event === "ping") {
            const data = JSON.parse(event.data) as { connected?: unknown }
            if (typeof data.connected === "boolean") {
              if (data.connected && !live) refresh()
              health(data.connected)
            }
            return
          }
          if (
            ![
              "message.created",
              "conversation.read",
              "relationship.changed",
            ].includes(event.event)
          )
            return
          const parsed = messagingEventSchema.safeParse(JSON.parse(event.data))
          if (parsed.success)
            refresh(
              parsed.data.conversationId ?? undefined,
              event.event === "message.created",
            )
        } catch {
          /* Invalid frames do not establish message state. */
        }
      },
      onclose() {
        health(false)
        throw new Error("Messaging stream closed")
      },
      onerror(error: unknown) {
        health(false)
        if (error instanceof FatalStreamError) throw error
        return 2000
      },
    })
      .catch(() => health(false))
      .finally(() => clearInterval(watchdog))
    return () => {
      clearInterval(watchdog)
      controller.abort()
      void mutate([MESSAGING_CONNECTION_KEY, accessToken], false, {
        revalidate: false,
      })
    }
  }, [accessToken, mutate, router, retry])
}
