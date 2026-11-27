"use client"

import { useEffect, useRef, useState } from "react"
import {
  Controller,
  useFieldArray,
  useForm,
  useFormState,
  useWatch,
  type Control,
  type DefaultValues,
  type FieldPath,
  type UseFormReturn,
} from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeftIcon, ArrowRightIcon, InfoIcon, PlusIcon, XIcon } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { ApiError } from "@/features/shared/lib/api-client"
import { LocationPicker } from "@/features/workspaces/components/location-picker"
import { ProofSlots } from "@/features/workspaces/components/proof-slots"
import { useSubmitWorkspace } from "@/features/workspaces/hooks/use-workspaces"
import {
  BUSINESS_FORM_LABELS,
  BUSINESS_FORMS,
  LEGAL_ENTITY_TYPES,
  LEGAL_ENTITY_VIEWS,
  VEGETARIAN_LEVEL_LABELS,
  VEGETARIAN_LEVELS,
  isVnProvinceCode,
  VN_PROVINCES,
  VN_PROVINCES_BY_NAME,
  type VnProvinceCode,
} from "@/features/workspaces/onboarding"
import {
  MAX_BIO_LENGTH,
  MAX_OTHER_PLATFORM_URLS,
  MAX_PROOF_MB,
  MAX_STATEMENT_LENGTH,
  workspaceFormSchema,
  type Workspace,
  type WorkspaceDetail,
  type WorkspaceFormInput,
  type WorkspaceFormValues,
} from "@/features/workspaces/schemas"
import { cn } from "@/lib/utils"

type FormApi = UseFormReturn<WorkspaceFormInput, unknown, WorkspaceFormValues>
type FieldName = FieldPath<WorkspaceFormInput>
type FormControl = Control<WorkspaceFormInput, unknown, WorkspaceFormValues>

const STEPS = [
  {
    title: "Hồ sơ quán",
    description: "Thông tin khách sẽ thấy trên trang và bản đồ nhà hàng chay.",
  },
  {
    title: "Thông tin pháp lý",
    description:
      "Giúp quản trị viên xác minh quán có thật và bạn có quyền đại diện. Chỉ quản trị viên xem được phần này.",
  },
  {
    title: "Giấy tờ và cam kết",
    description: "Ảnh được lưu riêng tư và chỉ dùng để xét duyệt đơn.",
  },
] as const

/** What "Tiếp tục" checks on each step before moving on; the last step checks everything on submit. */
const STEP_FIELDS: readonly (readonly FieldName[])[] = [
  [
    "name",
    "username",
    "bio",
    "provinceCode",
    "wardCode",
    "address",
    "location",
    "businessForm",
    "vegetarianLevel",
    "phone",
    "website",
    "otherPlatformUrls",
  ],
  ["legal"],
]

