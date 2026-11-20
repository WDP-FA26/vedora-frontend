"use client"

import { useState } from "react"
import Link from "next/link"
import { cn } from "cn"
import {
  BadgeCheckIcon,
  ChevronRightIcon,
  CreditCardIcon,
  LifeBuoyIcon,
  MessageCircleQuestionIcon,
  PlusIcon,
  ShieldAlertIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RelativeTime } from "@/features/shared/components/relative-time"
import { CreateSupportTicketDialog } from "@/features/support/components/create-support-ticket-dialog"
import { TicketStatusBadge } from "@/features/support/components/ticket-status-badge"
import { useMySupportTickets } from "@/features/support/hooks/use-support"
import {
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_TICKET_CATEGORIES,
  SUPPORT_TICKET_STATUSES,
  type SupportTicketCategory,
  type SupportTicketListItem,
  type SupportTicketStatus,
} from "@/features/support/schemas"
import { supportTicketPath } from "@/features/support/support-cache"

type StatusTab = SupportTicketStatus | "ALL"
type CategoryFilter = SupportTicketCategory | "ALL"

/** The API filters by one status at a time, so each tab maps to exactly one status. */
const STATUS_TABS: readonly { value: StatusTab; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "WAITING_USER", label: "Chờ bạn" },
  { value: "OPEN", label: "Đang xử lý" },
  { value: "RESOLVED", label: "Đã giải quyết" },
  { value: "CLOSED", label: "Đã đóng" },
  { value: "WITHDRAWN", label: "Đã rút" },
  { value: "EXPIRED", label: "Hết hạn" },
]

const CATEGORY_ICONS = {
  CONTENT_APPEAL: ShieldAlertIcon,
  PAYMENT_ISSUE: CreditCardIcon,
  VERIFICATION: BadgeCheckIcon,
  GENERAL: MessageCircleQuestionIcon,
} as const satisfies Record<SupportTicketCategory, unknown>

const PAGE_LIMIT = 15

function isStatusTab(value: unknown): value is StatusTab {
  return value === "ALL" || SUPPORT_TICKET_STATUSES.some((status) => status === value)
}

function isCategoryFilter(value: string): value is CategoryFilter {
  return value === "ALL" || SUPPORT_TICKET_CATEGORIES.some((category) => category === value)
}

