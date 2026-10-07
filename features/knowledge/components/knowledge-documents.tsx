"use client"

import { useState } from "react"
import { useDropzone } from "react-dropzone"
import {
  CircleAlertIcon,
  CircleCheckIcon,
  FileUpIcon,
  LibraryIcon,
  LoaderIcon,
  TriangleAlertIcon,
} from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DataTable,
  type DataTableView,
} from "@/features/admin/components/data-table/data-table"
import {
  DeleteKnowledgeDocumentContext,
  knowledgeColumns,
} from "@/features/knowledge/components/knowledge-columns"
import { KnowledgeUploadList } from "@/features/knowledge/components/knowledge-upload-list"
import {
  useDeleteKnowledgeDocument,
  useKnowledgeDocuments,
} from "@/features/knowledge/hooks/use-knowledge-documents"
import { useKnowledgeUploads } from "@/features/knowledge/hooks/use-knowledge-uploads"
import {
  KNOWLEDGE_ACCEPT,
  MAX_KNOWLEDGE_FILE_MB,
  type KnowledgeDocument,
} from "@/features/knowledge/schemas"

const VIEWS: DataTableView[] = [
  { id: "all", label: "Tất cả", icon: LibraryIcon, columnFilters: [] },
  {
    id: "ready",
    label: "Sẵn sàng",
    icon: CircleCheckIcon,
    columnFilters: [{ id: "status", value: ["READY"] }],
  },
  {
    id: "pending",
    label: "Đang xử lý",
    icon: LoaderIcon,
    columnFilters: [{ id: "status", value: ["WAITING_UPLOAD", "PROCESSING"] }],
  },
  {
    id: "failed",
    label: "Lỗi",
    icon: TriangleAlertIcon,
    columnFilters: [{ id: "status", value: ["FAILED"] }],
  },
]

const getDocumentId = (document: KnowledgeDocument) => document.id

/**
 * Upload and manage the PDFs the nutrition assistant draws on. The whole page
 * is the drop target; "Tải lên" opens the file picker.
 */
export function KnowledgeDocuments() {
  const { documents, error: loadError, isLoading } = useKnowledgeDocuments()
  const { uploads, error: uploadError, add, cancel } = useKnowledgeUploads()
  const deleteDocument = useDeleteKnowledgeDocument()
  const [deleteError, setDeleteError] = useState(false)

  const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
    accept: KNOWLEDGE_ACCEPT,
    noClick: true,
    noKeyboard: true,
    // Rejected files go through too, so vedora-api explains why.
    onDrop: (accepted, rejected) =>
      add([...accepted, ...rejected.map(({ file }) => file)]),
  })

  const error = uploadError
    ?? (deleteError ? "Không xoá được tài liệu. Thử lại nhé." : null)
    ?? (loadError ? "Không tải được danh sách tài liệu." : null)

  function onDelete(id: string) {
    setDeleteError(false)
    deleteDocument(id).catch(() => setDeleteError(true))
  }

  return (
    <div {...getRootProps()} className="relative flex min-h-0 flex-1 flex-col">
      <input {...getInputProps()} />

      {(error || uploads.length > 0) && (
        <div className="space-y-3 border-b p-3">
          {error && (
            <Alert variant="destructive">
              <CircleAlertIcon aria-hidden />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {uploads.length > 0 && (
            <KnowledgeUploadList uploads={uploads} onCancel={cancel} />
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2 p-4" aria-hidden>
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <DeleteKnowledgeDocumentContext value={onDelete}>
          <DataTable
            columns={knowledgeColumns}
            data={documents}
            getRowId={getDocumentId}
            views={VIEWS}
            searchPlaceholder="Tìm theo tên tài liệu"
            emptyMessage={
              documents.length === 0
                ? `Chưa có tài liệu nào. Kéo thả PDF vào đây hoặc bấm Tải lên (tối đa ${MAX_KNOWLEDGE_FILE_MB} MB mỗi tệp).`
                : "Không có tài liệu nào khớp."
            }
            actions={
              <Button size="sm" onClick={open}>
                <FileUpIcon aria-hidden />
                Tải lên
              </Button>
            }
          />
        </DeleteKnowledgeDocumentContext>
      )}

      {isDragActive && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/85 p-6">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary px-10 py-8 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-accent text-primary">
              <FileUpIcon aria-hidden className="size-5" />
            </span>
            <p className="font-medium">Thả tệp PDF để tải lên</p>
          </div>
        </div>
      )}
    </div>
  )
}