const SUBMIT_ERRORS: Record<string, string> = {
  USERNAME_TAKEN: "Tên đăng nhập của trang đã có người dùng. Quay lại bước 1 để đổi nhé.",
  APPLICATION_PENDING: "Bạn đã có một đơn đang chờ duyệt. Đợi kết quả đơn đó rồi gửi đơn mới nhé.",
  MISSING_PROOF: "Còn thiếu giấy tờ bắt buộc. Kiểm tra lại các ô có nhãn Bắt buộc.",
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

const EMPTY_LEGAL = {
  entityType: "HOUSEHOLD",
  taxCode: "",
  legalName: "",
  legalAddress: "",
  representativeName: "",
  contactEmail: "",
} satisfies WorkspaceFormInput["legal"]

const EMPTY_VALUES: DefaultValues<WorkspaceFormInput> = {
  name: "",
  username: "",
  bio: "",
  wardCode: "",
  address: "",
  phone: "",
  website: "",
  otherPlatformUrls: [],
  legal: EMPTY_LEGAL,
  statement: "",
  proofs: [],
}

/** A rejected application's answers, ready to fix; documents are always sent again. */
function defaultsFrom(workspace: Workspace | null): DefaultValues<WorkspaceFormInput> {
  if (!workspace) return EMPTY_VALUES
  const { legal } = workspace
  return {
    ...EMPTY_VALUES,
    name: workspace.name,
    username: workspace.username,
    bio: workspace.bio ?? "",
    provinceCode: knownProvince(workspace.provinceCode),
    wardCode: workspace.wardCode ?? "",
    address: workspace.address,
    location: { longitude: workspace.longitude, latitude: workspace.latitude },
    businessForm: workspace.businessForm ?? undefined,
    vegetarianLevel: workspace.vegetarianLevel ?? undefined,
    phone: workspace.phone ?? "",
    website: workspace.website ?? "",
    otherPlatformUrls: workspace.otherPlatformUrls.map((url) => ({ url })),
    legal: legal ? { ...legal, legalName: legal.legalName ?? "" } : EMPTY_LEGAL,
    statement: workspace.statement ?? "",
  }
}

/**
 * A draft saved before official codes holds a province such as `ha-noi` and a
 * typed ward; drop both so the person picks them again from the lists.
 */
function withKnownProvince(draft: object): object {
  const province: unknown = Reflect.get(draft, "provinceCode")
  if (typeof province === "string" && isVnProvinceCode(province)) return draft
  return { ...draft, provinceCode: undefined, wardCode: "" }
}

/** Unsent answers survive a reload; files and the commitments are never kept. */
function useDraft(form: FormApi, enabled: boolean) {
  const { user } = useAuth()
  const key = user ? `vedora:workspace-application:${user.id}` : null

  useEffect(() => {
    if (!enabled || !key) return
    const saved = window.localStorage.getItem(key)
    if (saved) {
      try {
        const draft: unknown = JSON.parse(saved)
        if (typeof draft === "object" && draft !== null)
          form.reset({ ...EMPTY_VALUES, ...withKnownProvince(draft), proofs: [] })
      } catch {
        window.localStorage.removeItem(key)
      }
    }
    const subscription = form.watch((values) => {
      const kept = { ...values }
      delete kept.proofs
      delete kept.confirmsAccuracy
      delete kept.consentsToReview
      window.localStorage.setItem(key, JSON.stringify(kept))
    })
    return () => subscription.unsubscribe()
  }, [enabled, form, key])

  return () => {
    if (key) window.localStorage.removeItem(key)
  }
}

/**
 * The restaurant page application in three steps, after merchant onboarding
 * flows: the restaurant, its legal details, then documents and commitments.
 * With `rejected`, it sends a rejected application back for review.
 */
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
    mode: "onTouched",
  })
  const clearDraft = useDraft(form, rejected === null)
  const [step, setStep] = useState(0)
  const top = useRef<HTMLDivElement>(null)
  const { isSubmitting, errors } = form.formState
  const isLast = step === STEPS.length - 1
  let submitLabel = rejected ? "Gửi lại để duyệt" : "Gửi đơn mở trang"
  if (isSubmitting) submitLabel = "Đang gửi…"

  function goTo(next: number) {
    setStep(next)
    top.current?.scrollIntoView({ block: "start", behavior: "smooth" })
  }

  async function next() {
    const valid = await form.trigger([...STEP_FIELDS[step]], {
      shouldFocus: true,
    })
    if (valid) goTo(step + 1)
  }

  async function onSubmit(values: WorkspaceFormValues) {
    try {
      const workspace = await submit(values)
      for (const { preview } of values.proofs) URL.revokeObjectURL(preview)
      clearDraft()
      onSubmitted(workspace)
    } catch (error) {
      form.setError("root", { message: submitErrorMessage(error) })
    }
  }

  return (
    <form
      onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
      noValidate
      className="flex flex-col gap-6"
    >
      <div ref={top} className="scroll-mt-20">
        <StepHeader step={step} />
      </div>

      {step === 0 && <RestaurantStep form={form} disabled={isSubmitting} />}
      {step === 1 && <LegalStep control={form.control} />}
      {step === 2 && <DocumentsStep control={form.control} disabled={isSubmitting} />}

      {errors.root && <FieldError errors={[errors.root]} />}

      <div className="flex items-center gap-3">
        {step > 0 && (
          <Button
            type="button"
            variant="outline"
            shape="pill"
            size="pill"
            disabled={isSubmitting}
            onClick={() => goTo(step - 1)}
          >
            <ArrowLeftIcon aria-hidden />
            Quay lại
          </Button>
        )}
        {isLast ? (
          <Button
            key="submit"
            type="submit"
            size="pill"
            shape="pill"
            disabled={isSubmitting}
            className="flex-1"
          >
            {isSubmitting && <Spinner aria-hidden />}
            {submitLabel}
          </Button>
        ) : (
          <Button
            key="next"
            type="button"
            size="pill"
            shape="pill"
            onClick={() => void next()}
            className="flex-1"
          >
            Tiếp tục
            <ArrowRightIcon aria-hidden data-icon="inline-end" />
          </Button>
        )}
      </div>
    </form>
  )
}

