"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeftIcon, MessageCircleIcon, SendIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { FollowButton } from "@/features/profiles/components/follow-button"
import { ProfileAvatar } from "@/features/profiles/components/profile-avatar"
import { profilePath } from "@/features/profiles/profiles-cache"
import { cn } from "@/lib/utils"
import {
  useConversation,
  useConversations,
  useMessageHistory,
  useMessagingActions,
  useMessagingConnection,
  useMessagingContact,
} from "../hooks/use-messaging"
import { messagingPath } from "../messaging-cache"
import { messagingError } from "../lib/messaging-api"
import {
  MAX_MESSAGE_LENGTH,
  type Conversation,
  type DirectMessage,
  type Inbox,
  type MessagingContact,
} from "../schemas"

export function MessagesView() {
  const query = useSearchParams()
  const router = useRouter()
  const id = query.get("conversation")
  const to = id ? null : query.get("to")
  const contact = useMessagingContact(to)
  const resolvedId = id ?? contact.data?.conversationId ?? null
  const conversation = useConversation(resolvedId)
  const box: Inbox =
    conversation.data?.box ??
    contact.data?.box ??
    (query.get("box") === "requests" ? "requests" : "friends")
  const inbox = useConversations(box)
  const connected = useMessagingConnection()
  const selected = Boolean(id || to)

  return (
    <section
      aria-label="Tin nhắn"
      className="flex h-[calc(100dvh-4rem)] min-h-96 md:h-dvh"
    >
      <aside
        className={cn(
          "w-full flex-col border-r border-border md:flex md:w-80 md:shrink-0",
          selected ? "hidden" : "flex",
        )}
      >
        <header className="border-b border-border p-4">
          <h1 className="text-xl font-bold">Tin nhắn</h1>
          <p role="status" className="mt-1 text-xs text-muted-foreground">
            {connected
              ? "Đã kết nối"
              : "Đang kết nối lại · tự cập nhật mỗi 5 giây"}
          </p>
          <div className="mt-4 flex gap-2" aria-label="Hộp thư">
            {(
              [
                ["friends", "Bạn bè"],
                ["requests", "Tin nhắn lạ"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                variant={box === value ? "default" : "outline"}
                size="sm"
                nativeButton={false}
                render={<Link href={messagingPath({ box: value })} />}
                aria-current={box === value ? "page" : undefined}
              >
                {label}
              </Button>
            ))}
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {inbox.isLoading && (
            <p role="status" className="p-4 text-sm">
              Đang tải hộp thư…
            </p>
          )}
          {Boolean(inbox.error) && (
            <LoadError error={inbox.error} retry={() => void inbox.retry()} />
          )}
          {!inbox.isLoading && !inbox.error && !inbox.conversations.length && (
            <p className="p-5 text-sm text-muted-foreground">
              {box === "friends"
                ? "Bạn bè là những người theo dõi nhau. Bắt đầu nhắn tin từ trang hồ sơ của họ."
                : "Tin nhắn khi chưa theo dõi nhau hai chiều sẽ xuất hiện ở đây, bao gồm tin bạn đã gửi."}
            </p>
          )}
          {inbox.conversations.map((item) => (
            <Link
              key={item.id}
              href={messagingPath({ box, conversation: item.id })}
              aria-current={resolvedId === item.id ? "page" : undefined}
              className={cn(
                "flex min-w-0 gap-3 border-b border-border p-4 hover:bg-muted",
                resolvedId === item.id && "bg-muted",
              )}
            >
              <ProfileAvatar profile={item.peer} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{item.peer.fullName}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {item.lastMessage?.body}
                </p>
                {item.requestDirection && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.requestDirection === "incoming"
                      ? "Tin nhắn đến"
                      : "Bạn đã gửi lời nhắn"}
                  </p>
                )}
              </div>
              {item.unreadCount > 0 && (
                <span
                  aria-label={`${item.unreadCount} tin chưa đọc`}
                  className="h-fit rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground"
                >
                  {item.unreadCount}
                </span>
              )}
            </Link>
          ))}
          {inbox.hasMore && (
            <Button
              variant="ghost"
              className="w-full"
              disabled={inbox.isValidating}
              onClick={() => void inbox.loadMore()}
            >
              Tải thêm cuộc trò chuyện
            </Button>
          )}
        </div>
      </aside>
      <div
        className={cn(
          "min-w-0 flex-1 flex-col",
          selected ? "flex" : "hidden md:flex",
        )}
      >
        {!selected ? (
          <div className="m-auto p-6 text-center text-muted-foreground">
            <MessageCircleIcon aria-hidden className="mx-auto mb-3 size-10" />
            <p>Chọn một cuộc trò chuyện để bắt đầu.</p>
          </div>
        ) : (
          <>
            <Link
              href={messagingPath({ box })}
              className="flex items-center gap-2 border-b border-border p-3 text-sm md:hidden"
            >
              <ArrowLeftIcon className="size-4" />
              Hộp thư
            </Link>
            {(contact.error || conversation.error) && (
              <LoadError
                error={contact.error ?? conversation.error}
                retry={() => {
                  void contact.mutate()
                  void conversation.mutate()
                }}
              />
            )}
            {(conversation.data ?? contact.data) ? (
              <Thread
                key={(conversation.data ?? contact.data)!.peer.id}
                target={conversation.data ?? contact.data!}
                conversation={conversation.data}
                conversationId={resolvedId}
                onCreated={(newId) =>
                  router.replace(messagingPath({ conversation: newId, box }))
                }
              />
            ) : (
              !contact.error &&
              !conversation.error && (
                <p role="status" className="p-5">
                  Đang tải cuộc trò chuyện…
                </p>
              )
            )}
          </>
        )}
      </div>
    </section>
  )
}

