"use client"

import { useState } from "react"
import { RefreshCwIcon } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/features/admin/components/data-table/data-table"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import { formatPostDateLong } from "@/features/shared/lib/format"
import { ADMIN_PLANS_KEY, fetchAdminPlans } from "./api"
import { EditPlanContext, planColumns } from "./plan-columns"
import { PlanEditor } from "./plan-editor"
import { planRows, type ManagedPlan } from "./schema"

const getRowId = (row: ManagedPlan) => row.code

export function SubscriptionPlansView() {
  const { data, error, isLoading, isValidating, mutate } = useAuthedSWR(ADMIN_PLANS_KEY, fetchAdminPlans, { revalidateOnFocus: true, shouldRetryOnError: false })
  const [editing, setEditing] = useState<ManagedPlan | null>(null)
  if (isLoading) return <div role="status" aria-label="Đang tải gói đăng ký" className="space-y-3 p-6"><Skeleton className="h-12" /><Skeleton className="h-60" /></div>
  if (!data) return <div className="p-6"><Alert variant="destructive"><AlertDescription>Không tải được cấu hình gói. <Button variant="outline" onClick={() => void mutate().catch(() => undefined)}>Thử lại</Button></AlertDescription></Alert></div>
  return <section aria-label="Quản lý gói đăng ký" className="flex min-h-0 flex-1 flex-col">
    {error && <Alert variant="destructive"><AlertDescription>Chưa tải được cấu hình mới. Đang hiển thị dữ liệu lần trước; hãy tải lại trước khi lưu.</AlertDescription></Alert>}
    <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-4 sm:px-6">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Gói đăng ký</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">Quản lý giá và hạn mức AI. Lượt AI chữ được dùng chung; lượt tạo ảnh được tính riêng.</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">Phiên bản {data.version}</Badge>
          <span>{data.updatedAt ? `Cập nhật ${formatPostDateLong(data.updatedAt)}` : "Đang dùng giá trị mặc định của hệ thống"}</span>
          {!data.paymentsEnabled && <Badge variant="outline">Thanh toán đang tắt</Badge>}
        </div>
      </div>
      <Button variant="outline" size="sm" disabled={isValidating} onClick={() => void mutate().catch(() => undefined)}><RefreshCwIcon aria-hidden />Tải lại</Button>
    </div>
    <div className="border-b px-4 py-3 text-sm text-muted-foreground sm:px-6">Thay đổi Plus/Pro áp dụng cho đơn mới. Đơn đã tạo QR và gói đang sử dụng giữ quyền lợi đã chốt. Free áp dụng ngay và không đặt lại lượt đã dùng.</div>
    <EditPlanContext.Provider value={setEditing}>
      <DataTable columns={planColumns} data={planRows(data)} getRowId={getRowId} searchPlaceholder="Tìm gói đăng ký" />
    </EditPlanContext.Provider>
    {editing && <PlanEditor key={editing.code} plan={editing} catalog={data} onClose={() => setEditing(null)} />}
  </section>
}
