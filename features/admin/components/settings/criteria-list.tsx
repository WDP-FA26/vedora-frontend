"use client"

import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { MAX_CHOICES } from "@/features/admin/components/settings/policy-validation"
import type { ModerationChoice } from "@/features/admin/schemas"

/** What the check looks for: one line per criterion, with the built-in "Không vi phạm" last. */
export function CriteriaList({
  choices,
  allowDescription,
  onAdd,
  onEdit,
  onEditAllow,
  onRemove,
}: {
  choices: ModerationChoice[]
  allowDescription: string
  onAdd: () => void
  onEdit: (choice: ModerationChoice) => void
  onEditAllow: () => void
  onRemove: (choice: ModerationChoice) => void
}) {
  return (
    <section aria-labelledby="criteria-title" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h2 id="criteria-title" className="text-lg font-semibold">
          Tiêu chí kiểm duyệt
        </h2>
        <Button variant="outline" disabled={choices.length >= MAX_CHOICES} onClick={onAdd}>
          <PlusIcon aria-hidden />
          Thêm tiêu chí
        </Button>
      </div>
      <ul className="divide-y">
        {choices.map((choice) => (
          <li key={choice.key} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{choice.label}</p>
              <p className="line-clamp-1 text-sm text-muted-foreground">{choice.description}</p>
            </div>
            <Button
              variant="action"
              size="icon-sm"
              aria-label={`Sửa tiêu chí ${choice.label}`}
              onClick={() => onEdit(choice)}
            >
              <PencilIcon aria-hidden />
            </Button>
            <Button
              variant="action"
              size="icon-sm"
              aria-label={`Xoá tiêu chí ${choice.label}`}
              disabled={choices.length <= 1}
              onClick={() => onRemove(choice)}
            >
              <Trash2Icon aria-hidden />
            </Button>
          </li>
        ))}
        <li className="flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 font-medium">
              Không vi phạm
              <span className="text-xs font-normal text-muted-foreground">Mặc định, không xoá được</span>
            </p>
            <p className="line-clamp-1 text-sm text-muted-foreground">{allowDescription}</p>
          </div>
          <Button variant="action" size="icon-sm" aria-label="Sửa mô tả Không vi phạm" onClick={onEditAllow}>
            <PencilIcon aria-hidden />
          </Button>
        </li>
      </ul>
    </section>
  )
}
