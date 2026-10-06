"use client"

import { createContext, use, useState } from "react"
import { createColumnHelper } from "@tanstack/react-table"
import { FileTextIcon, Trash2Icon } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { DataTableColumnHeader } from "@/features/admin/components/data-table/data-table-column-header"
import type { DataTableFeatures } from "@/features/admin/components/data-table/data-table-features"
import type { KnowledgeDocument } from "@/features/knowledge/schemas"
import { formatPostDateLong } from "@/features/shared/lib/format"

const FAILURE_MESSAGES: Record<
  NonNullable<KnowledgeDocument["failureReason"]>,
  string
> = {
  UPLOAD_EXPIRED: "Không nhận được xác nhận tải lên trước khi hết hạn.",
  INVALID_FILE: "Tệp bị hỏng hoặc không đúng định dạng.",
  ENCRYPTED: "PDF được đặt mật khẩu.",
  NO_TEXT: "Tệp không có chữ hay hình ảnh nào.",
  EXTRACTION_FAILED: "Đọc nội dung tệp thất bại hoặc bị gián đoạn.",
  INDEXING_FAILED: "Lưu vào kho tìm kiếm thất bại. Hãy xóa và tải lên lại.",
}

const sizeFormat = new Intl.NumberFormat("vi", { maximumFractionDigits: 1 })

function formatSize(bytes: number | null) {
  if (bytes === null) return "—"
  if (bytes < 1024 * 1024) return `${sizeFormat.format(bytes / 1024)} KB`
  return `${sizeFormat.format(bytes / 1024 / 1024)} MB`
}

function formatSections({
  sectionCount,
  imageCount,
  contentType,
}: KnowledgeDocument) {
  if (sectionCount === null) return "—"
  const sections = `${sectionCount} ${contentType === "application/pdf" ? "trang" : "phần"}`
  return imageCount ? `${sections} · ${imageCount} ảnh` : sections
}

const STATUS_BADGES: Record<
  KnowledgeDocument["status"],
  { label: string; variant: "default" | "secondary" | "destructive"; pending?: true }
> = {
  WAITING_UPLOAD: { label: "Đang tải lên", variant: "secondary", pending: true },
  PROCESSING: { label: "Đang trích xuất", variant: "secondary", pending: true },
  READY: { label: "Sẵn sàng", variant: "default" },
  FAILED: { label: "Lỗi", variant: "destructive" },
}

function StatusBadge({ status }: { status: KnowledgeDocument["status"] }) {
  const { label, variant, pending } = STATUS_BADGES[status]
  return (
    <Badge variant={variant}>
      {pending && <Spinner aria-hidden />}
      {label}
    </Badge>
  )
}

/** Deletes a document; provided by the page so the columns can stay static. */
export const DeleteKnowledgeDocumentContext = createContext<
  (id: string) => void
>(() => {})

function DeleteDocumentButton({ document }: { document: KnowledgeDocument }) {
  const onDelete = use(DeleteKnowledgeDocumentContext)
  const [confirming, setConfirming] = useState(false)

  return (
    <>
      <Button
        variant="action"
        size="icon-sm"
        aria-label={`Xoá ${document.title}`}
        onClick={() => setConfirming(true)}
      >
        <Trash2Icon aria-hidden />
      </Button>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá tài liệu này?</AlertDialogTitle>
            <AlertDialogDescription>
              “{document.title}” và văn bản đã trích xuất sẽ bị xoá vĩnh viễn.
              Trợ lý dinh dưỡng sẽ không dùng tài liệu này nữa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Giữ lại</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirming(false)
                onDelete(document.id)
              }}
            >
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

const helper = createColumnHelper<DataTableFeatures, KnowledgeDocument>()

export const knowledgeColumns = helper.columns([
  helper.accessor("title", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Tài liệu" />
    ),
    cell: ({ row }) => {
      const { title, failureReason } = row.original
      return (
        <div className="py-1">
          <div className="flex items-center gap-2">
            <FileTextIcon
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground"
            />
            <span className="truncate font-medium" title={title}>
              {title}
            </span>
          </div>
          {failureReason && (
            <p className="mt-1 pl-6 text-xs whitespace-normal text-destructive">
              {FAILURE_MESSAGES[failureReason]}
            </p>
          )}
        </div>
      )
    },
    sortFn: "text",
    enableHiding: false,
    meta: { label: "Tài liệu", className: "w-full max-w-0" },
  }),
  helper.accessor("status", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Trạng thái" />
    ),
    cell: ({ getValue }) => <StatusBadge status={getValue()} />,
    filterFn: (row, columnId, statuses: KnowledgeDocument["status"][]) =>
      statuses.includes(row.getValue(columnId)),
    enableGlobalFilter: false,
    meta: { label: "Trạng thái" },
  }),
  helper.accessor("sectionCount", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Nội dung" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums">{formatSections(row.original)}</span>
    ),
    sortUndefined: "last",
    enableGlobalFilter: false,
    meta: { label: "Nội dung", className: "hidden sm:table-cell" },
  }),
  helper.accessor("sizeBytes", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Dung lượng" />
    ),
    cell: ({ getValue }) => (
      <span className="tabular-nums">{formatSize(getValue())}</span>
    ),
    enableGlobalFilter: false,
    meta: { label: "Dung lượng", className: "hidden md:table-cell" },
  }),
  helper.accessor("createdAt", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Tải lên lúc" />
    ),
    cell: ({ getValue }) => formatPostDateLong(getValue()),
    // ISO timestamps order correctly as text.
    sortFn: "text",
    enableGlobalFilter: false,
    meta: { label: "Tải lên lúc", className: "hidden lg:table-cell" },
  }),
  helper.display({
    id: "actions",
    cell: ({ row }) => <DeleteDocumentButton document={row.original} />,
    meta: { className: "w-10" },
  }),
])