function StepHeader({ step }: { step: number }) {
  const current = STEPS[step]
  return (
    <div className="flex flex-col gap-3">
      <ol aria-label="Các bước" className="grid grid-cols-3 gap-2">
        {STEPS.map((item, index) => (
          <li
            key={item.title}
            aria-current={index === step ? "step" : undefined}
            className="flex flex-col gap-1.5"
          >
            <span
              aria-hidden
              className={cn(
                "h-1.5 rounded-full bg-muted transition-colors",
                index <= step && "bg-primary"
              )}
            />
            <span
              className={cn(
                "text-xs text-muted-foreground",
                index === step && "font-medium text-foreground"
              )}
            >
              {index + 1}. {item.title}
            </span>
          </li>
        ))}
      </ol>
      <div>
        <p className="text-xs font-medium text-muted-foreground">
          Bước {step + 1}/{STEPS.length}
        </p>
        <h2 className="font-heading text-lg font-bold">{current.title}</h2>
        <p className="text-sm text-muted-foreground">{current.description}</p>
      </div>
    </div>
  )
}

function TextField({
  control,
  name,
  label,
  description,
  placeholder,
  type = "text",
}: {
  control: FormControl
  name: FieldName
  label: string
  description?: string
  placeholder?: string
  type?: "text" | "tel" | "url" | "email"
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
          <Input
            name={field.name}
            ref={field.ref}
            value={typeof field.value === "string" ? field.value : ""}
            onChange={field.onChange}
            onBlur={field.onBlur}
            id={field.name}
            type={type}
            aria-invalid={fieldState.invalid}
            placeholder={placeholder}
          />
          {description && <FieldDescription>{description}</FieldDescription>}
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}

/** The select's value; one that matches no option shows the placeholder, not the first option. */
function optionValue(value: unknown, options: readonly { value: string }[]): string {
  if (typeof value !== "string") return ""
  return options.some((option) => option.value === value) ? value : ""
}

function SelectField<T extends string>({
  control,
  name,
  label,
  placeholder,
  options,
  disabled = false,
}: {
  control: FormControl
  name: FieldName
  label: string
  placeholder: string
  options: readonly { value: T; label: string }[]
  disabled?: boolean
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
          <NativeSelect
            id={field.name}
            name={field.name}
            ref={field.ref}
            value={optionValue(field.value, options)}
            onChange={(event) => {
              field.onChange(event.target.value || undefined)
              // A pick is final; check it now rather than when focus leaves.
              field.onBlur()
            }}
            onBlur={field.onBlur}
            aria-invalid={fieldState.invalid}
            disabled={disabled}
            className="w-full"
          >
            <NativeSelectOption value="" disabled>
              {placeholder}
            </NativeSelectOption>
            {options.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}

/** A rejected application's province, if it is one the dropdown offers. */
function knownProvince(code: string | null): VnProvinceCode | undefined {
  if (code === null || !isVnProvinceCode(code)) return undefined
  return code
}

type WardList = Record<VnProvinceCode, readonly (readonly [string, string])[]>

/** The 3,321 wards are a separate chunk, fetched once the form needs them. */
function useWards() {
  const [wards, setWards] = useState<WardList | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let current = true
    import("@/features/workspaces/vn-wards")
      .then(({ VN_WARDS }) => {
        if (current) setWards(VN_WARDS)
      })
      .catch(() => {
        if (current) setFailed(true)
      })
    return () => {
      current = false
    }
  }, [])
  return { wards, failed }
}

/** Lists the wards of the chosen province; a new province clears the old ward. */
function WardField({ form }: { form: FormApi }) {
  const { control } = form
  const province = useWatch({ control, name: "provinceCode" })
  const { wards, failed } = useWards()
  const previous = useRef(province)

  useEffect(() => {
    if (previous.current === province) return
    // Only a change the person makes; restoring a draft keeps its ward.
    if (previous.current !== undefined) form.setValue("wardCode", "")
    previous.current = province
  }, [form, province])

  // Guarded at run time too: the value can come from an old saved draft.
  const options = province && isVnProvinceCode(province) && wards ? wards[province] : []
  let placeholder = "Chọn phường, xã"
  if (!province) placeholder = "Chọn tỉnh trước"
  else if (failed) placeholder = "Không tải được danh sách"
  else if (!wards) placeholder = "Đang tải…"

  return (
    <SelectField
      control={control}
      name="wardCode"
      label="Phường, xã"
      placeholder={placeholder}
      disabled={!province || !wards}
      options={options.map(([value, label]) => ({ value, label }))}
    />
  )
}

const PROVINCE_OPTIONS = VN_PROVINCES_BY_NAME.map((code) => ({
  value: code,
  label: VN_PROVINCES[code],
}))
const BUSINESS_FORM_OPTIONS = BUSINESS_FORMS.map((value) => ({
  value,
  label: BUSINESS_FORM_LABELS[value],
}))
const VEGETARIAN_LEVEL_OPTIONS = VEGETARIAN_LEVELS.map((value) => ({
  value,
  label: VEGETARIAN_LEVEL_LABELS[value],
}))

function RestaurantStep({ form, disabled }: { form: FormApi; disabled: boolean }) {
  const { control } = form
  const address = useWatch({ control, name: "address" }) ?? ""

  return (
    <FieldGroup>
      <Controller
        name="name"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>Tên quán</FieldLabel>
            <Input
              {...field}
              id={field.name}
              aria-invalid={fieldState.invalid}
              placeholder="Chay An Lạc - Bún Huế - Hàng Bông"
            />
            <Alert>
              <InfoIcon aria-hidden />
              <AlertDescription>
                Nên đặt theo thứ tự: Tên quán - Món đặc trưng - Tên đường, để khách dễ nhận ra quán
                trên bản đồ.
              </AlertDescription>
            </Alert>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <Controller
        name="username"
        control={control}
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
            <FieldDescription>Hiện sau dấu @ trên trang của quán.</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          control={control}
          name="provinceCode"
          label="Tỉnh, thành phố"
          placeholder="Chọn tỉnh, thành phố"
          options={PROVINCE_OPTIONS}
        />
        <WardField form={form} />
      </div>

      <TextField control={control} name="address" label="Địa chỉ" placeholder="Số nhà, tên đường" />

      <Controller
        name="location"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldTitle>Vị trí trên bản đồ</FieldTitle>
            <LocationPicker
              address={address}
              location={field.value ?? null}
              invalid={fieldState.invalid}
              disabled={disabled}
              onAddressChange={(next) => form.setValue("address", next, { shouldValidate: true })}
              onLocationChange={field.onChange}
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          control={control}
          name="businessForm"
          label="Hình thức kinh doanh"
          placeholder="Chọn hình thức"
          options={BUSINESS_FORM_OPTIONS}
        />
        <SelectField
          control={control}
          name="vegetarianLevel"
          label="Loại ẩm thực"
          placeholder="Chọn loại ẩm thực"
          options={VEGETARIAN_LEVEL_OPTIONS}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          control={control}
          name="phone"
          label="Số điện thoại"
          type="tel"
          placeholder="0901 234 567"
          description="Quản trị viên sẽ gọi số này để xác minh."
        />
        <TextField
          control={control}
          name="website"
          label="Website (không bắt buộc)"
          type="url"
          placeholder="https://"
        />
      </div>

      <OtherPlatformLinks control={control} />

      <Controller
        name="bio"
        control={control}
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
    </FieldGroup>
  )
}

function OtherPlatformLinks({ control }: { control: FormControl }) {
  const links = useFieldArray({ control, name: "otherPlatformUrls" })
  return (
    <FieldSet>
      <FieldLegend variant="label">Quán trên nền tảng khác (không bắt buộc)</FieldLegend>
      <FieldDescription>
        Link Google Maps, ShopeeFood, GrabFood hoặc Facebook của quán giúp duyệt nhanh hơn.
      </FieldDescription>
      {links.fields.map((link, index) => (
        <Controller
          key={link.id}
          name={`otherPlatformUrls.${index}.url`}
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <div className="flex items-center gap-2">
                <Input
                  {...field}
                  type="url"
                  aria-label={`Link ${index + 1}`}
                  aria-invalid={fieldState.invalid}
                  placeholder="https://maps.app.goo.gl/…"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  shape="pill"
                  aria-label={`Xóa link ${index + 1}`}
                  onClick={() => links.remove(index)}
                >
                  <XIcon aria-hidden />
                </Button>
              </div>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      ))}
      {links.fields.length < MAX_OTHER_PLATFORM_URLS && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          shape="pill"
          onClick={() => links.append({ url: "" })}
          className="self-start"
        >
          <PlusIcon aria-hidden />
          Thêm link
        </Button>
      )}
    </FieldSet>
  )
}

