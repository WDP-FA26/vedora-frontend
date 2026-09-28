"use client"

import { useState } from "react"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
  UNSUPPORTED_TYPE: "Loại tệp này không còn được hỗ trợ.",
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

export function KnowledgeDocumentTable({
  documents,
  onDelete,
}: {
  documents: KnowledgeDocument[]
  onDelete: (id: string) => void
}) {
  const [pendingDelete, setPendingDelete] = useState<KnowledgeDocument | null>(
    null
  )

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tài liệu</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead className="hidden sm:table-cell">Nội dung</TableHead>
            <TableHead className="hidden md:table-cell">Dung lượng</TableHead>
            <TableHead className="hidden lg:table-cell">Tải lên lúc</TableHead>
            <TableHead className="w-10">
              <span className="sr-only">Thao tác</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((document) => (
            <TableRow key={document.id}>
              <TableCell className="max-w-0 w-full">
                <div className="flex items-center gap-2">
                  <FileTextIcon
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  <span className="truncate font-medium" title={document.title}>
                    {document.title}
                  </span>
                </div>
                {document.failureReason && (
                  <p className="mt-1 pl-6 text-xs whitespace-normal text-destructive">
                    {FAILURE_MESSAGES[document.failureReason]}
                  </p>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge status={document.status} />
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <span className="text-muted-foreground tabular-nums">
                  {formatSections(document)}
                </span>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <span className="text-muted-foreground tabular-nums">
                  {formatSize(document.sizeBytes)}
                </span>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <span className="text-muted-foreground">
                  {formatPostDateLong(document.createdAt)}
                </span>
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Xoá ${document.title}`}
                  onClick={() => setPendingDelete(document)}
                >
                  <Trash2Icon aria-hidden />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá tài liệu này?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.title}” và văn bản đã trích xuất sẽ bị xoá vĩnh
              viễn. Trợ lý dinh dưỡng sẽ không dùng tài liệu này nữa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Giữ lại</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pendingDelete) onDelete(pendingDelete.id)
                setPendingDelete(null)
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
