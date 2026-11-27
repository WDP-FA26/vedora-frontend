"use client"

import { useState } from "react"
import Link from "next/link"
import { cn } from "cn"
import { CircleAlertIcon, LifeBuoyIcon, SearchIcon } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/features/shared/lib/api-client"
import {
  TicketCategoryTag,
  TicketStatusBadge,
} from "@/features/support/components/ticket-status-badge"
import { useAdminSupportTickets } from "@/features/support/hooks/use-support"
import { formatFormalTimestamp } from "@/features/support/lib/format-formal-time"
import {
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_TICKET_CATEGORIES,
  type AdminSupportCategoryCounts,
  type AdminSupportStatusCounts,
  type AppealTriggerStatus,
  type SupportTicketCategory,
  type SupportTicketStatus,
} from "@/features/support/schemas"
import {
  adminSupportTicketPath,
  type AdminAssigneeFilter,
} from "@/features/support/support-cache"

const STATUS_TABS: readonly {
  value: SupportTicketStatus | "ALL"
  label: string
  countKey: keyof AdminSupportStatusCounts
}[] = [
  { value: "OPEN", label: "Chờ xử lý", countKey: "open" },
  { value: "WAITING_USER", label: "Chờ phản hồi", countKey: "waitingUser" },
  { value: "RESOLVED", label: "Đã giải quyết", countKey: "resolved" },
  { value: "CLOSED", label: "Đã đóng", countKey: "closed" },
  { value: "WITHDRAWN", label: "Đã rút", countKey: "withdrawn" },
  { value: "EXPIRED", label: "Hết hạn", countKey: "expired" },
  { value: "ALL", label: "Tất cả", countKey: "total" },
]

const CATEGORY_COUNT_KEYS: Record<SupportTicketCategory, keyof AdminSupportCategoryCounts> = {
  CONTENT_APPEAL: "contentAppeal",
  PAYMENT_ISSUE: "paymentIssue",
  VERIFICATION: "verification",
  GENERAL: "general",
}

const PAGE_LIMIT = 20

const ASSIGNEE_OPTIONS: readonly { value: AdminAssigneeFilter | "ALL"; label: string }[] = [
  { value: "ALL", label: "Mọi người" },
  { value: "me", label: "Của tôi" },
  { value: "unassigned", label: "Chưa nhận" },
]

function isAssigneeOption(value: string): value is AdminAssigneeFilter | "ALL" {
  return ASSIGNEE_OPTIONS.some((option) => option.value === value)
}

