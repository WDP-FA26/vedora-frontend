"use client"

import { useState } from "react"

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
import { Textarea } from "@/components/ui/textarea"
import { criterionProblems, slugify, uniqueKey } from "@/features/admin/components/settings/policy-validation"
import type { ModerationChoice } from "@/features/admin/schemas"

/** What the dialog edits: a violation criterion, or the built-in "Không vi phạm" (description only). */
export type CriterionTarget = ModerationChoice | "new" | "allow"

/** Adds or edits one criterion: its name, what it covers, and the wording authors see. */
export function CriterionDialog({
  target,
  allowDescription,
  takenKeys,
  onClose,
  onSubmit,
  onSubmitAllow,
}: {
  target: ModerationChoice | "new" | "allow"
  allowDescription: string
  takenKeys: ReadonlySet<string>
  onClose: () => void
  onSubmit: (choice: ModerationChoice) => void
  onSubmitAllow: (description: string) => void
}) {
  const isAllow = target === "allow"
  const initial = typeof target === "object" ? target : null
  const [label, setLabel] = useState(initial?.label ?? "")
  const [description, setDescription] = useState(isAllow ? allowDescription : (initial?.description ?? ""))
  const [reasonText, setReasonText] = useState(initial?.reasonText ?? "")
  const [touched, setTouched] = useState(false)

  // Unless set by hand, the wording authors see is the name in lowercase.
  const reason = reasonText.trim() || label.trim().toLowerCase()
  const problems = isAllow
    ? description.trim().length >= 10 && description.trim().length <= 800
      ? []
      : ["Mô tả cần 10–800 ký tự."]
    : criterionProblems({ label, description, reasonText: reason })

  function submit() {
    setTouched(true)
    if (problems.length > 0) return
    if (isAllow) {
      onSubmitAllow(description.trim())
      return
    }
    const key = initial?.key ?? uniqueKey(slugify(label), takenKeys)
    onSubmit({ key, label: label.trim(), description: description.trim(), reasonText: reason })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isAllow ? "Sửa mô tả “Không vi phạm”" : initial ? "Sửa tiêu chí" : "Thêm tiêu chí"}
          </DialogTitle>
          <DialogDescription>
            {isAllow
              ? "Nội dung thế nào thì được cho qua, kể cả khi model không chắc."
              : "Nội dung thuộc tiêu chí này sẽ bị chặn hoặc giữ lại để admin xem."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {!isAllow && (
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Tên tiêu chí
              <Input
                value={label}
                maxLength={40}
                placeholder="Ví dụ: Thông tin sai lệch về sức khoẻ"
                onChange={(event) => setLabel(event.target.value)}
                autoFocus
              />
            </label>
          )}
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {isAllow ? "Nội dung nào được cho qua?" : "Nội dung nào thì vi phạm?"}
            <Textarea
              value={description}
              maxLength={800}
              placeholder={
                isAllow
                  ? "Ví dụ: Công thức, ảnh món ăn, đánh giá, ý kiến cá nhân, và mọi thứ không chắc chắn."
                  : "Ví dụ: Khẳng định một món ăn chữa khỏi bệnh nặng, hoặc khuyên bỏ thuốc đang dùng."
              }
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-24"
              autoFocus={isAllow}
            />
          </label>
          {!isAllow && (
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Lý do báo cho tác giả
              <Input
                value={reasonText}
                maxLength={120}
                placeholder={label.trim().toLowerCase() || "Mặc định là tên tiêu chí"}
                onChange={(event) => setReasonText(event.target.value)}
              />
              <span className="text-xs font-normal text-muted-foreground">
                Hiện sau “vi phạm tiêu chuẩn cộng đồng: ”.
              </span>
            </label>
          )}
          {touched && problems.length > 0 && (
            <ul role="alert" className="list-disc pl-5 text-sm text-destructive">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={submit}>Xong</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
