"use client"

import Link from "next/link"
import {
  BellIcon,
  CheckCheckIcon,
  CircleCheckIcon,
  ClockIcon,
  FlagIcon,
  FlagOffIcon,
  HeartIcon,
  HourglassIcon,
  LifeBuoyIcon,
  MessageCircleIcon,
  Repeat2Icon,
  RotateCcwIcon,
  ShieldAlertIcon,
  Trash2Icon,
  UserPlusIcon,
} from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { supportTicketPath } from "@/features/support/support-cache"
import { toAuthor } from "@/features/auth/lib/to-author"
import { AuthorAvatar } from "@/features/shared/components/author-avatar"
import { RelativeTime } from "@/features/shared/components/relative-time"
import { describeNotification } from "@/features/notifications/lib/notification-text"
import { editBlogPath } from "@/features/blogs/blogs-cache"
import { useNotifications, useUnreadCount } from "@/features/notifications/hooks/use-notifications"
import type { ApiNotification } from "@/features/notifications/schemas"
import { profilePath } from "@/features/profiles/profiles-cache"

const ICONS = {
  LIKE: HeartIcon,
  COMMENT: MessageCircleIcon,
  COMMENT_REPLY: MessageCircleIcon,
  COMMENT_REMOVED: Trash2Icon,
  COMMENT_REMOVED_BY_POST_OWNER: Trash2Icon,
  COMMENT_THREAD_REMOVED: MessageCircleIcon,
  COMMENT_REPORT_RESOLVED: FlagIcon,
  COMMENT_REPORT_DISMISSED: FlagOffIcon,
  REPOST: Repeat2Icon,
  FOLLOW: UserPlusIcon,
  POST_PUBLISHED: CircleCheckIcon,
  POST_PENDING_REVIEW: HourglassIcon,
  POST_APPROVED: CircleCheckIcon,
  POST_REJECTED: ShieldAlertIcon,
  POST_REMOVED: Trash2Icon,
  POST_RESTORED: RotateCcwIcon,
  REPORT_RESOLVED: FlagIcon,
  REPORT_DISMISSED: FlagOffIcon,
  REPORTED_POST_REMOVED: FlagIcon,
  SUPPORT_TICKET_REPLIED: LifeBuoyIcon,
  SUPPORT_TICKET_RESOLVED: CircleCheckIcon,
  SUPPORT_TICKET_CLOSED: ShieldAlertIcon,
  SUPPORT_TICKET_EXPIRED: ClockIcon,
  SUPPORT_TICKET_REMINDER: ClockIcon,
} as const

/** Only moderation and support results carry an admin's note; removals carry the post excerpt instead. */
const ADMIN_NOTE_TYPES = new Set<ApiNotification["type"]>([
  "POST_PENDING_REVIEW",
  "POST_APPROVED",
  "POST_REJECTED",
  "POST_RESTORED",
  "SUPPORT_TICKET_REPLIED",
  "SUPPORT_TICKET_RESOLVED",
  "SUPPORT_TICKET_CLOSED",
  "SUPPORT_TICKET_EXPIRED",
  "SUPPORT_TICKET_REMINDER",
])

/** Notes the scheduler writes; they are shown without the "from an admin" label. */
const SYSTEM_NOTE_TYPES = new Set<ApiNotification["type"]>([
  "SUPPORT_TICKET_REMINDER",
  "SUPPORT_TICKET_EXPIRED",
])

function noteText(notification: ApiNotification, note: string): string {
  if (SYSTEM_NOTE_TYPES.has(notification.type)) return note
  return `Ghi chú từ quản trị viên: ${note}`
}

function hrefFor(notification: ApiNotification) {
  const { postId, ticketId, type, postType, actor } = notification
  if (
    ticketId &&
    (type === "SUPPORT_TICKET_REPLIED" ||
      type === "SUPPORT_TICKET_RESOLVED" ||
      type === "SUPPORT_TICKET_CLOSED" ||
      type === "SUPPORT_TICKET_EXPIRED" ||
      type === "SUPPORT_TICKET_REMINDER")
  ) {
    return supportTicketPath(ticketId)
  }
  // A blocked blog is fixed in the editor; everything else opens the post.
  if (postId && type === "POST_REJECTED" && postType === "BLOG") return editBlogPath(postId)
  if (postId && notification.commentId && (type === "COMMENT" || type === "COMMENT_REPLY")) {
    return `/posts/${postId}?comment=${encodeURIComponent(notification.commentId)}#comments`
  }
  if (postId) return `/posts/${postId}`
  if (
    type === "COMMENT_REMOVED" ||
    type === "COMMENT_REMOVED_BY_POST_OWNER" ||
    type === "COMMENT_THREAD_REMOVED" ||
    type === "COMMENT_REPORT_RESOLVED" ||
    type === "COMMENT_REPORT_DISMISSED"
  )
    return "/home/notifications"
  return actor ? profilePath(actor.id) : "/home"
}

export function NotificationsView() {
  const { notifications, hasMore, error, isLoading, markRead } = useNotifications()
  const unread = useUnreadCount()

  return (
    <section aria-labelledby="notifications-title">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-card/85 px-4 py-2 backdrop-blur-md sm:px-5">
        <h1 id="notifications-title" className="text-lg font-bold">
          Thông báo
        </h1>
        <Button
          variant="ghost"
          size="sm"
          shape="pill"
          disabled={unread === 0}
          onClick={() => void markRead()}
        >
          <CheckCheckIcon aria-hidden />
          Đánh dấu đã đọc
        </Button>
      </header>

      {isLoading ? (
        <div className="flex justify-center p-6">
          <Spinner aria-label="Đang tải thông báo" />
        </div>
      ) : error ? (
        <p role="alert" className="p-4 text-sm text-destructive sm:px-5">
          Không tải được thông báo. Thử tải lại trang nhé.
        </p>
      ) : notifications.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BellIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Chưa có thông báo</EmptyTitle>
            <EmptyDescription>
              Khi có người thích, bình luận hoặc theo dõi bạn, bạn sẽ thấy ở đây.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <ul>
            {notifications.map((notification) => {
              const Icon =
                notification.type === "SUPPORT_TICKET_RESOLVED" &&
                notification.reason === "APPEAL_REJECTED"
                  ? ShieldAlertIcon
                  : ICONS[notification.type]
              const { from, text } = describeNotification(notification)
              return (
                <li key={notification.id} className="border-b border-border">
                  <Link
                    href={hrefFor(notification)}
                    onClick={() => void markRead(notification.id)}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 sm:px-5",
                      !notification.readAt && "bg-primary/5"
                    )}
                  >
                    <Icon aria-hidden className="mt-1 size-5 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      {notification.actor && (
                        <AuthorAvatar author={toAuthor(notification.actor)} size="sm" />
                      )}
                      <p className={cn("text-sm", notification.actor && "mt-1.5")}>
                        <span className="font-bold">{from}</span> {text}
                      </p>
                      {notification.note && ADMIN_NOTE_TYPES.has(notification.type) && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {noteText(notification, notification.note)}
                        </p>
                      )}
                      <RelativeTime
                        iso={notification.createdAt}
                        className="text-xs text-muted-foreground"
                      />
                    </div>
                    {!notification.readAt && (
                      <span
                        aria-label="Chưa đọc"
                        className="mt-2 size-2 shrink-0 rounded-full bg-primary"
                      />
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
          {hasMore && (
            <p className="p-4 text-center text-sm text-muted-foreground">
              Đang hiển thị 30 thông báo gần nhất.
            </p>
          )}
        </>
      )}
    </section>
  )
}