export function AdminSupportTable() {
  const [status, setStatus] = useState<SupportTicketStatus | "ALL">("OPEN")
  const [category, setCategory] = useState<SupportTicketCategory | "ALL">("ALL")
  const [triggerStatus, setTriggerStatus] = useState<AppealTriggerStatus | "ALL">("ALL")
  const [assignee, setAssignee] = useState<AdminAssigneeFilter | "ALL">("ALL")
  const [searchInput, setSearchInput] = useState("")
  const [query, setQuery] = useState("")
  const [pageNumber, setPageNumber] = useState(1)

  const effectiveTrigger =
    category === "ALL" || category === "CONTENT_APPEAL"
      ? triggerStatus === "ALL"
        ? undefined
        : triggerStatus
      : undefined

  const { page, error, isLoading } = useAdminSupportTickets({
    status: status === "ALL" ? undefined : status,
    category: category === "ALL" ? undefined : category,
    triggerStatus: effectiveTrigger,
    assignee: assignee === "ALL" ? undefined : assignee,
    q: query || undefined,
    page: pageNumber,
    limit: PAGE_LIMIT,
  })

  function changeStatus(next: SupportTicketStatus | "ALL") {
    setStatus(next)
    setPageNumber(1)
  }

  function changeCategory(next: SupportTicketCategory | "ALL") {
    setCategory(next)
    if (next !== "ALL" && next !== "CONTENT_APPEAL") {
      setTriggerStatus("ALL")
    }
    setPageNumber(1)
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setQuery(searchInput.trim())
    setPageNumber(1)
  }

  function clearSearch() {
    setSearchInput("")
    setQuery("")
    setPageNumber(1)
  }

  return (
    <section aria-label="Quản lý hồ sơ hỗ trợ và kháng cáo" className="min-w-0">
      <nav
        aria-label="Lọc theo trạng thái"
        className="flex items-center gap-1 overflow-x-auto border-b border-border px-4"
      >
        {STATUS_TABS.map((tab) => {
          const active = status === tab.value
          const count = page?.counts[tab.countKey]
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => changeStatus(tab.value)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors",
                active
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <span>{tab.label}</span>
              {count !== undefined && (
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  ({count})
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-2.5">
        <div role="group" aria-label="Lọc theo danh mục" className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="mr-1 text-muted-foreground">Danh mục:</span>
          <button
            type="button"
            onClick={() => changeCategory("ALL")}
            className={cn(
              "rounded-sm border px-2 py-1 transition-colors",
              category === "ALL"
                ? "border-foreground/30 bg-background font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Tất cả
          </button>
          {SUPPORT_TICKET_CATEGORIES.map((item) => {
            const active = category === item
            const count = page?.categoryCounts[CATEGORY_COUNT_KEYS[item]]
            return (
              <button
                key={item}
                type="button"
                onClick={() => changeCategory(item)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-sm border px-2 py-1 transition-colors",
                  active
                    ? "border-foreground/30 bg-background font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <span>{SUPPORT_CATEGORY_LABELS[item]}</span>
                {count !== undefined && (
                  <span className="font-mono text-muted-foreground tabular-nums">({count})</span>
                )}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-xs">
            <label htmlFor="assignee-filter" className="text-muted-foreground">
              Phụ trách:
            </label>
            <select
              id="assignee-filter"
              value={assignee}
              onChange={(event) => {
                const next = event.target.value
                if (!isAssigneeOption(next)) return
                setAssignee(next)
                setPageNumber(1)
              }}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus-visible:border-ring"
            >
              {ASSIGNEE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {(category === "ALL" || category === "CONTENT_APPEAL") && (
            <div className="flex items-center gap-1 text-xs">
              <label htmlFor="trigger-filter" className="text-muted-foreground">
                Nguồn:
              </label>
              <select
                id="trigger-filter"
                value={triggerStatus}
                onChange={(event) => {
                  setTriggerStatus(event.target.value as AppealTriggerStatus | "ALL")
                  setPageNumber(1)
                }}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus-visible:border-ring"
              >
                <option value="ALL">Tất cả</option>
                <option value="REJECTED">Bị từ chối kiểm duyệt</option>
                <option value="REMOVED">Bị quản trị viên gỡ bỏ</option>
              </select>
            </div>
          )}

          <form onSubmit={handleSearchSubmit} className="flex items-center gap-1.5">
            <div className="w-56">
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Mã hồ sơ, tiêu đề, mã tham chiếu..."
                aria-label="Tìm kiếm hồ sơ hỗ trợ"
              />
            </div>
            <Button type="submit" variant="outline" size="sm">
              <SearchIcon aria-hidden />
              Tìm
            </Button>
            {query && (
              <Button type="button" variant="ghost" size="sm" onClick={clearSearch}>
                Xoá lọc
              </Button>
            )}
          </form>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2 p-4" aria-hidden>
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="p-4">
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden />
            <AlertDescription>
              {error instanceof ApiError && error.status === 403
                ? "Tài khoản của bạn không có quyền xem danh sách hồ sơ hỗ trợ."
                : "Không tải được danh sách hồ sơ hỗ trợ. Vui lòng thử tải lại trang."}
            </AlertDescription>
          </Alert>
        </div>
      ) : !page || page.items.length === 0 ? (
        <div className="p-8">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LifeBuoyIcon aria-hidden />
              </EmptyMedia>
              <EmptyTitle>Không có hồ sơ nào</EmptyTitle>
              <EmptyDescription>
                Không có hồ sơ hỗ trợ hoặc kháng cáo nào khớp với bộ lọc hiện tại.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground">
                  <th className="py-2.5 pr-3 pl-4 font-medium">Mã hồ sơ</th>
                  <th className="px-3 py-2.5 font-medium">Người gửi</th>
                  <th className="px-3 py-2.5 font-medium">Tiêu đề &amp; Danh mục</th>
                  <th className="px-3 py-2.5 font-medium">Trạng thái</th>
                  <th className="px-3 py-2.5 font-medium">Phụ trách</th>
                  <th className="px-3 py-2.5 text-right font-medium">Lượt</th>
                  <th className="px-3 py-2.5 font-medium">Cập nhật</th>
                  <th className="py-2.5 pr-4 pl-3 text-right font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {page.items.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-muted/30">
                    <td className="py-3 pr-3 pl-4 align-top font-mono text-xs whitespace-nowrap text-foreground tabular-nums">
                      <Link
                        href={adminSupportTicketPath(ticket.id)}
                        className="underline-offset-4 hover:underline"
                      >
                        {ticket.code}
                      </Link>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="font-medium text-foreground">{ticket.author.fullName}</div>
                      <div className="text-xs text-muted-foreground">@{ticket.author.username}</div>
                    </td>
                    <td className="max-w-md px-3 py-3 align-top">
                      <Link
                        href={adminSupportTicketPath(ticket.id)}
                        className="line-clamp-2 font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {ticket.subject}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <TicketCategoryTag category={ticket.category} />
                        {ticket.appeal && (
                          <span className="text-xs text-muted-foreground">
                            {ticket.appeal.triggerStatus === "REMOVED" ? "Bị gỡ bỏ" : "Bị từ chối"}
                          </span>
                        )}
                        {ticket.referenceCode && (
                          <span className="font-mono text-xs text-muted-foreground">
                            Ref: {ticket.referenceCode}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <TicketStatusBadge
                        status={ticket.status}
                        appealOutcome={ticket.appeal?.outcome}
                      />
                    </td>
                    <td className="px-3 py-3 align-top text-xs whitespace-nowrap">
                      {ticket.assignee ? (
                        <span className="text-foreground">@{ticket.assignee.username}</span>
                      ) : (
                        <span className="text-muted-foreground">Chưa nhận</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right align-top font-mono text-xs text-muted-foreground tabular-nums">
                      {ticket.messageCount}
                    </td>
                    <td className="px-3 py-3 align-top font-mono text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                      {formatFormalTimestamp(ticket.lastMessageAt)}
                    </td>
                    <td className="py-3 pr-4 pl-3 text-right align-top whitespace-nowrap">
                      <Link
                        href={adminSupportTicketPath(ticket.id)}
                        className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                      >
                        Mở hồ sơ
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span className="tabular-nums">
              Trang {page.meta.page}/{Math.max(1, page.meta.totalPages)} · Tổng{" "}
              {page.meta.totalItems} hồ sơ
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!page.meta.hasPreviousPage}
                onClick={() => setPageNumber((value) => Math.max(1, value - 1))}
              >
                Trang trước
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!page.meta.hasNextPage}
                onClick={() => setPageNumber((value) => value + 1)}
              >
                Trang sau
              </Button>
            </div>
          </footer>
        </>
      )}
    </section>
  )
}
