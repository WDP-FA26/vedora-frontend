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
  useReviewVerificationRequest,
  useVerificationRequest,
} from "@/features/verification/hooks/use-verification-requests"
import {
  MAX_REVIEW_NOTE_LENGTH,
  rejectFormSchema,
  type AdminVerificationRequestDetail,
  type RejectFormValues,
} from "@/features/verification/schemas"

const REJECT_FORM_ID = "reject-verification-form"

function reviewErrorMessage(error: unknown) {
  return error instanceof ApiError && error.status === 409
    ? "Yêu cầu này đã được xét duyệt rồi."
    : "Không lưu được quyết định. Thử lại nhé."
}

/** A request's statement and proof images, with approve and reject for pending ones. */
export function ReviewSheet({
  requestId,
  onClose,
}: {
  requestId: string | null
  onClose: () => void
}) {
  const { request, error } = useVerificationRequest(requestId)

  return (
    <Sheet open={requestId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        {request ? (
          // Keyed so the reject form starts empty for each request.
          <ReviewBody key={request.id} request={request} onReviewed={onClose} />
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>Yêu cầu xác minh</SheetTitle>
              <SheetDescription>
                {error ? "Không tải được yêu cầu. Thử mở lại nhé." : "Đang tải…"}
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

function ReviewBody({
  request,
  onReviewed,
}: {
  request: AdminVerificationRequestDetail
  onReviewed: () => void
}) {
  const review = useReviewVerificationRequest()
  const [rejecting, setRejecting] = useState(false)
  const [approving, setApproving] = useState(false)
  const [approveError, setApproveError] = useState<string | null>(null)
  const form = useForm<RejectFormValues>({
    resolver: zodResolver(rejectFormSchema),
    defaultValues: { note: "" },
  })
  const { isSubmitting, errors } = form.formState
  const busy = approving || isSubmitting
  const { user } = request

  async function approve() {
    setApproveError(null)
    setApproving(true)
    try {
      await review(request.id, { decision: "APPROVED" })
      onReviewed()
    } catch (error) {
      setApproveError(reviewErrorMessage(error))
      setApproving(false)
    }
  }

  async function reject({ note }: RejectFormValues) {
    try {
      await review(request.id, { decision: "REJECTED", note })
      onReviewed()
    } catch (error) {
      form.setError("root", { message: reviewErrorMessage(error) })
    }
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>Yêu cầu xác minh</SheetTitle>
        <SheetDescription>
          Gửi {formatPostDateLong(request.createdAt)}
        </SheetDescription>
      </SheetHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 pb-6">
        <div className="flex items-center gap-3">
          <AuthorAvatar author={toAuthor(user)} />
          <div className="min-w-0 flex-1">
            <Link
              href={profilePath(user.id)}
              className="block truncate font-medium underline-offset-4 hover:underline"
            >
              {user.fullName}
            </Link>
            <p className="truncate text-muted-foreground">
              @{user.username} · {user.email}
            </p>
          </div>
          <VerificationStatusBadge status={request.status} />
        </div>

        <section aria-labelledby="review-statement">
          <h3 id="review-statement" className="mb-1.5 text-[0.8125rem] text-muted-foreground">
            Công việc chuyên môn
          </h3>
          <p className="leading-6 break-words whitespace-pre-line">{request.statement}</p>
        </section>

        <section aria-labelledby="review-proofs">
          <h3 id="review-proofs" className="mb-1.5 text-[0.8125rem] text-muted-foreground">
            Ảnh minh chứng ({request.proofs.length})
          </h3>
          <ul className="grid grid-cols-2 gap-2">
            {request.proofs.map((proof, index) => (
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
                    className="aspect-[4/3] w-full object-cover"
                  />
                </a>
              </li>
            ))}
          </ul>
        </section>

        {request.status !== "PENDING" && (
          <section aria-labelledby="review-result">
            <h3 id="review-result" className="mb-1.5 text-[0.8125rem] text-muted-foreground">
              Kết quả
            </h3>
            <p className="leading-6 break-words whitespace-pre-line">
              {request.status === "APPROVED" ? "Đã duyệt" : "Đã từ chối"}
              {request.reviewedAt && ` ${formatPostDateLong(request.reviewedAt)}`}
              {request.reviewNote && `: ${request.reviewNote}`}
            </p>
          </section>
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
                    placeholder="Người gửi sẽ đọc được lý do này và có thể gửi lại."
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </form>
        )}
      </div>

      {request.status === "PENDING" && (
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
              <Button
                type="submit"
                form={REJECT_FORM_ID}
                variant="destructive"
                disabled={busy}
              >
                {isSubmitting && <Spinner aria-hidden />}
                Từ chối yêu cầu
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
                Duyệt
              </Button>
            </div>
          )}
        </SheetFooter>
      )}
    </>
  )
}
