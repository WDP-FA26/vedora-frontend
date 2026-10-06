"use client"

import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { useDropzone, type Accept } from "react-dropzone"
import { zodResolver } from "@hookform/resolvers/zod"
import { ImagePlusIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { ApiError } from "@/features/shared/lib/api-client"
import { useSubmitVerification } from "@/features/verification/hooks/use-submit-verification"
import {
  MAX_PROOF_MB,
  MAX_PROOFS,
  MAX_STATEMENT_LENGTH,
  PROOF_CONTENT_TYPES,
  verificationFormSchema,
  type VerificationFormValues,
  type VerificationRequest,
} from "@/features/verification/schemas"

const PROOF_ACCEPT: Accept = Object.fromEntries(
  PROOF_CONTENT_TYPES.map((type) => [type, []])
)

const SUBMIT_ERRORS: Record<string, string> = {
  ALREADY_VERIFIED: "Tài khoản của bạn đã được xác minh rồi.",
  REQUEST_PENDING: "Bạn đã có một yêu cầu đang chờ duyệt.",
  PROOF_NOT_UPLOADED: "Một ảnh chưa tải lên xong. Thử gửi lại nhé.",
  PROOF_LIMIT_REACHED: "Bạn đã tải lên quá nhiều ảnh. Thử lại sau nhé.",
}

function submitErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code && SUBMIT_ERRORS[error.code]) return SUBMIT_ERRORS[error.code]
    if (error.status === 503) return "Chưa thể nhận ảnh lúc này. Thử lại sau nhé."
  }
  return "Không gửi được yêu cầu. Thử lại nhé."
}

type Proof = VerificationFormValues["proofs"][number]

export function VerificationForm({
  onSubmitted,
}: {
  onSubmitted: (request: VerificationRequest) => void
}) {
  const submit = useSubmitVerification()
  const form = useForm<VerificationFormValues>({
    resolver: zodResolver(verificationFormSchema),
    defaultValues: { statement: "", proofs: [] },
  })
  const { isSubmitting, errors } = form.formState

  async function onSubmit(values: VerificationFormValues) {
    try {
      const request = await submit(values)
      values.proofs.forEach(({ preview }) => URL.revokeObjectURL(preview))
      onSubmitted(request)
    } catch (error) {
      form.setError("root", { message: submitErrorMessage(error) })
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Controller
          name="statement"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Công việc chuyên môn của bạn</FieldLabel>
              <Textarea
                {...field}
                id={field.name}
                rows={5}
                maxLength={MAX_STATEMENT_LENGTH}
                aria-invalid={fieldState.invalid}
                placeholder="Bạn là đầu bếp, chuyên gia dinh dưỡng hay nhà sáng tạo công thức? Làm ở đâu, từ khi nào, và ảnh đính kèm chứng minh điều gì?"
              />
              <div className="flex justify-between gap-4">
                <FieldDescription>Chỉ quản trị viên đọc được nội dung này.</FieldDescription>
                <span
                  aria-live="polite"
                  className="shrink-0 text-sm text-muted-foreground tabular-nums"
                >
                  {field.value.length}/{MAX_STATEMENT_LENGTH}
                </span>
              </div>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="proofs"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldTitle>Ảnh minh chứng</FieldTitle>
              <ProofPicker
                proofs={field.value}
                disabled={isSubmitting}
                onChange={field.onChange}
              />
              <FieldDescription>
                Chứng chỉ, thẻ nghề, hợp đồng hoặc bài báo có tên bạn. Tối đa {MAX_PROOFS} ảnh
                JPEG, PNG hoặc WebP, mỗi ảnh không quá {MAX_PROOF_MB} MB. Ảnh được lưu riêng
                tư và chỉ dùng để xét duyệt.
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {errors.root && <FieldError errors={[errors.root]} />}

        <Button type="submit" size="pill" shape="pill" disabled={isSubmitting}>
          {isSubmitting && <Spinner aria-hidden />}
          {isSubmitting ? "Đang gửi…" : "Gửi yêu cầu xác minh"}
        </Button>
      </FieldGroup>
    </form>
  )
}

function ProofPicker({
  proofs,
  disabled,
  onChange,
}: {
  proofs: Proof[]
  disabled: boolean
  onChange: (proofs: Proof[]) => void
}) {
  // Kept out of the form: revalidating `proofs` on change would clear it.
  const [rejection, setRejection] = useState<string | null>(null)
  const remaining = MAX_PROOFS - proofs.length
  const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
    accept: PROOF_ACCEPT,
    maxSize: MAX_PROOF_MB * 1024 * 1024,
    noClick: true,
    noKeyboard: true,
    disabled: disabled || remaining === 0,
    onDrop: (accepted, rejected) => {
      const added = accepted.slice(0, remaining)
      if (added.length) {
        // Created on pick and revoked on removal or submit, not in an effect,
        // so Strict Mode can't revoke a preview that is still shown.
        onChange([
          ...proofs,
          ...added.map((file) => ({ file, preview: URL.createObjectURL(file) })),
        ])
      }
      if (accepted.length > remaining) {
        setRejection(`Tối đa ${MAX_PROOFS} ảnh, các ảnh còn lại đã bị bỏ qua.`)
      } else if (rejected.length) {
        setRejection(
          rejected[0].errors[0]?.code === "file-too-large"
            ? `Đã bỏ qua ảnh lớn hơn ${MAX_PROOF_MB} MB. Chọn ảnh nhỏ hơn nhé.`
            : "Đã bỏ qua tệp không phải ảnh JPEG, PNG hoặc WebP."
        )
      } else {
        setRejection(null)
      }
    },
  })

  function remove(proof: Proof) {
    URL.revokeObjectURL(proof.preview)
    onChange(proofs.filter((item) => item !== proof))
  }

  return (
    <div
      {...getRootProps()}
      data-drag-active={isDragActive || undefined}
      className="rounded-2xl border border-dashed border-border p-3 transition-colors data-drag-active:border-primary data-drag-active:bg-primary/5"
    >
      <input {...getInputProps()} />
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {proofs.map((proof, index) => (
          <li
            key={proof.preview}
            className="relative aspect-square overflow-hidden rounded-xl bg-muted"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
            <img
              src={proof.preview}
              alt={`Ảnh minh chứng ${index + 1}: ${proof.file.name}`}
              className="size-full object-cover"
            />
            <div className="absolute top-1 right-1">
              <Button
                type="button"
                variant="overlay"
                shape="pill"
                size="icon-xs"
                aria-label={`Gỡ ảnh ${index + 1}`}
                disabled={disabled}
                onClick={() => remove(proof)}
              >
                <XIcon aria-hidden />
              </Button>
            </div>
          </li>
        ))}
        {remaining > 0 && (
          <li className={proofs.length ? "aspect-square" : "col-span-full"}>
            <button
              type="button"
              disabled={disabled}
              onClick={open}
              className="flex size-full min-h-24 flex-col items-center justify-center gap-1.5 rounded-xl bg-muted/60 p-2 text-center text-sm text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-50"
            >
              <ImagePlusIcon aria-hidden className="size-5" />
              {proofs.length ? "Thêm ảnh" : "Chọn ảnh hoặc kéo thả vào đây"}
            </button>
          </li>
        )}
      </ul>
      {rejection && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {rejection}
        </p>
      )}
    </div>
  )
}