export function MySupportView() {
  const [status, setStatus] = useState<StatusTab>("ALL")
  const [category, setCategory] = useState<CategoryFilter>("ALL")
  const [pageNumber, setPageNumber] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)

  const { page, error, isLoading } = useMySupportTickets({
    status: status === "ALL" ? undefined : status,
    category: category === "ALL" ? undefined : category,
    page: pageNumber,
    limit: PAGE_LIMIT,
  })

  function changeStatus(next: unknown) {
    if (!isStatusTab(next)) return
    setStatus(next)
    setPageNumber(1)
  }

  function changeCategory(next: string) {
    if (!isCategoryFilter(next)) return
    setCategory(next)
    setPageNumber(1)
  }

  const filtered = status !== "ALL" || category !== "ALL"

  return (
    <section aria-labelledby="my-support-title" className="min-w-0 pb-20 sm:pb-0">
      <Tabs value={status} onValueChange={changeStatus}>
        <header className="sticky top-0 z-20 border-b border-border bg-card/85 backdrop-blur-md">
          <div className="flex items-start justify-between gap-3 px-4 pt-2 sm:px-5">
            <div className="min-w-0">
              <h1 id="my-support-title" className="text-lg font-bold">
                Hỗ trợ
              </h1>
              <p className="text-sm text-muted-foreground">
                Yêu cầu hỗ trợ và kháng cáo của bạn. Chỉ bạn và đội ngũ Vedora thấy.
              </p>
            </div>
            <Button
              type="button"
              size="pill-sm"
              shape="pill"
              className="mt-1 shrink-0"
              onClick={() => setCreateOpen(true)}
            >
              <PlusIcon aria-hidden />
              Gửi yêu cầu
            </Button>
          </div>
          <div className="flex min-w-0 items-center">
            <div className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <TabsList variant="timeline" aria-label="Lọc theo trạng thái" className="min-w-max">
                {STATUS_TABS.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <div className="shrink-0 px-2">
              <NativeSelect
                size="sm"
                className="max-w-36 sm:max-w-none"
                aria-label="Lọc theo danh mục"
                value={category}
                onChange={(event) => changeCategory(event.target.value)}
              >
                <NativeSelectOption value="ALL">Mọi danh mục</NativeSelectOption>
                {SUPPORT_TICKET_CATEGORIES.map((item) => (
                  <NativeSelectOption key={item} value={item}>
                    {SUPPORT_CATEGORY_LABELS[item]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>
        </header>
      </Tabs>

      <TicketList
        isLoading={isLoading}
        failed={Boolean(error)}
        items={page?.items ?? []}
        filtered={filtered}
        onCreate={() => setCreateOpen(true)}
      />

      {page && page.meta.totalPages > 1 && (
        <footer className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-muted-foreground sm:px-5">
          <span className="tabular-nums">
            Trang {page.meta.page}/{page.meta.totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              shape="pill"
              size="sm"
              disabled={!page.meta.hasPreviousPage}
              onClick={() => setPageNumber((value) => Math.max(1, value - 1))}
            >
              Trước
            </Button>
            <Button
              type="button"
              variant="ghost"
              shape="pill"
              size="sm"
              disabled={!page.meta.hasNextPage}
              onClick={() => setPageNumber((value) => value + 1)}
            >
              Sau
            </Button>
          </div>
        </footer>
      )}

      <CreateSupportTicketDialog open={createOpen} onOpenChange={setCreateOpen} />
    </section>
  )
}

function TicketList({
  isLoading,
  failed,
  items,
  filtered,
  onCreate,
}: {
  isLoading: boolean
  failed: boolean
  items: SupportTicketListItem[]
  filtered: boolean
  onCreate: () => void
}) {
  if (isLoading) {
    return (
      <div className="flex justify-center p-6">
        <Spinner aria-label="Đang tải hồ sơ hỗ trợ" />
      </div>
    )
  }

  if (failed) {
    return (
      <p role="alert" className="p-4 text-sm text-destructive sm:px-5">
        Không tải được hồ sơ hỗ trợ. Thử tải lại trang nhé.
      </p>
    )
  }

  if (items.length === 0 && filtered) {
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">
        Không có hồ sơ nào khớp với bộ lọc này.
      </p>
    )
  }

  if (items.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LifeBuoyIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Chưa có yêu cầu hỗ trợ</EmptyTitle>
          <EmptyDescription>
            Gặp vấn đề về thanh toán, xác minh hay tài khoản? Gửi yêu cầu để đội ngũ Vedora hỗ
            trợ. Muốn kháng cáo bài bị từ chối hoặc gỡ, hãy mở bài đó và chọn Gửi kháng cáo.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button type="button" shape="pill" size="pill-sm" onClick={onCreate}>
            <PlusIcon aria-hidden />
            Gửi yêu cầu
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <ul>
      {items.map((ticket) => (
        <TicketRow key={ticket.id} ticket={ticket} />
      ))}
    </ul>
  )
}

function TicketRow({ ticket }: { ticket: SupportTicketListItem }) {
  const Icon = CATEGORY_ICONS[ticket.category]
  // The admin asked something and the ticket expires if the author stays silent.
  const needsReply = ticket.status === "WAITING_USER"

  return (
    <li className="border-b border-border">
      <Link
        href={supportTicketPath(ticket.id)}
        className={cn(
          "flex items-start gap-3 px-4 py-3 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 sm:px-5",
          needsReply && "bg-primary/5"
        )}
      >
        <span
          aria-hidden
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-primary"
        >
          <Icon className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[0.9375rem] font-semibold text-foreground">
            {ticket.subject}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
            <TicketStatusBadge
              status={ticket.status}
              appealOutcome={ticket.appeal?.outcome}
              viewer="USER"
            />
            <span>{SUPPORT_CATEGORY_LABELS[ticket.category]}</span>
            <span aria-hidden>·</span>
            <span className="font-mono text-xs">{ticket.code}</span>
            <span aria-hidden>·</span>
            <RelativeTime iso={ticket.lastMessageAt} />
          </p>
          {needsReply && (
            <p className="mt-1 text-sm font-medium text-primary">
              Vedora đã trả lời và đang chờ bạn phản hồi
            </p>
          )}
        </div>
        <ChevronRightIcon aria-hidden className="mt-2 size-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  )
}
