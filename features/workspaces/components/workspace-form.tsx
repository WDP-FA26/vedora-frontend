"use client"

import { Controller, useForm, useWatch, type DefaultValues } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { ApiError } from "@/features/shared/lib/api-client"
import { ProofPicker } from "@/features/verification/components/verification-form"
import { LocationPicker } from "@/features/workspaces/components/location-picker"
import { useSubmitWorkspace } from "@/features/workspaces/hooks/use-workspaces"
import {
  MAX_BIO_LENGTH,
  MAX_PROOF_MB,
  MAX_PROOFS,
  MAX_STATEMENT_LENGTH,
  workspaceFormSchema,
  type Workspace,
  type WorkspaceDetail,
  type WorkspaceFormInput,
  type WorkspaceFormValues,
} from "@/features/workspaces/schemas"

const SUBMIT_ERRORS: Record<string, string> = {
  USERNAME_TAKEN: "Tên đăng nhập này đã có người dùng. Chọn tên khác nhé.",
  REQUEST_PENDING: "Bạn đã có một trang đang chờ duyệt.",
  PROOF_NOT_UPLOADED: "Một ảnh chưa tải lên xong. Thử gửi lại nhé.",
  PROOF_LIMIT_REACHED: "Bạn đã tải lên quá nhiều ảnh. Thử lại sau nhé.",
  PAGE_SESSION_NOT_ALLOWED: "Chuyển về tài khoản cá nhân để mở trang mới.",
}

function submitErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code && SUBMIT_ERRORS[error.code]) return SUBMIT_ERRORS[error.code]
    if (error.status === 503) return "Chưa thể nhận ảnh lúc này. Thử lại sau nhé."
  }
  return "Không gửi được đơn mở trang. Thử lại nhé."
}

function defaultsFrom(workspace: Workspace | null): DefaultValues<WorkspaceFormInput> {
  if (!workspace) {
    return {
      name: "",
      username: "",
      bio: "",
      address: "",
      phone: "",
      website: "",
      statement: "",
      proofs: [],
    }
  }
  return {
    name: workspace.name,
    username: workspace.username,
    bio: workspace.bio ?? "",
    address: workspace.address,
    location: { longitude: workspace.longitude, latitude: workspace.latitude },
    phone: workspace.phone ?? "",
    website: workspace.website ?? "",
    statement: workspace.statement,
    proofs: [],
  }
}

/** Applies to open a restaurant page, or (with `rejected`) sends a rejected one back for review. */
export function WorkspaceForm({
  rejected,
  onSubmitted,
}: {
  rejected: Workspace | null
  onSubmitted: (workspace: WorkspaceDetail) => void
}) {
  const submit = useSubmitWorkspace(rejected?.id ?? null)
  const form = useForm<WorkspaceFormInput, unknown, WorkspaceFormValues>({
    resolver: zodResolver(workspaceFormSchema),
    defaultValues: defaultsFrom(rejected),
  })
  const { isSubmitting, errors } = form.formState
  const address = useWatch({ control: form.control, name: "address" }) ?? ""

  async function onSubmit(values: WorkspaceFormValues) {
    try {
      const workspace = await submit(values)
      for (const { preview } of values.proofs) URL.revokeObjectURL(preview)
      onSubmitted(workspace)
    } catch (error) {
      form.setError("root", { message: submitErrorMessage(error) })
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Tên nhà hàng</FieldLabel>
              <Input
                {...field}
                id={field.name}
                aria-invalid={fieldState.invalid}
                placeholder="Ví dụ: Chay An Lạc"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="username"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Tên đăng nhập của trang</FieldLabel>
              <Input
                {...field}
                id={field.name}
                aria-invalid={fieldState.invalid}
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                placeholder="chay.an.lac"
              />
              <FieldDescription>Hiện sau dấu @ trên trang của nhà hàng.</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="bio"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Giới thiệu (không bắt buộc)</FieldLabel>
              <Textarea
                {...field}
                id={field.name}
                rows={3}
                maxLength={MAX_BIO_LENGTH}
                aria-invalid={fieldState.invalid}
                placeholder="Món đặc trưng, giờ mở cửa, không gian…"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="address"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Địa chỉ</FieldLabel>
              <Input
                {...field}
                id={field.name}
                aria-invalid={fieldState.invalid}
                placeholder="Số nhà, đường, phường, quận, thành phố"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="location"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldTitle>Vị trí trên bản đồ</FieldTitle>
              <LocationPicker
                address={address}
                location={field.value ?? null}
                invalid={fieldState.invalid}
                disabled={isSubmitting}
                onAddressChange={(address) =>
                  form.setValue("address", address, { shouldValidate: true })
                }
                onLocationChange={field.onChange}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            name="phone"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Số điện thoại (không bắt buộc)</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  type="tel"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="website"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Website (không bắt buộc)</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  type="url"
                  aria-invalid={fieldState.invalid}
                  placeholder="https://"
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </div>

        <Controller
          name="statement"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Bạn là ai ở nhà hàng này?</FieldLabel>
              <Textarea
                {...field}
                id={field.name}
                rows={4}
                maxLength={MAX_STATEMENT_LENGTH}
                aria-invalid={fieldState.invalid}
                placeholder="Bạn là chủ quán hay người quản lý? Ảnh đính kèm chứng minh điều gì?"
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
                Giấy phép kinh doanh, giấy chứng nhận an toàn thực phẩm hoặc ảnh mặt tiền có
                biển hiệu. Tối đa {MAX_PROOFS} ảnh JPEG, PNG hoặc WebP, mỗi ảnh không quá{" "}
                {MAX_PROOF_MB} MB. Ảnh được lưu riêng tư và chỉ dùng để xét duyệt.
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {errors.root && <FieldError errors={[errors.root]} />}

        <Button type="submit" size="pill" shape="pill" disabled={isSubmitting}>
          {isSubmitting && <Spinner aria-hidden />}
          {isSubmitting ? "Đang gửi…" : rejected ? "Gửi lại để duyệt" : "Gửi đơn mở trang"}
        </Button>
      </FieldGroup>
    </form>
  )
}
