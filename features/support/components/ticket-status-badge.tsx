"use client"

import { cn } from "cn"

import {
  APPEAL_OUTCOME_LABELS,
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_STATUS_LABELS,
  type AppealOutcome,
  type SupportTicketCategory,
  type SupportTicketStatus,
} from "@/features/support/schemas"

const STATUS_TONES: Record<SupportTicketStatus, string> = {
  OPEN: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  WAITING_USER: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  RESOLVED: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  CLOSED: "border-border bg-muted/60 text-muted-foreground",
  WITHDRAWN: "border-border bg-muted/60 text-muted-foreground",
  EXPIRED: "border-border bg-muted/60 text-muted-foreground",
}

const OUTCOME_TONES: Record<AppealOutcome, string> = {
  APPROVED: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  REJECTED: "border-destructive/40 bg-destructive/10 text-destructive",
}

function describeStatus(
  status: SupportTicketStatus,
  appealOutcome: AppealOutcome | null,
  viewer: "USER" | "ADMIN"
): { label: string; tone: string } {
  if (status === "RESOLVED" && appealOutcome) {
    return { label: APPEAL_OUTCOME_LABELS[appealOutcome], tone: OUTCOME_TONES[appealOutcome] }
  }
  if (status === "WAITING_USER" && viewer === "USER") {
    return { label: "Chờ bạn phản hồi", tone: STATUS_TONES.WAITING_USER }
  }
  return { label: SUPPORT_STATUS_LABELS[status], tone: STATUS_TONES[status] }
}

export function TicketStatusBadge({
  status,
  appealOutcome,
  viewer = "ADMIN",
}: {
  status: SupportTicketStatus
  appealOutcome?: AppealOutcome | null
  viewer?: "USER" | "ADMIN"
}) {
  const { label, tone } = describeStatus(status, appealOutcome ?? null, viewer)

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        tone
      )}
    >
      {label}
    </span>
  )
}

export function TicketCategoryTag({ category }: { category: SupportTicketCategory }) {
  return (
    <span className="inline-flex items-center rounded-sm border border-border bg-muted/40 px-2 py-0.5 text-xs whitespace-nowrap text-muted-foreground">
      {SUPPORT_CATEGORY_LABELS[category]}
    </span>
  )
}
