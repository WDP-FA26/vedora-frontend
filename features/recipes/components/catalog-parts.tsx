"use client"

import { createContext, use, useState, type ReactNode } from "react"
import { CircleAlertIcon, PencilIcon, Trash2Icon } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
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
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { useRefreshRecipeCatalog } from "@/features/recipes/hooks/use-recipe-catalog"
import { deleteRow } from "@/features/recipes/lib/recipes-api"
import { ApiError } from "@/features/shared/lib/api-client"

/** The skeleton and error states every catalog table shares. */
export function TableStatus({
  isLoading,
  error,
  subject,
  children,
}: {
  isLoading: boolean
  error: unknown
  /** Finishes "Không tải được …", e.g. "danh sách nguyên liệu". */
  subject: string
  children: ReactNode
}) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-4" aria-hidden>
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    )
  }
  if (error) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden />
          <AlertDescription>
            {error instanceof ApiError && error.status === 403
              ? "Tài khoản của bạn không có quyền xem mục này."
              : `Không tải được ${subject}. Thử tải lại trang nhé.`}
          </AlertDescription>
        </Alert>
      </div>
    )
  }
  return children
}

/** What a row can do, by row id; provided by the table so the columns can stay static. */
export const RowActionsContext = createContext<{
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}>({ onEdit: () => {}, onDelete: () => {} })

/** A row's name as the way into its edit form. */
export function EditButton({ id, children }: { id: string; children: ReactNode }) {
  const { onEdit } = use(RowActionsContext)
  return (
    <button
      type="button"
      className="rounded-sm text-left font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/30"
      onClick={() => onEdit(id)}
    >
      {children}
    </button>
  )
}

export function RowActions({
  id,
  name,
  deleteBlockedReason,
}: {
  id: string
  name: string
  /** Set while the row cannot be deleted; shown as the button's tooltip. */
  deleteBlockedReason?: string
}) {
  const { onEdit, onDelete } = use(RowActionsContext)
  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="action"
        size="icon-sm"
        aria-label={`Sửa ${name}`}
        onClick={() => onEdit(id)}
      >
        <PencilIcon aria-hidden />
      </Button>
      <Button
        variant="action"
        size="icon-sm"
        aria-label={`Xoá ${name}`}
        title={deleteBlockedReason}
        disabled={Boolean(deleteBlockedReason)}
        onClick={() => onDelete(id)}
      >
        <Trash2Icon aria-hidden />
      </Button>
    </div>
  )
}

/** Confirms, deletes `row` from `collection` and refreshes the catalog. */
export function DeleteRowDialog({
  collection,
  row,
  title,
  description,
  inUseMessage,
  onClose,
}: {
  collection: string
  row: { id: string } | null
  title: string
  description: string
  /** Shown when the API refuses because other records still use the row. */
  inUseMessage?: string
  onClose: () => void
}) {
  const { accessToken } = useAuth()
  const refresh = useRefreshRecipeCatalog()
  const [deleting, setDeleting] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  function close() {
    setFailure(null)
    onClose()
  }

  async function remove() {
    if (!row || !accessToken) return
    setDeleting(true)
    setFailure(null)
    try {
      await deleteRow(collection, accessToken, row.id)
      await refresh()
      close()
    } catch (error) {
      setFailure(
        error instanceof ApiError && error.status === 409 && inUseMessage
          ? inUseMessage
          : "Không xoá được. Thử lại nhé."
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog open={row !== null} onOpenChange={(open) => !open && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {failure && (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Giữ lại</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleting}
            onClick={() => void remove()}
          >
            {deleting && <Spinner aria-hidden />}
            Xoá
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Dialog frame for the catalog forms: title, the form, then cancel and save. */
export function FormDialog({
  open,
  onClose,
  title,
  description,
  formId,
  submitting,
  rootError,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  description: string
  formId: string
  submitting: boolean
  rootError?: string
  children: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          {rootError && (
            <p role="alert" className="mr-auto self-center text-sm text-destructive">
              {rootError}
            </p>
          )}
          <Button variant="outline" disabled={submitting} onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" form={formId} disabled={submitting}>
            {submitting && <Spinner aria-hidden />}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
