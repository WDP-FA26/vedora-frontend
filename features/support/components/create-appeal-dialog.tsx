"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ScaleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { formatPostDateLong } from "@/features/shared/lib/format"
import { useCreateSupportTicket } from "@/features/support/hooks/use-support"
import { supportErrorMessage } from "@/features/support/lib/format-formal-time"
import {
  APPEAL_REASON_CATEGORIES,
  APPEAL_REASON_LABELS,
  MAX_TICKET_MESSAGE_LENGTH,
  type AppealReasonCategory,
} from "@/features/support/schemas"
import { supportTicketPath } from "@/features/support/support-cache"

export function CreateAppealDialog({
  postId,
  subject,
  deadlineAt,
  open,
  onOpenChange,
}: {
  postId: string
  subject: string
  deadlineAt: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const createTicket = useCreateSupportTicket()
  const [reasonCategory, setReasonCategory] = useState<AppealReasonCategory>("FALSE_POSITIVE")
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmed = message.trim()
  const valid = trimmed.length >= 10 && trimmed.length <= MAX_TICKET_MESSAGE_LENGTH

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!valid || submitting) return
    setError(null)
    setSubmitting(true)
    try {
      const created = await createTicket({
        category: "CONTENT_APPEAL",
        postId,
        reasonCategory,
        message: trimmed,
      })
      toast.add({
        title: "Đã gửi hồ sơ kháng cáo",
        description: `Mã hồ sơ ${created.code}`,
      })
      setMessage("")
      onOpenChange(false)
      router.push(supportTicketPath(created.id))
    } catch (err) {
      setError(supportErrorMessage(err, "Không thể gửi kháng cáo. Vui lòng thử lại."))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              <span className="inline-flex items-center gap-2">
                <ScaleIcon aria-hidden className="size-4" />
                <span>Gửi kháng cáo cho {subject.toLowerCase()}</span>
              </span>
            </DialogTitle>
            <DialogDescription>
              Quản trị viên sẽ xem lại nguyên văn nội dung cùng giải trình của bạn. Trong thời gian
              chờ xử lý, {subject.toLowerCase()} sẽ tạm khóa chỉnh sửa và xoá.
              {deadlineAt ? ` Hạn nộp: ${formatPostDateLong(deadlineAt)}.` : ""}
            </DialogDescription>
          </DialogHeader>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-foreground">Lý do kháng cáo</legend>
            <div className="divide-y divide-border rounded-md border border-border">
              {APPEAL_REASON_CATEGORIES.map((category) => (
                <label
                  key={category}
                  className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/40"
                >
                  <input
                    type="radio"
                    name="appeal-reason"
                    value={category}
                    checked={reasonCategory === category}
                    onChange={() => setReasonCategory(category)}
                    className="size-4 accent-primary"
                  />
                  <span>{APPEAL_REASON_LABELS[category]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="appeal-message" className="text-sm font-medium text-foreground">
                Nội dung giải trình
              </label>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {trimmed.length}/{MAX_TICKET_MESSAGE_LENGTH}
              </span>
            </div>
            <Textarea
              id="appeal-message"
              rows={5}
              value={message}
              maxLength={MAX_TICKET_MESSAGE_LENGTH}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Trình bày cụ thể ngữ cảnh hoặc lý do bạn cho rằng nội dung này không vi phạm (tối thiểu 10 ký tự)."
              disabled={submitting}
            />
          </div>

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
              Gửi kháng cáo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
