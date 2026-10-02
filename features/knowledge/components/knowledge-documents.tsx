"use client"

import { useState } from "react"
import { CircleAlertIcon, LibraryIcon } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { KnowledgeDocumentTable } from "@/features/knowledge/components/knowledge-document-table"
import { KnowledgeUploadZone } from "@/features/knowledge/components/knowledge-upload-zone"
import {
  useDeleteKnowledgeDocument,
  useKnowledgeDocuments,
} from "@/features/knowledge/hooks/use-knowledge-documents"
import { useKnowledgeUploads } from "@/features/knowledge/hooks/use-knowledge-uploads"

/** Upload and manage the PDFs the nutrition assistant draws on. */
export function KnowledgeDocuments() {
  const { documents, error: loadError, isLoading } = useKnowledgeDocuments()
  const { uploads, error: uploadError, add, cancel } = useKnowledgeUploads()
  const deleteDocument = useDeleteKnowledgeDocument()
  const [deleteError, setDeleteError] = useState(false)

  const error = uploadError
    ?? (deleteError ? "Không xoá được tài liệu. Thử lại nhé." : null)
    ?? (loadError ? "Không tải được danh sách tài liệu." : null)

  return (
    <div className="space-y-6">
      <KnowledgeUploadZone uploads={uploads} onFiles={add} onCancel={cancel} />

      {error && (
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="space-y-2" aria-hidden>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : documents.length === 0 ? (
        !loadError && (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LibraryIcon aria-hidden />
              </EmptyMedia>
              <EmptyTitle>Chưa có tài liệu nào</EmptyTitle>
              <EmptyDescription>
                Tài liệu tải lên sẽ hiện ở đây cùng trạng thái trích xuất.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )
      ) : (
        <KnowledgeDocumentTable
          documents={documents}
          onDelete={(id) => {
            setDeleteError(false)
            deleteDocument(id).catch(() => setDeleteError(true))
          }}
        />
      )}
    </div>
  )
}
