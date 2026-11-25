"use client"

import { useState } from "react"
import Link from "next/link"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { CheckIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toAuthor } from "@/features/auth/lib/to-author"
import { profilePath } from "@/features/profiles/profiles-cache"
import { AuthorAvatar } from "@/features/shared/components/author-avatar"
import { ApiError } from "@/features/shared/lib/api-client"
import { formatPostDateLong } from "@/features/shared/lib/format"
import { VerificationStatusBadge } from "@/features/verification/components/admin/request-columns"
import {
  rejectFormSchema,
  type RejectFormValues,
} from "@/features/verification/schemas"
import { RestaurantLocationMap } from "@/features/workspaces/components/map"
import {
  useAdminWorkspace,
  useReviewWorkspace,
} from "@/features/workspaces/hooks/use-admin-workspaces"
import { MAPBOX_TOKEN } from "@/features/workspaces/lib/mapbox"
import {
  MAX_REVIEW_NOTE_LENGTH,
  type AdminWorkspaceDetail,
} from "@/features/workspaces/schemas"

const REJECT_FORM_ID = "reject-workspace-form"

function reviewErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.code === "USERNAME_TAKEN") {
    return "Tên đăng nhập của trang đã bị tài khoản khác dùng. Hãy từ chối kèm ghi chú để chủ trang chọn tên khác."
  }
  if (error instanceof ApiError && error.status === 409) return "Đơn này đã được xét duyệt rồi."
  return "Không lưu được quyết định. Thử lại nhé."
}

