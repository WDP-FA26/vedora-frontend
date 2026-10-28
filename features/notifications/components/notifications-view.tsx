"use client"

import Link from "next/link"
import { BellIcon, CheckCheckIcon, MessageCircleIcon, HeartIcon, Repeat2Icon, UserPlusIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { toAuthor } from "@/features/auth/lib/to-author"
import { AuthorAvatar } from "@/features/shared/components/author-avatar"
import { formatPostDate, formatPostDateLong } from "@/features/shared/lib/format"
import { NOTIFICATION_TEXT } from "@/features/notifications/lib/notification-text"
import { useNotifications, useUnreadCount } from "@/features/notifications/hooks/use-notifications"
import type { ApiNotification } from "@/features/notifications/schemas"
import { profilePath } from "@/features/profiles/profiles-cache"

const ICONS = {
  LIKE: HeartIcon,
  COMMENT: MessageCircleIcon,
  REPOST: Repeat2Icon,
  FOLLOW: UserPlusIcon,
} as const

function hrefFor(notification: ApiNotification) {
  return notification.postId
    ? `/posts/${notification.postId}`
    : profilePath(notification.actor.id)
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
        <Button variant="ghost" size="sm" shape="pill" disabled={unread === 0} onClick={() => void markRead()}>
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
              const Icon = ICONS[notification.type]
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
                      <AuthorAvatar author={toAuthor(notification.actor)} size="sm" />
                      <p className="mt-1.5 text-sm">
                        <span className="font-bold">{notification.actor.fullName}</span> {NOTIFICATION_TEXT[notification.type]}
                      </p>
                      <time
                        dateTime={notification.createdAt}
                        title={formatPostDateLong(notification.createdAt)}
                        className="text-xs text-muted-foreground"
                      >
                        {formatPostDate(notification.createdAt)}
                      </time>
                    </div>
                    {!notification.readAt && (
                      <span aria-label="Chưa đọc" className="mt-2 size-2 shrink-0 rounded-full bg-primary" />
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
