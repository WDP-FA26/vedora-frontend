"use client"

import { useId, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { CircleCheckIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { reportComment, reportPost } from "@/features/posts/lib/posts-api"
import {
  MAX_REPORT_DETAILS_LENGTH,
  REPORT_REASON_LABELS,
  REPORT_REASONS,
  reportFormSchema,
  type ReportFormValues,
} from "@/features/posts/schemas"
import { ApiError } from "@/features/shared/lib/api-client"

/** Sends a post or comment to the admins' moderation queue with a reason. */
export function ReportDialog({
  postId,
  commentId,
  authorName,
  open,
  onOpenChange,
}: {
  postId: string
  commentId?: string
  authorName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { accessToken } = useAuth()
  const formId = useId()
  const [sent, setSent] = useState(false)
  const subject = commentId ? "bình luận" : "bài viết"
  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: { reason: undefined, details: "" },
  })
  const { isSubmitting, errors } = form.formState

  async function onSubmit({ reason, details }: ReportFormValues) {
    if (!accessToken) {
      form.setError("root", { message: "Vui lòng đăng nhập để gửi báo cáo." })
      return
    }
    try {
      const input = { reason, details: details || undefined }
      if (commentId) await reportComment(accessToken, postId, commentId, input)
      else await reportPost(accessToken, postId, input)
      setSent(true)
    } catch (error) {
      // Already in the queue, which is what the reporter wanted.
      if (error instanceof ApiError && error.code === "ALREADY_REPORTED") {
        setSent(true)
        return
      }
      form.setError("root", {
        message:
          error instanceof ApiError && error.status === 404
            ? "Bình luận hoặc bài viết không còn khả dụng."
            : "Không gửi được báo cáo. Thử lại nhé.",
      })
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isSubmitting) return
        onOpenChange(next)
        if (!next) {
          form.reset()
          setSent(false)
        }
      }}
    >
      <DialogContent>
        {sent ? (
          <>
            <DialogHeader>
              <CircleCheckIcon aria-hidden className="mb-1 size-8 text-primary" />
              <DialogTitle>Đã gửi báo cáo</DialogTitle>
              <DialogDescription>
                Cảm ơn bạn. Đội ngũ Vedora sẽ xem {subject} này và xử lý nếu vi phạm.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                onClick={() => {
                  form.reset()
                  setSent(false)
                  onOpenChange(false)
                }}
              >
                Xong
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Báo cáo {subject}</DialogTitle>
              <DialogDescription>
                {authorName} sẽ không biết ai đã báo cáo {subject} này.
              </DialogDescription>
            </DialogHeader>

            <form
              id={formId}
              noValidate
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-5"
            >
              <Controller
                name="reason"
                control={form.control}
                render={({ field, fieldState }) => (
                  <FieldSet data-invalid={fieldState.invalid}>
                    <FieldLegend variant="label">
                      {commentId ? "Bình luận" : "Bài viết"} này có vấn đề gì?
                    </FieldLegend>
                    <RadioGroup
                      name={field.name}
                      value={field.value ?? null}
                      onValueChange={field.onChange}
                      aria-invalid={fieldState.invalid}
                    >
                      {REPORT_REASONS.map((reason) => (
                        <Field key={reason} orientation="horizontal">
                          <RadioGroupItem id={`${formId}-${reason}`} value={reason} />
                          <FieldContent>
                            <FieldLabel htmlFor={`${formId}-${reason}`}>
                              {REPORT_REASON_LABELS[reason]}
                            </FieldLabel>
                          </FieldContent>
                        </Field>
                      ))}
                    </RadioGroup>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </FieldSet>
                )}
              />

              <Controller
                name="details"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={`${formId}-details`}>Chi tiết (không bắt buộc)</FieldLabel>
                    <Textarea
                      {...field}
                      id={`${formId}-details`}
                      rows={3}
                      maxLength={MAX_REPORT_DETAILS_LENGTH}
                      aria-invalid={fieldState.invalid}
                      placeholder={`Điều gì trong ${subject} khiến bạn báo cáo?`}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            </form>

            <DialogFooter>
              {errors.root && (
                <p role="alert" className="mr-auto self-center text-sm text-destructive">
                  {errors.root.message}
                </p>
              )}
              <Button variant="outline" disabled={isSubmitting} onClick={() => onOpenChange(false)}>
                Huỷ
              </Button>
              <Button type="submit" form={formId} variant="destructive" disabled={isSubmitting}>
                {isSubmitting && <Spinner aria-hidden />}
                Gửi báo cáo
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
