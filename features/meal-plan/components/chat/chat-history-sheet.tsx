"use client"

import { MessageSquarePlusIcon, Trash2Icon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Spinner } from "@/components/ui/spinner"
import type { ChatThreadSummary } from "@/features/meal-plan/schemas/chat.schema"
import { cn } from "@/lib/utils"

function formatThreadTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function ChatHistorySheet({
  open,
  onOpenChange,
  threads,
  threadsLoading,
  activeThreadId,
  loadingThreadId,
  deletingThreadId,
  historyError,
  onNewThread,
  onSelectThread,
  onRemoveThread,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  threads: ChatThreadSummary[]
  threadsLoading: boolean
  activeThreadId: string
  loadingThreadId: string | null
  deletingThreadId: string | null
  historyError: string | null
  onNewThread: () => void
  onSelectThread: (id: string) => void
  onRemoveThread: (id: string) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-sm">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-border pr-8">
            <SheetHeader>
              <SheetTitle>Lịch sử đoạn chat</SheetTitle>
              <SheetDescription>Xem lại hoặc tiếp tục các cuộc trò chuyện trước</SheetDescription>
              <div className="pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    onNewThread()
                    onOpenChange(false)
                  }}
                >
                  <MessageSquarePlusIcon aria-hidden /> Đoạn chat mới
                </Button>
              </div>
            </SheetHeader>
          </div>

          {historyError && (
            <p role="alert" className="border-b border-border px-4 py-2 text-xs text-destructive">
              {historyError}
            </p>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {threadsLoading && threads.length === 0 ? (
              <p role="status" className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
                <Spinner aria-hidden /> Đang tải lịch sử đoạn chat…
              </p>
            ) : threads.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Chưa có lịch sử đoạn chat nào. Hãy gửi tin nhắn đầu tiên để bắt đầu.
              </p>
            ) : (
              <ul className="flex flex-col">
                {threads.map((thread) => {
                  const isActive = thread.id === activeThreadId
                  const isDeleting = deletingThreadId === thread.id
                  const isLoading = loadingThreadId === thread.id
                  return (
                    <li
                      key={thread.id}
                      className={cn(
                        "flex items-start gap-2 border-b border-border px-4 py-3 transition-colors",
                        isActive ? "bg-secondary/50" : "hover:bg-muted/40"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectThread(thread.id)}
                        disabled={isLoading || isDeleting}
                        className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-foreground">
                            {thread.title}
                          </span>
                          {isActive && <Badge variant="secondary">Đang mở</Badge>}
                          {isLoading && <Spinner aria-hidden />}
                        </div>
                        {thread.lastMessagePreview && (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {thread.lastMessagePreview}
                          </p>
                        )}
                        <p className="mt-1.5 text-[0.6875rem] text-muted-foreground">
                          {thread.messageCount} tin nhắn · {formatThreadTime(thread.lastMessageAt)}
                        </p>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Xóa đoạn chat ${thread.title}`}
                        disabled={isDeleting}
                        onClick={() => onRemoveThread(thread.id)}
                      >
                        {isDeleting ? <Spinner aria-hidden /> : <Trash2Icon aria-hidden />}
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
