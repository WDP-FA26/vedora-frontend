"use client"

import { CheckIcon, GlobeIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

export function WebSearchConsentCard({
  reason,
  disabled,
  onAnswer,
}: {
  reason: string
  disabled: boolean
  onAnswer: (approved: boolean) => void
}) {
  return (
    <section
      aria-label="Xin phép tìm trên web"
      className="mt-2 flex flex-col gap-3 rounded-xl border border-border bg-card p-3 text-sm"
    >
      <div className="flex items-start gap-2">
        <GlobeIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-semibold">Trợ lý muốn tìm thêm trên web</p>
          <p className="text-muted-foreground">{reason}</p>
        </div>
      </div>
      <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
        Thông tin trên web có thể sai, đã cũ hoặc không thống nhất giữa các nguồn, và Vedora không kiểm chứng. Trợ lý sẽ ghi rõ phần nào lấy từ web và kèm nguồn để bạn xem lại. Món trong thực đơn vẫn chỉ lấy từ Vedora.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={disabled} onClick={() => onAnswer(true)}>
          <CheckIcon aria-hidden /> Cho phép trong đoạn chat này
        </Button>
        <Button size="sm" variant="outline" disabled={disabled} onClick={() => onAnswer(false)}>
          <XIcon aria-hidden /> Không
        </Button>
      </div>
    </section>
  )
}
