"use client"

import { useEffect, useState } from "react"
import { CircleAlertIcon, RefreshCwIcon } from "lucide-react"
import type { PaginationState } from "@tanstack/react-table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { DataTable } from "@/features/admin/components/data-table/data-table"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import { API_URL } from "@/features/auth/lib/api"
import { ApiError, sendJson } from "@/features/shared/lib/api-client"
import { vietnamDayBoundary } from "@/features/shared/lib/date-time"
import { SystemLogActions, logColumns } from "./log-columns"
import { SystemLogSheet } from "./log-sheet"
import { RESOURCE_LABELS, systemLogPageSchema, type SystemLog } from "./schema"

const fetchLogs = ([url, token]: readonly [string, string]) =>
  sendJson(systemLogPageSchema, url, token, { cache: "no-store" })
const NO_LOGS: SystemLog[] = []
const getRowId = (row: SystemLog) => row.id

export function SystemLogsView() {
  const [search, setSearch] = useState("")
  const [q, setQ] = useState("")
  const [outcome, setOutcome] = useState("")
  const [resourceType, setResourceType] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [actor, setActor] = useState<{ id: string; username: string } | null>(null)
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 })
  const [openId, setOpenId] = useState<string | null>(null)
  const firstPage = () => setPagination((state) => ({ ...state, pageIndex: 0 }))
  useEffect(() => {
    if (search.trim() === q) return
    const timer = setTimeout(() => {
      setQ(search.trim())
      setPagination((state) => ({ ...state, pageIndex: 0 }))
    }, 300)
    return () => clearTimeout(timer)
  }, [search, q])
  const invalidRange = Boolean(from && to && from > to)
  const params = new URLSearchParams({
    page: String(pagination.pageIndex + 1),
    limit: String(pagination.pageSize),
  })
  if (q) params.set("q", q)
  if (outcome) params.set("outcome", outcome)
  if (resourceType) params.set("resourceType", resourceType)
  if (actor) params.set("actorId", actor.id)
  if (from) params.set("from", vietnamDayBoundary(from, "start"))
  if (to) params.set("to", vietnamDayBoundary(to, "end"))
  const { data, error, isLoading, isValidating, mutate } = useAuthedSWR(
    invalidRange ? null : API_URL + "/admin/system-logs?" + params.toString(),
    fetchLogs,
    { keepPreviousData: true }
  )
  return (
    <section aria-label="Nhật ký hệ thống" className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-end gap-3 border-b px-4 py-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Kết quả
          <NativeSelect
            aria-label="Lọc kết quả"
            value={outcome}
            onChange={(event) => {
              setOutcome(event.target.value)
              firstPage()
            }}
          >
            <NativeSelectOption value="">Tất cả kết quả</NativeSelectOption>
            <NativeSelectOption value="SUCCESS">Thành công</NativeSelectOption>
            <NativeSelectOption value="FAILURE">Thất bại</NativeSelectOption>
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Đối tượng
          <NativeSelect
            aria-label="Lọc đối tượng"
            value={resourceType}
            onChange={(event) => {
              setResourceType(event.target.value)
              firstPage()
            }}
          >
            <NativeSelectOption value="">Tất cả đối tượng</NativeSelectOption>
            {Object.entries(RESOURCE_LABELS).map(([key, label]) => (
              <NativeSelectOption key={key} value={key}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Từ ngày
          <Input
            aria-label="Từ ngày"
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value)
              firstPage()
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Đến ngày
          <Input
            aria-label="Đến ngày"
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value)
              firstPage()
            }}
          />
        </label>
        <Button
          variant="action"
          size="sm"
          onClick={() => {
            setSearch("")
            setQ("")
            setOutcome("")
            setResourceType("")
            setFrom("")
            setTo("")
            setActor(null)
            firstPage()
          }}
        >
          Xóa bộ lọc
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void mutate()}
          disabled={isValidating || invalidRange}
        >
          <RefreshCwIcon aria-hidden />
          Làm mới
        </Button>
        {actor && <p className="text-sm">Đang lọc người thao tác: @{actor.username}</p>}
      </div>
      <p className="border-b px-4 py-2 text-xs text-muted-foreground">
        Lịch sử thao tác quản trị từ khi triển khai tính năng. Nhật ký chỉ cho phép xem.
      </p>
      {invalidRange ? (
        <p role="alert" className="p-4 text-sm text-destructive">
          Từ ngày phải trước hoặc bằng đến ngày.
        </p>
      ) : error ? (
        <div className="p-4">
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden />
            <AlertDescription>
              {error instanceof ApiError && error.status === 403
                ? "Bạn không có quyền xem nhật ký hệ thống."
                : "Không tải được nhật ký hệ thống."}
              <Button variant="outline" size="sm" onClick={() => void mutate()}>
                Thử lại
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      ) : isLoading && !data ? (
        <div className="space-y-2 p-4" aria-label="Đang tải nhật ký">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col" aria-busy={isValidating}>
          <SystemLogActions value={{ open: setOpenId }}>
            <DataTable
              columns={logColumns}
              data={data?.items ?? NO_LOGS}
              getRowId={getRowId}
              searchPlaceholder="Tìm thao tác, người dùng hoặc mã tra cứu"
              search={{ value: search, onChange: (value) => setSearch(value.slice(0, 100)) }}
              pagination={{
                state: pagination,
                onChange: setPagination,
                rowCount: data?.meta.totalItems ?? 0,
                pageSizes: [10, 20, 50],
                isPending: isValidating,
              }}
              actions={isValidating ? <Spinner aria-label="Đang cập nhật nhật ký" /> : undefined}
              emptyMessage="Không có nhật ký phù hợp."
            />
          </SystemLogActions>
        </div>
      )}
      <SystemLogSheet
        id={openId}
        onClose={() => setOpenId(null)}
        onActor={(row) => {
          setActor({ id: row.actorId, username: row.actorUsername })
          firstPage()
          setOpenId(null)
        }}
      />
    </section>
  )
}
