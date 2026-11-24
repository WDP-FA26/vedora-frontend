"use client"

import Link from "next/link"
import {
  BadgeCheckIcon,
  BookOpenIcon,
  CheckCheckIcon,
  FlagIcon,
  LifeBuoyIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  StoreIcon,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { DataTable } from "@/features/admin/components/data-table/data-table"
import { formatPostDateLong } from "@/features/shared/lib/format"
import { WORK_KINDS, type WorkItem, type WorkKind } from "./schema"
import { useAdminWorkQueue } from "./work-queue-provider"
import { WORK_LABELS, WORK_PATHS } from "./work-links"
import { workColumns } from "./work-columns"

const ICONS = {
  POST_REVIEW: ShieldAlertIcon,
  POST_REPORTS: FlagIcon,
  COMMENT_REPORTS: FlagIcon,
  VERIFICATION: BadgeCheckIcon,
  WORKSPACES: StoreIcon,
  SUPPORT: LifeBuoyIcon,
  KNOWLEDGE: BookOpenIcon,
}
const DESCRIPTIONS: Record<WorkKind, string> = {
  POST_REVIEW: "Bài viết và blog đang đợi quyết định duyệt.",
  POST_REPORTS: "Số bài có báo cáo đang chờ, mỗi bài tính một lần.",
  COMMENT_REPORTS: "Số bình luận có báo cáo đang chờ xử lý.",
  VERIFICATION: "Hồ sơ chuyên gia chưa được duyệt hoặc từ chối.",
  WORKSPACES: "Đơn tạo trang nhà hàng đang chờ phê duyệt.",
  SUPPORT: "Hồ sơ đang chờ admin phản hồi hoặc giải quyết.",
  KNOWLEDGE: "Tài liệu đã xử lý xong và đang đợi admin duyệt.",
}
const getRowId = (row: WorkItem) => row.kind + ":" + row.id

export function AdminOverviewView() {
  const { data, error, isLoading, isValidating, refresh } = useAdminWorkQueue()
  return (
    <section aria-label="Tổng quan công việc quản trị" className="flex min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4 sm:p-6">
        <div>
          <h2 className="text-xl font-semibold">Việc cần xử lý</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Các hàng đợi đang cần quản trị viên xem xét.
          </p>
          {data && !error && (
            <p className="mt-1 text-xs text-muted-foreground">
              Cập nhật {formatPostDateLong(data.generatedAt)}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" disabled={isValidating} onClick={() => void refresh()}>
          {isValidating ? <Spinner aria-hidden /> : <RefreshCwIcon aria-hidden />} Làm mới
        </Button>
      </div>
      {error ? (
        <div className="p-4">
          <Alert variant="destructive">
            <AlertDescription>
              Không tải được số việc cần xử lý. Các số đếm chưa xác định.
              <Button variant="outline" size="sm" onClick={() => void refresh()}>
                Thử lại
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      ) : isLoading || !data ? (
        <div
          className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3"
          aria-label="Đang tải tổng quan"
        >
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 p-4 sm:grid-cols-3 sm:p-6">
            {[
              ["Tổng việc đang chờ", data.badges.total],
              ["Danh mục cần xử lý", Object.values(data.counts).filter((n) => n > 0).length],
              ["Hồ sơ đang giao cho bạn", data.support.assignedToMe],
            ].map(([label, value]) => (
              <Card key={label} size="sm">
                <CardHeader>
                  <CardDescription>{label}</CardDescription>
                  <CardTitle>
                    <span className="text-3xl tabular-nums">{value}</span>
                  </CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
          {data.badges.total === 0 && (
            <div className="mx-4 mb-4 flex items-center gap-2 text-sm text-muted-foreground sm:mx-6">
              <CheckCheckIcon aria-hidden className="size-4" />
              Không còn việc đang chờ xử lý.
            </div>
          )}
          <div
            className="grid gap-4 px-4 pb-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-3"
            aria-label="Danh mục xử lý"
          >
            {WORK_KINDS.map((kind) => {
              const Icon = ICONS[kind],
                count = data.counts[kind]
              return (
                <Card key={kind} size="sm">
                  <CardHeader>
                    <CardTitle>
                      <span className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <Icon aria-hidden className="size-4" />
                          {WORK_LABELS[kind]}
                        </span>
                        <Badge variant={count ? "secondary" : "outline"}>{count}</Badge>
                      </span>
                    </CardTitle>
                    <CardDescription>
                      {DESCRIPTIONS[kind]}
                      {kind === "SUPPORT" && ` Trong đó ${data.support.appeals} kháng cáo.`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Link
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                      href={WORK_PATHS[kind]}
                      aria-label={`Mở hàng đợi ${WORK_LABELS[kind]}`}
                    >
                      Mở hàng đợi
                    </Link>
                  </CardContent>
                </Card>
              )
            })}
          </div>
          <p className="px-4 pb-4 text-xs text-muted-foreground sm:px-6">
            Tổng việc tính mỗi bài/bình luận một lần. Bài vừa chờ duyệt vừa bị báo cáo không bị cộng
            trùng. Hồ sơ chờ người dùng phản hồi không tính vào việc chờ admin.
          </p>
          <div className="border-t px-4 py-3 sm:px-6">
            <h3 className="font-medium">Việc đang chờ</h3>
            <p className="text-xs text-muted-foreground">
              Xem trước tối đa {data.previewLimit} việc cũ nhất. Mở danh mục để xem toàn bộ hàng
              đợi.
            </p>
          </div>
          <DataTable
            columns={workColumns}
            data={data.items}
            getRowId={getRowId}
            searchPlaceholder="Tìm trong danh sách xem trước"
            emptyMessage="Không có việc đang chờ."
          />
        </>
      )}
    </section>
  )
}
