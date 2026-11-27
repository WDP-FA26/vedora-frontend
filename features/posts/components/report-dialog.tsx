"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { CircleCheckIcon, InfoIcon } from "lucide-react"

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
import { reportComment, reportPost, uploadPostReportEvidence } from "@/features/posts/lib/posts-api"
import {
  TicketImagePicker,
  releasePickedImages,
  type PickedImage,
} from "@/features/support/components/ticket-image-picker"
import {
  MAX_REPORT_DETAILS_LENGTH,
  REPORT_REASON_LABELS,
  REPORT_REASONS,
  reportFormSchema,
  type ReportFormValues,
} from "@/features/posts/schemas"
import { ApiError } from "@/features/shared/lib/api-client"

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
  const [result, setResult] = useState<"SENT" | "ALREADY_REPORTED" | null>(null)
  const [images, setImages] = useState<PickedImage[]>([])
  const imageRef = useRef(images)
  const uploaded = useRef(new Map<File, string>())
  useEffect(() => {
    imageRef.current = images
  }, [images])
  useEffect(() => () => releasePickedImages(imageRef.current), [])
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
      else {
        const evidenceIds: string[] = []
        for (const image of images) {
          let id = uploaded.current.get(image.file)
          if (!id) {
            id = (await uploadPostReportEvidence(accessToken, postId, image.file)).id
            uploaded.current.set(image.file, id)
          }
          evidenceIds.push(id)
        }
        await reportPost(accessToken, postId, {
          ...input,
          ...(evidenceIds.length ? { evidenceIds } : {}),
        })
      }
      setResult("SENT")
    } catch (error) {
      if (error instanceof ApiError && error.code === "ALREADY_REPORTED") {
        setResult("ALREADY_REPORTED")
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

  function changeOpen(next: boolean) {
    if (isSubmitting) return
    if (!next) {
      form.reset()
      setResult(null)
      releasePickedImages(images)
      setImages([])
      uploaded.current.clear()
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent>
        {result ? (
          <>
            <DialogHeader>
              {result === "SENT"
                ? <CircleCheckIcon aria-hidden className="mb-1 size-8 text-primary" />
                : <InfoIcon aria-hidden className="mb-1 size-8 text-muted-foreground" />}
              <DialogTitle>{result === "SENT" ? "Đã gửi báo cáo" : `Bạn đã báo cáo ${subject} này rồi`}</DialogTitle>
              <DialogDescription>
                {result === "SENT"
                  ? `Cảm ơn bạn. Đội ngũ Vedora sẽ xem ${subject} này và xử lý nếu vi phạm.`
                  : `Mỗi tài khoản chỉ được báo cáo một ${subject} một lần. Báo cáo trước của bạn vẫn được lưu; không có báo cáo mới được tạo.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                onClick={() => {
                  changeOpen(false)
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
                {` Mỗi tài khoản chỉ được báo cáo một ${subject} một lần.`}
              </DialogDescription>
            </DialogHeader>

            <form
              id={formId}
              noValidate
              onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
              className="flex max-h-[60dvh] flex-col gap-5 overflow-y-auto"
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
              {!commentId && (
                <Field>
                  <FieldLabel>Ảnh minh chứng (không bắt buộc)</FieldLabel>
                  <TicketImagePicker
                    images={images}
                    onChange={setImages}
                    disabled={isSubmitting}
                    maxImages={3}
                    maxMb={5}
                  />
                  <p className="text-xs text-muted-foreground">
                    Chỉ đội ngũ quản trị xem được ảnh đính kèm báo cáo.
                  </p>
                </Field>
              )}
            </form>

            <DialogFooter>
              {errors.root && (
                <p role="alert" className="mr-auto self-center text-sm text-destructive">
                  {errors.root.message}
                </p>
              )}
              <Button variant="outline" disabled={isSubmitting} onClick={() => changeOpen(false)}>
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
