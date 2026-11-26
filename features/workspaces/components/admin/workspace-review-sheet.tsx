"use client"

import { useState } from "react"
import Link from "next/link"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { CheckIcon, ExternalLinkIcon, TriangleAlertIcon, XIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
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
import { RestaurantLocationMap } from "@/features/workspaces/components/map"
import {
  useAdminWorkspace,
  useReviewWorkspace,
} from "@/features/workspaces/hooks/use-admin-workspaces"
import { MAPBOX_TOKEN } from "@/features/workspaces/lib/mapbox"
import {
  BUSINESS_FORM_LABELS,
  LEGAL_ENTITY_VIEWS,
  PROOF_KIND_VIEWS,
  REJECT_REASON_LABELS,
  REJECT_REASONS,
  REVIEW_CHECKLIST_ITEMS,
  REVIEW_CHECKLIST_LABELS,
  taxCodeLookupUrl,
  VEGETARIAN_LEVEL_LABELS,
  VN_PROVINCES,
  WARNING_LABELS,
  type ReviewChecklistItem,
} from "@/features/workspaces/onboarding"
import {
  MAX_REVIEW_NOTE_LENGTH,
  type AdminWorkspaceDetail,
  type ReviewChecklist,
} from "@/features/workspaces/schemas"

const REJECT_FORM_ID = "reject-workspace-form"

const rejectFormSchema = z
  .object({
    rejectReason: z.enum(REJECT_REASONS, { error: "Chọn lý do từ chối" }),
    note: z.string().trim().max(MAX_REVIEW_NOTE_LENGTH, `Tối đa ${MAX_REVIEW_NOTE_LENGTH} ký tự`),
  })
  .refine((values) => values.rejectReason !== "OTHER" || values.note !== "", {
    path: ["note"],
    message: "Ghi rõ lý do khác",
  })

type RejectFormInput = z.input<typeof rejectFormSchema>
type RejectFormValues = z.output<typeof rejectFormSchema>

const EMPTY_CHECKLIST: ReviewChecklist = {
  identityMatches: false,
  taxCodeVerified: false,
  storefrontMatches: false,
  phoneConfirmed: false,
}

/** A company or household tax code can be looked up; a citizen ID is personal data and is not sent out. */
const LOOKUP_TAX_CODE = /^\d{10}(-\d{3})?$/

function reviewErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.code === "USERNAME_TAKEN") {
    return "Tên đăng nhập của trang đã bị tài khoản khác dùng. Hãy từ chối (Trùng với trang đã có) để chủ trang chọn tên khác."
  }
  if (error instanceof ApiError && error.code === "CHECKLIST_INCOMPLETE") {
    return "Tick đủ các mục kiểm tra trước khi duyệt."
  }
  if (error instanceof ApiError && error.status === 409) return "Đơn này đã được xét duyệt rồi."
  return "Không lưu được quyết định. Thử lại nhé."
}

/** An application's details, legal info, documents and warnings, with approve and reject for pending ones. */
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
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        {workspace ? (
          // Keyed so the checklist and reject form start empty for each application.
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

function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h3 id={id} className="font-heading text-sm font-bold">
        {title}
      </h3>
      {children}
    </section>
  )
}

