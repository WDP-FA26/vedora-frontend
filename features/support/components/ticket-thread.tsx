"use client"

import { cn } from "cn"
import { LockIcon } from "lucide-react"

import { formatFormalTimestamp } from "@/features/support/lib/format-formal-time"
import type {
  SupportAttachment,
  SupportMessage,
  SupportMessageKind,
} from "@/features/support/schemas"

const KIND_LABELS: Partial<Record<SupportMessageKind, string>> = {
  DECISION_APPROVED: "Quyết định: Chấp thuận kháng cáo",
  DECISION_REJECTED: "Quyết định: Từ chối kháng cáo",
  RESOLVED: "Quyết định: Đã giải quyết",
  CLOSED: "Quyết định: Đóng hồ sơ",
  WITHDRAWN: "Người gửi đã rút hồ sơ",
  EXPIRED: "Hệ thống tự động đóng do quá hạn phản hồi",
  REOPENED: "Người gửi đã mở lại hồ sơ",
  REMINDER: "Nhắc nhở tự động",
}

function isDecisionKind(kind: SupportMessageKind): boolean {
  return (
    kind === "DECISION_APPROVED" ||
    kind === "DECISION_REJECTED" ||
    kind === "RESOLVED" ||
    kind === "CLOSED"
  )
}

function isSystemKind(kind: SupportMessageKind): boolean {
  return kind === "EXPIRED" || kind === "REMINDER"
}

function accentFor(message: SupportMessage): string {
  if (message.isInternal) {
    return "border-l-2 border-l-amber-500/70 bg-amber-500/5 pl-3.5"
  }
  if (message.kind === "DECISION_APPROVED" || message.kind === "RESOLVED") {
    return "border-l-2 border-l-emerald-500/70 bg-emerald-500/5 pl-3.5"
  }
  if (message.kind === "DECISION_REJECTED") {
    return "border-l-2 border-l-destructive/70 bg-destructive/5 pl-3.5"
  }
  if (message.kind === "REMINDER") {
    return "border-l-2 border-l-sky-500/70 bg-sky-500/5 pl-3.5"
  }
  if (message.kind === "CLOSED" || message.kind === "WITHDRAWN" || message.kind === "EXPIRED") {
    return "border-l-2 border-l-muted-foreground/40 bg-muted/30 pl-3.5"
  }
  return ""
}

function personLabel(message: SupportMessage, viewerRole: "USER" | "ADMIN"): string {
  const sender = message.sender
  if (!sender) return "Người gửi"
  if (viewerRole === "ADMIN") return `${sender.fullName} (@${sender.username})`
  return sender.fullName
}

function senderNameOf(message: SupportMessage, viewerRole: "USER" | "ADMIN"): string {
  if (isSystemKind(message.kind)) return "Hệ thống Vedora"
  const hiddenAdmin = viewerRole === "USER" || message.sender === null
  if (message.senderRole === "ADMIN" && hiddenAdmin) return "Ban quản trị Vedora"
  return personLabel(message, viewerRole)
}

function roleLabelOf(message: SupportMessage): string {
  if (isSystemKind(message.kind)) return "Tự động"
  if (message.senderRole === "ADMIN") return "Quản trị viên"
  return "Người gửi"
}

function kindToneOf(kind: SupportMessageKind): string {
  if (kind === "DECISION_APPROVED" || kind === "RESOLVED") {
    return "text-emerald-700 dark:text-emerald-400"
  }
  if (kind === "DECISION_REJECTED") return "text-destructive"
  if (isDecisionKind(kind)) return "text-foreground"
  return "text-muted-foreground"
}

function MessageAttachments({ attachments }: { attachments: SupportAttachment[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {attachments.map((attachment, index) => (
        <li key={attachment.id}>
          <a
            href={attachment.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block size-24 overflow-hidden rounded-sm border border-border bg-muted outline-none hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
            <img
              src={attachment.url}
              alt={`Ảnh đính kèm ${index + 1}`}
              loading="lazy"
              className="size-full object-cover"
            />
          </a>
        </li>
      ))}
    </ul>
  )
}

export function TicketThread({
  messages,
  viewerRole,
}: {
  messages: SupportMessage[]
  viewerRole: "USER" | "ADMIN"
}) {
  if (messages.length === 0) {
    return <p className="py-4 text-sm text-muted-foreground">Chưa có nội dung trao đổi nào.</p>
  }

  return (
    <ol className="divide-y divide-border border-y border-border">
      {messages.map((message, index) => {
        const entryNumber = index + 1
        const kindLabel = KIND_LABELS[message.kind]
        const senderName = senderNameOf(message, viewerRole)
        const roleLabel = roleLabelOf(message)

        return (
          <li key={message.id} className={cn("py-3.5 pr-2", accentFor(message))}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-muted-foreground tabular-nums">#{entryNumber}</span>
                <span className="font-medium text-foreground">{senderName}</span>
                <span className="text-muted-foreground">· {roleLabel}</span>
                {message.isInternal && (
                  <span className="inline-flex items-center gap-1 rounded-sm border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                    <LockIcon aria-hidden className="size-3" />
                    Ghi chú nội bộ
                  </span>
                )}
              </div>
              <time
                dateTime={message.createdAt}
                className="font-mono text-muted-foreground tabular-nums"
              >
                {formatFormalTimestamp(message.createdAt)}
              </time>
            </div>

            {kindLabel && (
              <p className={cn("mt-1.5 text-xs font-medium", kindToneOf(message.kind))}>
                {kindLabel}
              </p>
            )}

            {message.body && (
              <p className="mt-1.5 text-sm leading-6 break-words whitespace-pre-wrap text-foreground">
                {message.body}
              </p>
            )}
            {message.attachments.length > 0 && (
              <MessageAttachments attachments={message.attachments} />
            )}
          </li>
        )
      })}
    </ol>
  )
}
