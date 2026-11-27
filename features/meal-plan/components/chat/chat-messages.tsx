"use client"

import type { ReactNode } from "react"
import { Undo2Icon } from "lucide-react"

import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import { Message, MessageContent, MessageHeader } from "@/components/ui/message"
import { Spinner } from "@/components/ui/spinner"
import { DAY_LABELS, weekStartRangeLabel } from "@/features/meal-plan/lib/dates"
import type { Weekday } from "@/features/meal-plan/schemas/meal-plan.schema"
import { LogoMark } from "@/features/shared/components/wordmark"

export function AssistantMessage({ children }: { children: ReactNode }) {
  return (
    <Message>
      <MessageContent>
        <MessageHeader>
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <LogoMark className="size-6" /> Trợ lý Vedora
          </span>
        </MessageHeader>
        {children}
      </MessageContent>
    </Message>
  )
}

export function UserMessage({
  text,
  canRewind,
  rewinding,
  onRewind,
}: {
  text: string
  canRewind: boolean
  rewinding: boolean
  onRewind: () => void
}) {
  return (
    <Message align="end" className="group/user">
      <MessageContent>
        <Bubble align="end">
          <BubbleContent>{text}</BubbleContent>
        </Bubble>
        <div
          data-rewinding={rewinding}
          className="flex justify-end opacity-0 transition-opacity group-hover/user:opacity-100 focus-within:opacity-100 data-[rewinding=true]:opacity-100 max-lg:opacity-100 motion-reduce:transition-none"
        >
          <Button
            variant="ghost"
            size="xs"
            disabled={!canRewind}
            onClick={onRewind}
            aria-label="Quay lại trước tin nhắn này"
          >
            {rewinding ? <Spinner aria-hidden /> : <Undo2Icon aria-hidden />}
            Quay lại
          </Button>
        </div>
      </MessageContent>
    </Message>
  )
}

export function rewindSummary(
  weeks: { weekStart: string; restored: Weekday[]; skipped: Weekday[]; droppedDishes: number }[]
) {
  let restored = 0
  let dropped = 0
  const skipped: string[] = []
  for (const week of weeks) {
    restored += week.restored.length
    dropped += week.droppedDishes
    for (const day of week.skipped) {
      skipped.push(`${DAY_LABELS[day]} (tuần ${weekStartRangeLabel(week.weekStart)})`)
    }
  }
  let summary = "Đã quay lại. Thực đơn không có thay đổi nào cần khôi phục."
  if (restored > 0) summary = `Đã quay lại và khôi phục thực đơn của ${restored} ngày.`
  if (skipped.length > 0) summary += ` ${skipped.join(", ")} đã qua nên giữ nguyên.`
  if (dropped > 0) {
    summary += ` ${dropped} món cũ đã bị xóa hoặc nay nằm trong danh sách kiêng nên không thêm lại.`
  }
  return summary
}