/** An application's details, map pin and proof images, with approve and reject for pending ones. */
export function WorkspaceReviewSheet({
  workspaceId,
  onClose,
}: {
  workspaceId: string | null
  onClose: () => void
}) {
  const { workspace, error } = useAdminWorkspace(workspaceId)

  return (
    <Sheet open={workspaceId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        {workspace ? (
          // Keyed so the reject form starts empty for each application.
          <ReviewBody key={workspace.id} workspace={workspace} onReviewed={onClose} />
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>Đơn mở trang nhà hàng</SheetTitle>
              <SheetDescription>
                {error ? "Không tải được đơn. Thử mở lại nhé." : "Đang tải…"}
              </SheetDescription>
            </SheetHeader>
            {!error && (
              <div className="space-y-3 px-6" aria-hidden>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[0.8125rem] text-muted-foreground">{label}</dt>
      <dd className="leading-6 break-words whitespace-pre-line">{children}</dd>
    </div>
  )
}

function ReviewBody({
  workspace,
  onReviewed,
}: {
  workspace: AdminWorkspaceDetail
  onReviewed: () => void
}) {
  const review = useReviewWorkspace()
  const [rejecting, setRejecting] = useState(false)
  const [approving, setApproving] = useState(false)
  const [approveError, setApproveError] = useState<string | null>(null)
  const form = useForm<RejectFormValues>({
    resolver: zodResolver(rejectFormSchema),
    defaultValues: { note: "" },
  })
  const { isSubmitting, errors } = form.formState
  const busy = approving || isSubmitting
  const { owner } = workspace

  async function approve() {
    setApproveError(null)
    setApproving(true)
    try {
      await review(workspace.id, { decision: "APPROVED" })
      onReviewed()
    } catch (error) {
      setApproveError(reviewErrorMessage(error))
      setApproving(false)
    }
  }

  async function reject({ note }: RejectFormValues) {
    try {
      await review(workspace.id, { decision: "REJECTED", note })
      onReviewed()
    } catch (error) {
      form.setError("root", { message: reviewErrorMessage(error) })
    }
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{workspace.name}</SheetTitle>
        <SheetDescription>
          @{workspace.username} · gửi {formatPostDateLong(workspace.createdAt)}
        </SheetDescription>
      </SheetHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 pb-6">
        <div className="flex items-center gap-3">
          {owner ? (
            <>
              <AuthorAvatar author={toAuthor(owner)} />
              <div className="min-w-0 flex-1">
                <Link
                  href={profilePath(owner.id)}
                  className="block truncate font-medium underline-offset-4 hover:underline"
                >
                  {owner.fullName}
                </Link>
                <p className="truncate text-muted-foreground">
                  @{owner.username} · {owner.email}
                </p>
              </div>
            </>
          ) : (
            <p className="flex-1 text-muted-foreground">Tài khoản chủ trang đã bị xóa.</p>
          )}
          <VerificationStatusBadge status={workspace.status} />
        </div>

        <dl className="flex flex-col gap-3">
          <Detail label="Người gửi nói">{workspace.statement}</Detail>
          {workspace.bio && <Detail label="Giới thiệu">{workspace.bio}</Detail>}
          <Detail label="Địa chỉ">{workspace.address}</Detail>
          {workspace.phone && <Detail label="Số điện thoại">{workspace.phone}</Detail>}
          {workspace.website && <Detail label="Website">{workspace.website}</Detail>}
        </dl>

        {MAPBOX_TOKEN && (
          <div className="h-48 shrink-0 overflow-hidden rounded-xl border border-border">
            <RestaurantLocationMap
              point={{ longitude: workspace.longitude, latitude: workspace.latitude }}
            />
          </div>
        )}

        <section aria-labelledby="workspace-proofs">
          <h3 id="workspace-proofs" className="mb-1.5 text-[0.8125rem] text-muted-foreground">
            Ảnh minh chứng ({workspace.proofs.length})
          </h3>
          <ul className="grid grid-cols-2 gap-2">
            {workspace.proofs.map((proof, index) => (
              <li key={proof.id}>
                <a
                  href={proof.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                  <img
                    src={proof.url}
                    alt={`Ảnh minh chứng ${index + 1}, mở cỡ đầy đủ ở thẻ mới`}
                    referrerPolicy="no-referrer"
                    className="aspect-[4/3] w-full object-cover"
                  />
                </a>
              </li>
            ))}
          </ul>
        </section>

        {workspace.status !== "PENDING" && (
          <Detail label="Kết quả">
            {workspace.status === "APPROVED" ? "Đã duyệt" : "Đã từ chối"}
            {workspace.reviewedAt && ` ${formatPostDateLong(workspace.reviewedAt)}`}
            {workspace.reviewNote && `: ${workspace.reviewNote}`}
          </Detail>
        )}

        {rejecting && (
          <form id={REJECT_FORM_ID} noValidate onSubmit={form.handleSubmit(reject)}>
            <Controller
              name="note"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Lý do từ chối</FieldLabel>
                  <Textarea
                    {...field}
                    id={field.name}
                    rows={3}
                    autoFocus
                    maxLength={MAX_REVIEW_NOTE_LENGTH}
                    aria-invalid={fieldState.invalid}
                    placeholder="Chủ trang sẽ đọc được lý do này và có thể gửi lại."
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </form>
        )}
      </div>

      {workspace.status === "PENDING" && (
        <SheetFooter>
          {(approveError || errors.root) && (
            <p role="alert" className="text-sm text-destructive">
              {approveError ?? errors.root?.message}
            </p>
          )}
          {rejecting ? (
            <div className="flex justify-end gap-2">
              <Button variant="outline" disabled={busy} onClick={() => setRejecting(false)}>
                Quay lại
              </Button>
              <Button type="submit" form={REJECT_FORM_ID} variant="destructive" disabled={busy}>
                {isSubmitting && <Spinner aria-hidden />}
                Từ chối đơn
              </Button>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <Button variant="outline" disabled={busy} onClick={() => setRejecting(true)}>
                <XIcon aria-hidden />
                Từ chối
              </Button>
              <Button disabled={busy} onClick={() => void approve()}>
                {approving ? <Spinner aria-hidden /> : <CheckIcon aria-hidden />}
                Duyệt và tạo trang
              </Button>
            </div>
          )}
        </SheetFooter>
      )}
    </>
  )
}