function LegalStep({ control }: { control: FormControl }) {
  const entityType = useWatch({ control, name: "legal.entityType" }) ?? "HOUSEHOLD"
  const view = LEGAL_ENTITY_VIEWS[entityType]

  return (
    <FieldGroup>
      <Controller
        name="legal.entityType"
        control={control}
        render={({ field, fieldState }) => (
          <FieldSet data-invalid={fieldState.invalid}>
            <FieldLegend variant="label">Loại hình kinh doanh</FieldLegend>
            <RadioGroup name={field.name} value={field.value} onValueChange={field.onChange}>
              {LEGAL_ENTITY_TYPES.map((type) => (
                <FieldLabel key={type} htmlFor={`entity-${type}`}>
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldTitle>{LEGAL_ENTITY_VIEWS[type].label}</FieldTitle>
                      <FieldDescription>{LEGAL_ENTITY_VIEWS[type].description}</FieldDescription>
                    </FieldContent>
                    <RadioGroupItem id={`entity-${type}`} value={type} />
                  </Field>
                </FieldLabel>
              ))}
            </RadioGroup>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </FieldSet>
        )}
      />

      <TextField
        control={control}
        name="legal.taxCode"
        label={entityType === "INDIVIDUAL" ? "Số CCCD (mã số thuế cá nhân)" : "Mã số thuế"}
        description={view.taxCodeHint}
        placeholder={entityType === "INDIVIDUAL" ? "001203004005" : "0312345678"}
      />

      {view.legalNameLabel && (
        <TextField
          control={control}
          name="legal.legalName"
          label={view.legalNameLabel}
          description="Ghi đúng như trên giấy chứng nhận đăng ký."
        />
      )}

      <TextField control={control} name="legal.legalAddress" label={view.legalAddressLabel} />

      <TextField
        control={control}
        name="legal.representativeName"
        label={view.representativeLabel}
        description="Phải trùng tên trên CCCD bạn gửi ở bước sau."
      />

      <TextField
        control={control}
        name="legal.contactEmail"
        label="Email liên hệ"
        type="email"
        placeholder="ten@example.com"
      />
    </FieldGroup>
  )
}

