"use client"

import { useState } from "react"
import { ChevronDownIcon, RotateCcwIcon } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

/** What most admins never touch: the model's general prompt, and going back to the built-in policy. */
export function AdvancedSettings({
  instructions,
  manipulationThreshold,
  manipulationEnforced,
  canReset,
  busy,
  onChange,
  onManipulationChange,
  onReset,
}: {
  instructions: string
  /** Undefined when the API does not have the setting yet. */
  manipulationThreshold: number | undefined
  manipulationEnforced: boolean
  /** False while the built-in policy is already in force. */
  canReset: boolean
  busy: boolean
  onChange: (instructions: string) => void
  onManipulationChange: (threshold: number) => void
  onReset: () => void
}) {
  const [confirmingReset, setConfirmingReset] = useState(false)

  return (
    <div className="border-t pt-4">
      <Collapsible>
        <CollapsibleTrigger render={<Button variant="action" />}>
          Nâng cao
          <ChevronDownIcon aria-hidden />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex flex-col gap-6 pt-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Hướng dẫn chung cho model (tiếng Anh)
              <Textarea
                value={instructions}
                maxLength={3000}
                onChange={(event) => onChange(event.target.value)}
                className="min-h-28"
              />
            </label>
            {manipulationThreshold !== undefined && (
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Chặn ngay nội dung chèo lái AI từ mức (%)
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round(manipulationThreshold * 100)}
                  onChange={(event) => onManipulationChange(Number(event.target.value) / 100)}
                  className="w-28"
                />
                <span className="font-normal text-muted-foreground">
                  {manipulationEnforced
                    ? "Đang áp dụng: nội dung tìm cách can thiệp vào kiểm duyệt bị từ chối ngay."
                    : "Đang chạy thử: hệ thống chỉ ghi lại, chưa từ chối bài nào vì luật này."}
                </span>
              </label>
            )}
            <div>
              <Button variant="action" disabled={busy || !canReset} onClick={() => setConfirmingReset(true)}>
                <RotateCcwIcon aria-hidden />
                Khôi phục mặc định
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <AlertDialog open={confirmingReset} onOpenChange={setConfirmingReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Khôi phục chính sách mặc định?</AlertDialogTitle>
            <AlertDialogDescription>
              Các tiêu chí, hướng dẫn và mức nghiêm ngặt đã lưu sẽ bị thay bằng bản mặc định. Thay đổi chưa lưu cũng
              mất.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Giữ nguyên</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmingReset(false)
                onReset()
              }}
            >
              Khôi phục
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
