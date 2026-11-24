"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import { API_URL } from "@/features/auth/lib/api"
import { sendJson } from "@/features/shared/lib/api-client"
import { formatPostDateLong } from "@/features/shared/lib/format"
import { OutcomeBadge } from "./log-columns"
import { DECISION_LABELS, RESOURCE_LABELS, systemLogSchema, type SystemLog } from "./schema"

const fetchLog = ([url, token]: readonly [string, string]) =>
  sendJson(systemLogSchema, url, token, { cache: "no-store" })
export function SystemLogSheet({
  id,
  onClose,
  onActor,
}: {
  id: string | null
  onClose: () => void
  onActor: (row: SystemLog) => void
}) {
  const { data, error } = useAuthedSWR(id ? API_URL + "/admin/system-logs/" + id : null, fetchLog)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  return (
    <Sheet
      open={Boolean(id)}
      onOpenChange={(open) => {
        if (!open) {
          setCopied(false)
          setCopyError(false)
          onClose()
        }
      }}
    >
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Chi tiết nhật ký</SheetTitle>
          <SheetDescription>
            {data
              ? formatPostDateLong(data.createdAt)
              : error
                ? "Không tải được nhật ký. Thử mở lại nhé."
                : "Đang tải…"}
          </SheetDescription>
        </SheetHeader>
        {data ? (
          <>
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pb-6">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">@{data.actorUsername}</p>
                <OutcomeBadge row={data} />
              </div>
              <dl className="space-y-3 border-y py-4">
                {[
                  ["Thao tác", data.actionLabel],
                  ["Đối tượng", RESOURCE_LABELS[data.resourceType]],
                  ["ID đối tượng", data.targetId ?? "Không có"],
                  ["ID người thao tác", data.actorId],
                  [
                    "Quyết định",
                    data.decision ? (DECISION_LABELS[data.decision] ?? data.decision) : null,
                  ],
                  ["Trạng thái yêu cầu", data.targetStatus],
                  ["Quyền yêu cầu", data.targetRole],
                  ["HTTP status", String(data.httpStatus)],
                  ["Mã lỗi", data.errorCode],
                  ["Thời gian xử lý", data.durationMs + " ms"],
                  ["Mã tra cứu", data.requestId],
                  ["API", data.action],
                ]
                  .filter(([, value]) => value !== null)
                  .map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="mt-1 break-words">{value}</dd>
                    </div>
                  ))}
              </dl>
              <p className="text-sm text-muted-foreground">
                Nhật ký ghi kết quả yêu cầu quản trị. Các tác vụ xử lý nền có thể tiếp tục sau khi
                yêu cầu được tiếp nhận.
              </p>
              {copyError && (
                <p role="alert" className="text-sm text-destructive">
                  Không sao chép được. Bạn có thể chọn mã tra cứu bên trên.
                </p>
              )}
            </div>
            <SheetFooter>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(data.requestId)
                      setCopied(true)
                      setCopyError(false)
                    } catch {
                      setCopyError(true)
                    }
                  }}
                >
                  {copied ? "Đã sao chép" : "Sao chép mã tra cứu"}
                </Button>
                <Button variant="action" size="sm" onClick={() => onActor(data)}>
                  Lọc người thao tác này
                </Button>
              </div>
            </SheetFooter>
          </>
        ) : !error ? (
          <div className="space-y-3 px-6">
            <Skeleton className="h-10" />
            <Skeleton className="h-40" />
          </div>
        ) : (
          <p role="alert" className="px-6 text-sm text-destructive">
            Không tìm thấy hoặc không có quyền xem nhật ký này.
          </p>
        )}
      </SheetContent>
    </Sheet>
  )
}
