"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  TriangleAlertIcon,
} from "lucide-react"

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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { NativeSelect } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { StatusBadge } from "@/features/knowledge/components/knowledge-columns"
import {
  useDeleteKnowledgeDocument,
} from "@/features/knowledge/hooks/use-knowledge-documents"
import {
  useKnowledgeDocumentDetail,
  useKnowledgeFileUrl,
  useKnowledgePages,
  useKnowledgeReviewActions,
} from "@/features/knowledge/hooks/use-knowledge-review"
import type { KnowledgeDocument, KnowledgePage } from "@/features/knowledge/schemas"

const FLAG_MESSAGES: Record<KnowledgePage["flags"][number], string> = {
  TEXT_LAYER_ADDED:
    "OCR bỏ sót chữ ở trang này nên hệ thống đã nối thêm chữ có sẵn trong PDF. Có thể bị lặp.",
  PAGE_COUNT_MISMATCH:
    "OCR trả số trang khác với PDF, chữ có thể nằm sai trang.",
}

const NOTE_MAX = 500

function hasFlags(page: KnowledgePage) {
  return page.flags.length > 0
}

/**
 * Review the OCR text of an uploaded PDF next to the original. Nothing is
 * indexed until "Duyệt"; "Từ chối" keeps the file, "Xoá" removes it.
 */
export function KnowledgeReview({ id }: { id: string }) {
  const { data: document, error: loadError } = useKnowledgeDocumentDetail(id)
  const hasFile = document !== undefined && document.status !== "WAITING_UPLOAD"
  const { data: pages } = useKnowledgePages(id, !hasFile)
  const { data: file } = useKnowledgeFileUrl(id, !hasFile)

  if (loadError) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden />
          <AlertDescription>Không tải được tài liệu. Có thể nó đã bị xoá.</AlertDescription>
        </Alert>
      </div>
    )
  }
  if (!document) {
    return (
      <div className="space-y-3 p-4" aria-hidden>
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }
  return (
    <ReviewBody
      document={document}
      pages={pages ?? []}
      pagesLoaded={pages !== undefined}
      fileUrl={file?.url ?? null}
    />
  )
}

