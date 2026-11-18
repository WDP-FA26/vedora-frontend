"use client"

import { useRef, useState, type RefObject } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSWRConfig } from "swr"
import { CheckIcon, LinkIcon, MessageCircleIcon, ShareIcon } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { useProfileList } from "@/features/profiles/hooks/use-profile-list"
import { ProfileAvatar } from "@/features/profiles/components/profile-avatar"
import { postPath } from "@/features/posts/posts-cache"
import { useConversations } from "../hooks/use-messaging"
import { sharePostInMessage, messagingError } from "../lib/messaging-api"
import { invalidateMessaging } from "../lib/invalidate-messaging"
import { messagingPath } from "../messaging-cache"
import type { MessagingPeer } from "../schemas"

export function SharePostMenu({ postId }: { postId: string }) {
  const { user, isAuthenticated } = useAuth()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  // Failed/uncertain attempts survive closing the dialog, so retrying cannot duplicate a message.
  const attempts = useRef(new Map<string, string>())

  async function copyLink() {
    const url = `${window.location.origin}${postPath(postId)}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      window.prompt("Sao chép liên kết bài viết:", url)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={copied ? "Đã sao chép liên kết" : "Chia sẻ"}
          render={<Button variant="action" size="count" shape="pill" />}
        >
          {copied ? <CheckIcon aria-hidden /> : <ShareIcon aria-hidden />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setOpen(true)}>
            <MessageCircleIcon aria-hidden />
            Gửi qua tin nhắn
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void copyLink()}>
            <LinkIcon aria-hidden />
            Sao chép liên kết
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value)
        }}
      >
        <DialogContent showCloseButton={!busy} className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chia sẻ qua tin nhắn</DialogTitle>
            <DialogDescription>
              Chọn người nhận để gửi bài viết vào cuộc trò chuyện.
            </DialogDescription>
          </DialogHeader>
          {open && isAuthenticated && user ? (
            <ShareRecipients
              postId={postId}
              userId={user.id}
              attempts={attempts}
              onBusy={setBusy}
            />
          ) : (
            <Link className={buttonVariants()} href={`/login?next=${encodeURIComponent(pathname)}`}>
              Đăng nhập để chia sẻ
            </Link>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

type Recipient = { peer: MessagingPeer; canSend: boolean }

function ShareRecipients({
  postId,
  userId,
  attempts,
  onBusy,
}: {
  postId: string
  userId: string
  attempts: RefObject<Map<string, string>>
  onBusy: (value: boolean) => void
}) {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()
  const friends = useConversations("friends")
  const requests = useConversations("requests")
  const following = useProfileList(userId, "following")
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<Recipient | null>(null)
  const [sending, setSending] = useState(false)
  const lock = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<{ name: string; conversationId: string } | null>(null)
  const recipients = new Map<string, Recipient>()
  for (const item of [...friends.conversations, ...requests.conversations])
    recipients.set(item.peer.id, item)
  for (const peer of following.profiles)
    if (!recipients.has(peer.id)) recipients.set(peer.id, { peer, canSend: true })
  const term = query.trim().toLocaleLowerCase("vi")
  const visible = [...recipients.values()].filter(
    ({ peer }) =>
      peer.id !== userId &&
      `${peer.fullName} ${peer.username}`.toLocaleLowerCase("vi").includes(term)
  )
  const loading = friends.isLoading || requests.isLoading || following.isLoading
  const loadError = friends.error || requests.error || following.error
  const hasMore = friends.hasMore || requests.hasMore || following.hasMore

  async function submit() {
    if (lock.current || !selected?.canSend || !accessToken || sent) return
    lock.current = true
    setSending(true)
    onBusy(true)
    setError(null)
    const attemptKey = `${userId}:${postId}:${selected.peer.id}`
    const id = attempts.current.get(attemptKey) ?? crypto.randomUUID()
    attempts.current.set(attemptKey, id)
    try {
      // Use the stable user target even if a first request creates a new conversation.
      const result = await sharePostInMessage(accessToken, { userId: selected.peer.id }, postId, id)
      attempts.current.delete(attemptKey)
      setSent({ name: selected.peer.fullName, conversationId: result.conversationId })
      void invalidateMessaging(mutate, accessToken, result.conversationId).catch(() => undefined)
    } catch (failure) {
      setError(messagingError(failure))
    } finally {
      lock.current = false
      setSending(false)
      onBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Input
        aria-label="Tìm người nhận trong danh sách"
        placeholder="Tìm theo tên hoặc tên người dùng"
        value={query}
        disabled={sending}
        onChange={(event) => setQuery(event.target.value)}
      />
      <p className="text-xs text-muted-foreground">
        Cuộc trò chuyện gần đây và người bạn đang theo dõi.
      </p>
      {loading && <Spinner aria-label="Đang tải người nhận" />}
      {loadError && (
        <p role="alert" className="text-sm text-destructive">
          Không tải được một phần danh sách. Thử đóng và mở lại để tải lại.
        </p>
      )}
      {!loading && visible.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Chưa có người nhận phù hợp. Bạn có thể theo dõi người dùng hoặc chấp nhận lời mời nhắn tin
          để chia sẻ.
        </p>
      )}
      <ul aria-label="Người nhận bài viết" className="max-h-64 space-y-1 overflow-y-auto">
        {visible.map((item) => (
          <li key={item.peer.id}>
            <button
              type="button"
              aria-pressed={selected?.peer.id === item.peer.id}
              disabled={sending || !item.canSend}
              onClick={() => {
                setSelected(item)
                setSent(null)
                setError(null)
              }}
              className="flex w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-muted aria-pressed:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ProfileAvatar profile={item.peer} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{item.peer.fullName}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  @{item.peer.username}
                  {!item.canSend && " · Cần chấp nhận lời mời để gửi"}
                </span>
              </span>
              {selected?.peer.id === item.peer.id && (
                <CheckIcon className="size-4 shrink-0" aria-hidden />
              )}
            </button>
          </li>
        ))}
      </ul>
      {hasMore && (
        <Button
          variant="outline"
          disabled={
            sending || friends.isValidating || requests.isValidating || following.isLoadingMore
          }
          onClick={() => {
            if (friends.hasMore) void friends.loadMore()
            if (requests.hasMore) void requests.loadMore()
            if (following.hasMore) void following.loadMore()
          }}
        >
          Xem thêm người nhận
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {sent ? (
        <div role="status" className="space-y-2">
          <p>Đã gửi bài viết cho {sent.name}.</p>
          <Link className={buttonVariants()} href={messagingPath({ conversation: sent.conversationId })}>
            Mở cuộc trò chuyện
          </Link>
        </div>
      ) : (
        <Button
          className="w-full"
          disabled={!selected?.canSend || sending}
          onClick={() => void submit()}
        >
          {sending && <Spinner aria-hidden />}
          {sending ? "Đang gửi…" : "Gửi bài viết"}
        </Button>
      )}
    </div>
  )
}
