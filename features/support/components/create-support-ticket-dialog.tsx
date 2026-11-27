"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LifeBuoyIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import {
  TicketImagePicker,
  releasePickedImages,
  type PickedImage,
} from "@/features/support/components/ticket-image-picker"
import {
  useCreateSupportTicket,
  useUploadSupportImages,
} from "@/features/support/hooks/use-support"
import { supportErrorMessage } from "@/features/support/lib/format-formal-time"
import {
  MAX_TICKET_MESSAGE_LENGTH,
  MAX_TICKET_REFERENCE_LENGTH,
  MAX_TICKET_SUBJECT_LENGTH,
  NON_APPEAL_CATEGORIES,
  SUPPORT_CATEGORY_LABELS,
  type SupportTicketCategory,
} from "@/features/support/schemas"
import { supportTicketPath } from "@/features/support/support-cache"

type GeneralCategory = Exclude<SupportTicketCategory, "CONTENT_APPEAL">

export type SupportTicketPrefill = {
  category: GeneralCategory
  subject: string
  referenceCode: string
  message: string
}

const CATEGORY_HINTS: Record<GeneralCategory, string> = {
  PAYMENT_ISSUE: "Giao dịch chuyển khoản, kích hoạt gói hoặc hóa đơn.",
  VERIFICATION: "Hồ sơ xác minh chuyên gia, bằng cấp hoặc trạng thái duyệt.",
  GENERAL: "Lỗi kỹ thuật, tài khoản hoặc góp ý khác.",
}

const REFERENCE_PLACEHOLDERS: Partial<Record<GeneralCategory, string>> = {
  PAYMENT_ISSUE: "Ví dụ: mã giao dịch SePay hoặc mã đơn hàng (không bắt buộc)",
  VERIFICATION: "Ví dụ: mã hồ sơ hoặc số chứng chỉ liên quan (không bắt buộc)",
}

export function CreateSupportTicketDialog({
  open,
  onOpenChange,
  initialValues,
  description,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialValues?: SupportTicketPrefill
  description?: string
  onCreated?: (ticketId: string) => void
}) {
  const router = useRouter()
  const createTicket = useCreateSupportTicket()
  const uploadImages = useUploadSupportImages()
  const [images, setImages] = useState<PickedImage[]>([])
  const [category, setCategory] = useState<GeneralCategory>(
    initialValues?.category ?? "PAYMENT_ISSUE"
  )
  const [subject, setSubject] = useState(initialValues?.subject ?? "")
  const [referenceCode, setReferenceCode] = useState(initialValues?.referenceCode ?? "")
  const [message, setMessage] = useState(initialValues?.message ?? "")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmedSubject = subject.trim()
  const trimmedMessage = message.trim()
  const trimmedReference = referenceCode.trim()
  const showReference = category === "PAYMENT_ISSUE" || category === "VERIFICATION"

  const valid =
    trimmedSubject.length >= 5 &&
    trimmedSubject.length <= MAX_TICKET_SUBJECT_LENGTH &&
    trimmedMessage.length >= 10 &&
    trimmedMessage.length <= MAX_TICKET_MESSAGE_LENGTH

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!valid || submitting) return
    setError(null)
    setSubmitting(true)
    try {
      const attachmentIds = await uploadImages(images.map((image) => image.file))
      const created = await createTicket({
        category,
        subject: trimmedSubject,
        message: trimmedMessage,
        ...(showReference && trimmedReference ? { referenceCode: trimmedReference } : {}),
        ...(attachmentIds.length > 0 ? { attachmentIds } : {}),
      })
      toast.add({
        title: "Đã tạo hồ sơ hỗ trợ",
        description: `Mã hồ sơ ${created.code}`,
      })
      setSubject("")
      setReferenceCode("")
      setMessage("")
      releasePickedImages(images)
      setImages([])
      if (onCreated) onCreated(created.id)
      else {
        onOpenChange(false)
        router.push(supportTicketPath(created.id))
      }
    } catch (err) {
      setError(supportErrorMessage(err, "Không thể tạo hồ sơ hỗ trợ. Vui lòng thử lại."))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              <span className="inline-flex items-center gap-2">
                <LifeBuoyIcon aria-hidden className="size-4" />
                <span>Tạo yêu cầu hỗ trợ</span>
              </span>
            </DialogTitle>
            <DialogDescription>
              {description ??
                "Chọn danh mục phù hợp và mô tả chi tiết vấn đề. Để kháng cáo bài viết hoặc blog bị từ chối/gỡ bỏ, hãy mở trực tiếp bài viết đó và chọn Gửi kháng cáo."}
            </DialogDescription>
          </DialogHeader>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-foreground">Danh mục hỗ trợ</legend>
            <div className="divide-y divide-border rounded-md border border-border">
              {NON_APPEAL_CATEGORIES.map((item) => (
                <label
                  key={item}
                  className="flex cursor-pointer items-start gap-2.5 px-3 py-2 text-sm hover:bg-muted/40"
                >
                  <input
                    type="radio"
                    name="support-category"
                    value={item}
                    checked={category === item}
                    onChange={() => setCategory(item)}
                    className="mt-0.5 size-4 accent-primary"
                  />
                  <span className="flex flex-col">
                    <span className="font-medium text-foreground">
                      {SUPPORT_CATEGORY_LABELS[item]}
                    </span>
                    <span className="text-xs text-muted-foreground">{CATEGORY_HINTS[item]}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="support-subject" className="text-sm font-medium text-foreground">
                Tiêu đề yêu cầu
              </label>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {trimmedSubject.length}/{MAX_TICKET_SUBJECT_LENGTH}
              </span>
            </div>
            <Input
              id="support-subject"
              value={subject}
              maxLength={MAX_TICKET_SUBJECT_LENGTH}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Tóm tắt ngắn gọn vấn đề của bạn (tối thiểu 5 ký tự)"
              disabled={submitting}
            />
          </div>

          {showReference && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="support-reference" className="text-sm font-medium text-foreground">
                Mã tham chiếu
              </label>
              <Input
                id="support-reference"
                value={referenceCode}
                maxLength={MAX_TICKET_REFERENCE_LENGTH}
                onChange={(event) => setReferenceCode(event.target.value)}
                placeholder={REFERENCE_PLACEHOLDERS[category]}
                disabled={submitting}
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="support-message" className="text-sm font-medium text-foreground">
                Mô tả chi tiết
              </label>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {trimmedMessage.length}/{MAX_TICKET_MESSAGE_LENGTH}
              </span>
            </div>
            <Textarea
              id="support-message"
              rows={5}
              value={message}
              maxLength={MAX_TICKET_MESSAGE_LENGTH}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Cung cấp thời gian xảy ra sự việc và thông tin liên quan để quản trị viên hỗ trợ nhanh nhất (tối thiểu 10 ký tự)."
              disabled={submitting}
            />
          </div>

          <TicketImagePicker images={images} onChange={setImages} disabled={submitting} />

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              Huỷ
            </Button>
            <Button type="submit" disabled={!valid || submitting}>
              {submitting && <Spinner aria-hidden />}
              Gửi yêu cầu
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