function fullAddress(workspace: AdminWorkspaceDetail) {
  const parts = [workspace.address]
  if (workspace.ward) parts.push(workspace.ward)
  if (workspace.provinceCode) parts.push(VN_PROVINCES[workspace.provinceCode])
  return parts.join(", ")
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
  const [checklist, setChecklist] = useState<ReviewChecklist>(EMPTY_CHECKLIST)
  const form = useForm<RejectFormInput, unknown, RejectFormValues>({
    resolver: zodResolver(rejectFormSchema),
    defaultValues: { note: "" },
  })
  const { isSubmitting, errors } = form.formState
  const busy = approving || isSubmitting
  const { owner, legal } = workspace
  // Applications from before the 3-step form have nothing to check off.
  const needsChecklist = legal !== null
  const checklistDone = REVIEW_CHECKLIST_ITEMS.every((item) => checklist[item])

  async function approve() {
    setApproveError(null)
    setApproving(true)
    try {
      await review(workspace.id, {
        decision: "APPROVED",
        ...(needsChecklist ? { checklist } : {}),
      })
      onReviewed()
    } catch (error) {
      setApproveError(reviewErrorMessage(error))
      setApproving(false)
    }
  }

  async function reject({ rejectReason, note }: RejectFormValues) {
    try {
      await review(workspace.id, {
        decision: "REJECTED",
        rejectReason,
        ...(note ? { note } : {}),
      })
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

        {workspace.warnings.length > 0 && (
          <Alert variant="destructive">
            <TriangleAlertIcon aria-hidden />
            <AlertTitle>Cần xem kỹ</AlertTitle>
            <AlertDescription>
              <ul className="list-disc space-y-1 pl-4">
                {workspace.warnings.map((warning) => (
                  <li key={warning.code}>
                    {WARNING_LABELS[warning.code]}:{" "}
                    {warning.workspaces.map(({ name }) => name).join(", ")}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {!legal && (
          <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
            Đơn theo mẫu cũ: không có thông tin pháp lý và giấy tờ theo loại.
          </p>
        )}

        <Section id="workspace-profile" title="1. Hồ sơ quán">
          <dl className="flex flex-col gap-3">
            <Detail label="Địa chỉ">{fullAddress(workspace)}</Detail>
            {workspace.businessForm && (
              <Detail label="Hình thức kinh doanh">
                {BUSINESS_FORM_LABELS[workspace.businessForm]}
              </Detail>
            )}
            {workspace.vegetarianLevel && (
              <Detail label="Loại ẩm thực">
                {VEGETARIAN_LEVEL_LABELS[workspace.vegetarianLevel]}
              </Detail>
            )}
            {workspace.phone && (
              <Detail label="Số điện thoại">
                <a
                  href={`tel:${workspace.phone.replace(/[^\d+]/g, "")}`}
                  className="underline-offset-4 hover:underline"
                >
                  {workspace.phone}
                </a>
              </Detail>
            )}
            {workspace.website && <Detail label="Website">{workspace.website}</Detail>}
            {workspace.otherPlatformUrls.length > 0 && (
              <Detail label="Trên nền tảng khác">
                <ul>
                  {workspace.otherPlatformUrls.map((url) => (
                    <li key={url}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="break-all underline-offset-4 hover:underline"
                      >
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              </Detail>
            )}
            {workspace.bio && <Detail label="Giới thiệu">{workspace.bio}</Detail>}
            {workspace.statement && <Detail label="Người gửi nói">{workspace.statement}</Detail>}
          </dl>
          {MAPBOX_TOKEN && (
            <div className="h-48 shrink-0 overflow-hidden rounded-xl border border-border">
              <RestaurantLocationMap
                point={{
                  longitude: workspace.longitude,
                  latitude: workspace.latitude,
                }}
              />
            </div>
          )}
        </Section>

        {legal && (
          <Section id="workspace-legal" title="2. Pháp lý">
            <dl className="flex flex-col gap-3">
              <Detail label="Loại hình">{LEGAL_ENTITY_VIEWS[legal.entityType].label}</Detail>
              <Detail label={legal.entityType === "INDIVIDUAL" ? "Số CCCD (MST)" : "Mã số thuế"}>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-mono">{legal.taxCode}</span>
                  {LOOKUP_TAX_CODE.test(legal.taxCode) && (
                    <Button
                      variant="outline"
                      size="xs"
                      shape="pill"
                      nativeButton={false}
                      render={
                        <a
                          href={taxCodeLookupUrl(legal.taxCode)}
                          target="_blank"
                          rel="noreferrer noopener"
                        />
                      }
                    >
                      Tra cứu MST
                      <ExternalLinkIcon aria-hidden data-icon="inline-end" />
                    </Button>
                  )}
                </span>
              </Detail>
              {legal.legalName && (
                <Detail
                  label={LEGAL_ENTITY_VIEWS[legal.entityType].legalNameLabel ?? "Tên pháp lý"}
                >
                  {legal.legalName}
                </Detail>
              )}
              <Detail label={LEGAL_ENTITY_VIEWS[legal.entityType].legalAddressLabel}>
                {legal.legalAddress}
              </Detail>
              <Detail label="Người đứng tên">{legal.representativeName}</Detail>
              <Detail label="Email liên hệ">{legal.contactEmail}</Detail>
              {workspace.committedAt && (
                <Detail label="Đã cam kết">{formatPostDateLong(workspace.committedAt)}</Detail>
              )}
            </dl>
          </Section>
        )}

        <Section id="workspace-proofs" title={`3. Giấy tờ (${workspace.proofs.length})`}>
          <ul className="grid grid-cols-2 gap-3">
            {workspace.proofs.map((proof) => (
              <li key={proof.id} className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">
                  {PROOF_KIND_VIEWS[proof.kind].label}
                </span>
                <a
                  href={proof.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                  <img
                    src={proof.url}
                    alt={`${PROOF_KIND_VIEWS[proof.kind].label}, mở cỡ đầy đủ ở thẻ mới`}
                    referrerPolicy="no-referrer"
                    className="aspect-[4/3] w-full object-cover"
                  />
                </a>
              </li>
            ))}
          </ul>
        </Section>

        {workspace.status !== "PENDING" && <ReviewResult workspace={workspace} />}

        {workspace.status === "PENDING" && needsChecklist && !rejecting && (
          <FieldSet>
            <FieldLegend variant="label">Kiểm tra trước khi duyệt</FieldLegend>
            {REVIEW_CHECKLIST_ITEMS.map((item) => (
              <ChecklistRow
                key={item}
                item={item}
                checked={checklist[item]}
                disabled={busy}
                onChange={(checked) => setChecklist((current) => ({ ...current, [item]: checked }))}
              />
            ))}
          </FieldSet>
        )}

        {rejecting && <RejectForm form={form} onSubmit={(values) => void reject(values)} />}
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
            <div className="flex items-center justify-end gap-2">
              {needsChecklist && !checklistDone && (
                <span className="mr-auto text-xs text-muted-foreground">
                  Tick đủ 4 mục kiểm tra để duyệt.
                </span>
              )}
              <Button variant="outline" disabled={busy} onClick={() => setRejecting(true)}>
                <XIcon aria-hidden />
                Từ chối
              </Button>
              <Button
                disabled={busy || (needsChecklist && !checklistDone)}
                onClick={() => void approve()}
              >
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

function ChecklistRow({
  item,
  checked,
  disabled,
  onChange,
}: {
  item: ReviewChecklistItem
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}) {
  const id = `review-check-${item}`
  return (
    <Field orientation="horizontal">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onChange(value === true)}
      />
      <FieldContent>
        <FieldLabel htmlFor={id}>{REVIEW_CHECKLIST_LABELS[item]}</FieldLabel>
      </FieldContent>
    </Field>
  )
}

function ReviewResult({ workspace }: { workspace: AdminWorkspaceDetail }) {
  const approved = workspace.status === "APPROVED"
  return (
    <dl className="flex flex-col gap-3">
      <Detail label="Kết quả">
        {approved ? "Đã duyệt" : "Đã từ chối"}
        {workspace.reviewedAt && ` ${formatPostDateLong(workspace.reviewedAt)}`}
      </Detail>
      {workspace.rejectReason && (
        <Detail label="Lý do">{REJECT_REASON_LABELS[workspace.rejectReason]}</Detail>
      )}
      {workspace.reviewNote && <Detail label="Ghi chú">{workspace.reviewNote}</Detail>}
      {workspace.reviewChecklist && (
        <Detail label="Đã kiểm tra">
          <ul>
            {REVIEW_CHECKLIST_ITEMS.filter((item) => workspace.reviewChecklist?.[item]).map(
              (item) => (
                <li key={item}>✓ {REVIEW_CHECKLIST_LABELS[item]}</li>
              )
            )}
          </ul>
        </Detail>
      )}
    </dl>
  )
}

function RejectForm({
  form,
  onSubmit,
}: {
  form: ReturnType<typeof useForm<RejectFormInput, unknown, RejectFormValues>>
  onSubmit: (values: RejectFormValues) => void
}) {
  const reason = useWatch({ control: form.control, name: "rejectReason" })
  return (
    <form
      id={REJECT_FORM_ID}
      noValidate
      onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
      className="flex flex-col gap-4"
    >
      <Controller
        name="rejectReason"
        control={form.control}
        render={({ field, fieldState }) => (
          <FieldSet data-invalid={fieldState.invalid}>
            <FieldLegend variant="label">Lý do từ chối</FieldLegend>
            <RadioGroup
              name={field.name}
              value={field.value ?? null}
              onValueChange={field.onChange}
              aria-invalid={fieldState.invalid}
            >
              {REJECT_REASONS.map((value) => (
                <Field key={value} orientation="horizontal">
                  <RadioGroupItem id={`reject-${value}`} value={value} />
                  <FieldContent>
                    <FieldLabel htmlFor={`reject-${value}`}>
                      {REJECT_REASON_LABELS[value]}
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
        name="note"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>
              {reason === "OTHER" ? "Ghi chú" : "Ghi chú (không bắt buộc)"}
            </FieldLabel>
            <Textarea
              {...field}
              id={field.name}
              rows={3}
              maxLength={MAX_REVIEW_NOTE_LENGTH}
              aria-invalid={fieldState.invalid}
              placeholder="Chủ trang sẽ đọc được và có thể sửa rồi gửi lại."
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
    </form>
  )
}
