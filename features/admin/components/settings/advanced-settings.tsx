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
import { Textarea } from "@/components/ui/textarea"

/** What most admins never touch: the model's general prompt, and going back to the built-in policy. */
export function AdvancedSettings({
  instructions,
  canReset,
  busy,
  onChange,
  onReset,
}: {
  instructions: string
  /** False while the built-in policy is already in force. */
  canReset: boolean
  busy: boolean
  onChange: (instructions: string) => void
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