function LoadError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div role="alert" className="p-4 text-sm">
      <p>{messagingError(error)}</p>
      <Button variant="outline" size="sm" className="mt-2" onClick={retry}>
        Thử lại
      </Button>
    </div>
  )
}

function Thread({
  target,
  conversation,
  conversationId,
  onCreated,
}: {
  target: Conversation | MessagingContact
  conversation?: Conversation
  conversationId: string | null
  onCreated: (id: string) => void
}) {
  const { user } = useAuth()
  const history = useMessageHistory(conversationId)
  const { send, markRead } = useMessagingActions()
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [confirmed, setConfirmed] = useState<DirectMessage[]>([])
  const [atBottom, setAtBottom] = useState(true)
  const [focused, setFocused] = useState(true)
  const viewport = useRef<HTMLDivElement>(null)
  const busy = useRef(false)
  const attempt = useRef<{ body: string; id: string } | null>(null)
  const read = useRef<string | null>(null)
  const olderHeight = useRef<number | null>(null)
  const messages = [
    ...new Map(
      [...history.messages, ...confirmed].map((message) => [
        message.id,
        message,
      ]),
    ).values(),
  ].sort((a, b) => a.sequence - b.sequence)
  const newest = messages.at(-1)
  const lastIncoming = messages.findLast(
    (message) => message.senderId !== user?.id,
  )

  useEffect(() => {
    const update = () =>
      setFocused(document.visibilityState === "visible" && document.hasFocus())
    update()
    window.addEventListener("focus", update)
    window.addEventListener("blur", update)
    document.addEventListener("visibilitychange", update)
    return () => {
      window.removeEventListener("focus", update)
      window.removeEventListener("blur", update)
      document.removeEventListener("visibilitychange", update)
    }
  }, [])
  useLayoutEffect(() => {
    const node = viewport.current
    if (!node) return
    if (olderHeight.current !== null) {
      node.scrollTop += node.scrollHeight - olderHeight.current
      olderHeight.current = null
    } else if (atBottom) node.scrollTop = node.scrollHeight
  }, [messages.length, newest?.id, atBottom])
  useEffect(() => {
    if (
      !conversationId ||
      !lastIncoming ||
      !atBottom ||
      !focused ||
      lastIncoming.sequence <= (conversation?.myReadSequence ?? 0) ||
      read.current === lastIncoming.id
    )
      return
    const id = lastIncoming.id
    read.current = id
    void markRead(conversationId, id).catch(() => {
      if (read.current === id) read.current = null
    })
  }, [
    conversationId,
    lastIncoming,
    atBottom,
    focused,
    conversation?.myReadSequence,
    markRead,
  ])

  async function submit() {
    const body = draft.trim()
    if (busy.current || !body || !target.canSend) return
    busy.current = true
    setSending(true)
    setError(null)
    if (attempt.current?.body !== body)
      attempt.current = { body, id: crypto.randomUUID() }
    try {
      const result = await send(
        conversationId ? { conversationId } : { userId: target.peer.id },
        body,
        attempt.current.id,
      )
      setConfirmed((items) => [...items, result.message])
      setDraft("")
      attempt.current = null
      setAtBottom(true)
      if (!conversationId) onCreated(result.conversationId)
    } catch (failure) {
      setError(failure)
    } finally {
      busy.current = false
      setSending(false)
    }
  }

  return (
    <>
      <header className="flex items-center gap-3 border-b border-border p-4">
        <ProfileAvatar profile={target.peer} size="sm" />
        <Link href={profilePath(target.peer.id)} className="min-w-0">
          <p className="truncate font-semibold">{target.peer.fullName}</p>
          <p className="truncate text-xs text-muted-foreground">
            @{target.peer.username}
          </p>
        </Link>
      </header>
      {target.box === "requests" && (
        <p className="border-b border-border p-3 text-sm text-muted-foreground">
          {target.peerFollowsYou && !target.followsPeer
            ? "Người này đang theo dõi bạn. Theo dõi lại để trở thành bạn bè và trả lời."
            : "Hai bạn chưa theo dõi nhau hai chiều. Tin nhắn nằm trong hộp thư lạ."}
        </p>
      )}
      <div
        ref={viewport}
        role="log"
        aria-label="Lịch sử tin nhắn"
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4"
        onScroll={() => {
          const node = viewport.current
          if (node)
            setAtBottom(
              node.scrollHeight - node.scrollTop - node.clientHeight < 32,
            )
        }}
      >
        {history.hasMore && (
          <Button
            variant="ghost"
            className="w-full"
            disabled={history.isValidating}
            onClick={() => {
              olderHeight.current = viewport.current?.scrollHeight ?? null
              void history.loadMore().catch(() => {
                olderHeight.current = null
              })
            }}
          >
            Tải tin nhắn cũ
          </Button>
        )}
        {history.isLoading && (
          <p role="status" className="text-sm text-muted-foreground">
            Đang tải tin nhắn…
          </p>
        )}
        {Boolean(history.error) && (
          <LoadError error={history.error} retry={() => void history.retry()} />
        )}
        {messages.map((message) => {
          const mine = message.senderId === user?.id
          return (
            <div
              key={message.id}
              className={cn(
                "flex flex-col",
                mine ? "items-end" : "items-start",
              )}
            >
              <p
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap wrap-anywhere rounded-2xl px-4 py-2 text-sm",
                  mine ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                {message.body}
              </p>
              <span className="mt-1 text-[0.65rem] text-muted-foreground">
                {new Date(message.createdAt).toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {mine &&
                  ` · ${message.sequence <= (conversation?.peerReadSequence ?? 0) ? "Đã xem" : "Đã gửi"}`}
              </span>
            </div>
          )
        })}
        {!conversationId && (
          <p className="text-center text-sm text-muted-foreground">
            Gửi lời chào để bắt đầu cuộc trò chuyện.
          </p>
        )}
      </div>
      {!atBottom && newest && (
        <Button variant="ghost" onClick={() => setAtBottom(true)}>
          Đến tin nhắn mới nhất
        </Button>
      )}
      {!target.canSend && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
          <p className="text-sm text-muted-foreground">
            {target.followsPeer
              ? "Hiện chưa thể gửi tin nhắn cho tài khoản này."
              : "Bạn cần theo dõi người này để gửi tin nhắn."}
          </p>
          {!target.followsPeer && <FollowButton id={target.peer.id} />}
        </div>
      )}
      <form
        className="border-t border-border p-4"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        {error != null && (
          <p role="alert" className="mb-2 text-sm text-destructive">
            {messagingError(error)} Nội dung được giữ lại để bạn thử gửi lại.
          </p>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            aria-label="Nội dung tin nhắn"
            placeholder="Nhập tin nhắn…"
            value={draft}
            maxLength={MAX_MESSAGE_LENGTH}
            disabled={!target.canSend || sending}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault()
                void submit()
              }
            }}
          />
          <Button
            type="submit"
            aria-label="Gửi tin nhắn"
            disabled={!target.canSend || sending || !draft.trim()}
          >
            <SendIcon aria-hidden className="size-4" />
          </Button>
        </div>
        <p className="mt-1 text-right text-xs text-muted-foreground">
          {draft.length}/{MAX_MESSAGE_LENGTH}
        </p>
      </form>
    </>
  )
}