function DocumentsStep({ control, disabled }: { control: FormControl; disabled: boolean }) {
  const entityType = useWatch({ control, name: "legal.entityType" }) ?? "HOUSEHOLD"
  const submitted = useFormState({ control }).isSubmitted

  return (
    <FieldGroup>
      <Controller
        name="proofs"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid && submitted}>
            <FieldTitle>Giấy tờ</FieldTitle>
            <FieldDescription>
              Ảnh JPEG, PNG hoặc WebP, mỗi ảnh không quá {MAX_PROOF_MB} MB. Chụp thẳng, đủ sáng, đọc
              rõ chữ.
            </FieldDescription>
            <ProofSlots
              entityType={entityType}
              proofs={field.value ?? []}
              disabled={disabled}
              onChange={field.onChange}
            />
            {fieldState.invalid && submitted && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <Controller
        name="statement"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>Bạn là ai ở quán này? (không bắt buộc)</FieldLabel>
            <Textarea
              {...field}
              id={field.name}
              rows={3}
              maxLength={MAX_STATEMENT_LENGTH}
              aria-invalid={fieldState.invalid}
              placeholder="Chủ quán, người quản lý, con của chủ quán…"
            />
            <FieldDescription>Chỉ quản trị viên đọc được nội dung này.</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <FieldSet>
        <FieldLegend variant="label">Cam kết</FieldLegend>
        <CommitmentField
          control={control}
          name="confirmsAccuracy"
          label="Tôi cam kết thông tin và giấy tờ là chính xác, và tôi có quyền đại diện cho quán."
        />
        <CommitmentField
          control={control}
          name="consentsToReview"
          label="Tôi đồng ý để Vedora dùng giấy tờ này chỉ cho việc xét duyệt đơn."
        />
      </FieldSet>
    </FieldGroup>
  )
}

function CommitmentField({
  control,
  name,
  label,
}: {
  control: FormControl
  name: "confirmsAccuracy" | "consentsToReview"
  label: string
}) {
  // A new step should not open on a wall of errors; they show once tried or on submit.
  const submitted = useFormState({ control, name }).isSubmitted
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const showError = fieldState.invalid && (fieldState.isTouched || submitted)
        return (
          <Field orientation="horizontal" data-invalid={showError}>
            <Checkbox
              id={field.name}
              checked={field.value === true}
              onCheckedChange={(checked) => {
                field.onChange(checked === true)
                field.onBlur()
              }}
              aria-invalid={showError}
            />
            <FieldContent>
              <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
              {showError && <FieldError errors={[fieldState.error]} />}
            </FieldContent>
          </Field>
        )
      }}
    />
  )
}