function ReviewBody({
  document,
  pages,
  pagesLoaded,
  fileUrl,
}: {
  document: KnowledgeDocument
  pages: KnowledgePage[]
  pagesLoaded: boolean
  fileUrl: string | null
}) {
  const router = useRouter()
  const actions = useKnowledgeReviewActions(document.id)
  const deleteDocument = useDeleteKnowledgeDocument()
  const [pageNumber, setPageNumber] = useState(1)
  // Unsaved text by page number.
  const [drafts, setDrafts] = useState<ReadonlyMap<number, string>>(new Map())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<"approve" | "delete" | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState("")

  const editable = document.status === "AWAITING_REVIEW"
  const current = pages.find((page) => page.page === pageNumber) ?? pages[0]
  const flaggedCount = pages.filter(hasFlags).length
  const draftCount = drafts.size

  function editText(page: number, text: string, original: string) {
    const next = new Map(drafts)
    if (text === original) next.delete(page)
    else next.set(page, text)
    setDrafts(next)
  }

  function goToNextFlagged() {
    const flagged = pages.filter(hasFlags)
    const next = flagged.find((page) => page.page > pageNumber) ?? flagged[0]
    if (next) setPageNumber(next.page)
  }

  async function run(task: () => Promise<void>, failure: string) {
    setBusy(true)
    setError(null)
    try {
      await task()
    } catch {
      setError(failure)
    } finally {
      setBusy(false)
    }
  }

  function save() {
    return run(async () => {
      await actions.savePages(drafts)
      setDrafts(new Map())
    }, "Không lưu được chỉnh sửa. Thử lại nhé.")
  }

  function approve() {
    setConfirming(null)
    return run(() => actions.approve(null), "Không duyệt được tài liệu. Thử lại nhé.")
  }

  function reject() {
    return run(async () => {
      await actions.reject(note.trim() || null)
      setRejecting(false)
      setNote("")
    }, "Không từ chối được tài liệu. Thử lại nhé.")
  }

  function remove() {
    setConfirming(null)
    return run(async () => {
      await deleteDocument(document.id)
      router.push("/admin/knowledge")
    }, "Không xoá được tài liệu. Thử lại nhé.")
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Về danh sách tài liệu"
          render={<Link href="/admin/knowledge" />}
        >
          <ArrowLeftIcon aria-hidden />
        </Button>
        <h2 className="min-w-0 flex-1 truncate font-medium" title={document.title}>
          {document.title}
        </h2>
        <StatusBadge status={document.status} />
        {document.status === "REJECTED" && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => run(actions.reopen, "Không mở lại được tài liệu.")}>
            Mở lại để duyệt
          </Button>
        )}
        {editable && (
          <>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setRejecting(true)}>
              Từ chối
            </Button>
            <Button
              size="sm"
              disabled={busy || draftCount > 0}
              title={draftCount > 0 ? "Lưu các trang đã sửa trước khi duyệt" : undefined}
              onClick={() => setConfirming("approve")}
            >
              Duyệt và đưa vào kho
            </Button>
          </>
        )}
        <Button size="sm" variant="destructive" disabled={busy} onClick={() => setConfirming("delete")}>
          Xoá
        </Button>
      </div>

      <StatusNotice document={document} />
      {error && (
        <Alert variant="destructive" className="m-3">
          <CircleAlertIcon aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-2">
        <div className="min-h-96 overflow-hidden rounded-xl border bg-muted/30">
          {fileUrl ? (
            <iframe
              title="PDF gốc"
              src={`${fileUrl}#page=${current?.page ?? 1}`}
              className="size-full min-h-96"
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
              Chưa có tệp để xem.
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-col gap-3">
          {!pagesLoaded ? (
            <Skeleton className="h-64 w-full" />
          ) : !current ? (
            <p className="text-sm text-muted-foreground">
              Tài liệu này không có bản xem lại, vì nó được tải lên trước khi có bước duyệt.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Trang trước"
                  disabled={current.page <= 1}
                  onClick={() => setPageNumber(current.page - 1)}
                >
                  <ChevronLeftIcon aria-hidden />
                </Button>
                <NativeSelect
                  aria-label="Chọn trang"
                  value={current.page}
                  onChange={(event) => setPageNumber(Number(event.target.value))}
                >
                  {pages.map((page) => (
                    <option key={page.page} value={page.page}>
                      Trang {page.page}
                      {hasFlags(page) ? " ⚠" : ""}
                      {drafts.has(page.page) ? " •" : ""}
                    </option>
                  ))}
                </NativeSelect>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Trang sau"
                  disabled={current.page >= pages.length}
                  onClick={() => setPageNumber(current.page + 1)}
                >
                  <ChevronRightIcon aria-hidden />
                </Button>
                {flaggedCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={goToNextFlagged}>
                    <TriangleAlertIcon aria-hidden data-icon="inline-start" />
                    Trang cần xem ({flaggedCount})
                  </Button>
                )}
              </div>

              {current.flags.map((flag) => (
                <Alert key={flag}>
                  <TriangleAlertIcon aria-hidden />
                  <AlertDescription>{FLAG_MESSAGES[flag]}</AlertDescription>
                </Alert>
              ))}

              <Textarea
                aria-label={`Văn bản trang ${current.page}`}
                className="min-h-64 flex-1"
                value={drafts.get(current.page) ?? current.text}
                readOnly={!editable}
                disabled={busy}
                onChange={(event) => editText(current.page, event.target.value, current.text)}
              />

              {editable && (
                <div className="flex items-center gap-2">
                  <Button size="sm" disabled={busy || draftCount === 0} onClick={save}>
                    {busy && <Spinner aria-hidden />}
                    Lưu chỉnh sửa{draftCount > 0 ? ` (${draftCount} trang)` : ""}
                  </Button>
                  {draftCount > 0 && (
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => setDrafts(new Map())}>
                      Bỏ thay đổi
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <AlertDialog open={confirming === "approve"} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Đưa tài liệu vào kho kiến thức?</AlertDialogTitle>
            <AlertDialogDescription>
              Sau khi duyệt, văn bản này được lập chỉ mục và Trợ lý Vedora sẽ dùng để trả lời mọi người dùng.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Xem lại</AlertDialogCancel>
            <AlertDialogAction onClick={approve}>Duyệt</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirming === "delete"} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá tài liệu này?</AlertDialogTitle>
            <AlertDialogDescription>
              “{document.title}”, văn bản đã trích xuất và dữ liệu trong kho tìm kiếm sẽ bị xoá vĩnh viễn. Muốn giữ lại để xem sau, hãy chọn Từ chối.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Giữ lại</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={remove}>
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={rejecting} onOpenChange={(open) => !busy && setRejecting(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Từ chối tài liệu</DialogTitle>
            <DialogDescription>
              Tài liệu không vào kho kiến thức nhưng vẫn được giữ lại; bạn có thể mở lại để duyệt sau.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            aria-label="Ghi chú"
            placeholder="Lý do (không bắt buộc)"
            maxLength={NOTE_MAX}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <DialogFooter>
            <Button variant="ghost" disabled={busy} onClick={() => setRejecting(false)}>
              Huỷ
            </Button>
            <Button disabled={busy} onClick={reject}>
              Từ chối
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatusNotice({ document }: { document: KnowledgeDocument }) {
  const { status, failureReason, reviewNote } = document
  if (status === "INDEXING") {
    return <Notice>Đang lập chỉ mục. Trang sẽ tự cập nhật khi xong.</Notice>
  }
  if (status === "REJECTED") {
    return <Notice>Đã từ chối{reviewNote ? `: ${reviewNote}` : "."} Tài liệu không có trong kho kiến thức.</Notice>
  }
  if (status === "READY") {
    return <Notice>Tài liệu đã nằm trong kho kiến thức. Văn bản không sửa được nữa.</Notice>
  }
  if (status === "AWAITING_REVIEW" && failureReason === "INDEXING_FAILED") {
    return <Notice>Lần lập chỉ mục trước thất bại. Chỉnh sửa của bạn vẫn còn, hãy duyệt lại.</Notice>
  }
  return null
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="border-b bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{children}</p>
}
