"use client"

import type { RefObject } from "react"
import {
  BoldIcon,
  Heading2Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatMarkdown, type MarkdownFormat } from "@/features/blogs/lib/markdown-format"

const BUTTONS: { format: MarkdownFormat; label: string; icon: LucideIcon; shortcut?: string }[] = [
  { format: "heading", label: "Tiêu đề mục", icon: Heading2Icon },
  { format: "bold", label: "In đậm", icon: BoldIcon, shortcut: "Ctrl+B" },
  { format: "italic", label: "In nghiêng", icon: ItalicIcon, shortcut: "Ctrl+I" },
  { format: "bullets", label: "Danh sách gạch đầu dòng", icon: ListIcon },
  { format: "numbers", label: "Danh sách đánh số", icon: ListOrderedIcon },
  { format: "link", label: "Chèn liên kết", icon: LinkIcon, shortcut: "Ctrl+K" },
]

/**
 * Applies `format` to the textarea's selection. Typing the change in with
 * `insertText` keeps the browser's undo (Ctrl+Z) and fires the same input
 * event as the keyboard, so the form sees it like any other edit.
 */
export function applyMarkdownFormat(textarea: HTMLTextAreaElement, format: MarkdownFormat) {
  const edit = formatMarkdown(textarea.value, textarea.selectionStart, textarea.selectionEnd, format)
  textarea.focus()
  textarea.setSelectionRange(edit.from, edit.to)
  // `execCommand` is deprecated but still the only way to edit a textarea with undo.
  if (!document.execCommand("insertText", false, edit.insert)) {
    textarea.setRangeText(edit.insert, edit.from, edit.to, "end")
    textarea.dispatchEvent(new Event("input", { bubbles: true }))
  }
  textarea.setSelectionRange(edit.selectionStart, edit.selectionEnd)
}

/** Ctrl/Cmd + B, I or K in the content textarea. */
export function markdownShortcut(event: React.KeyboardEvent<HTMLTextAreaElement>): MarkdownFormat | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return null
  switch (event.key.toLowerCase()) {
    case "b":
      return "bold"
    case "i":
      return "italic"
    case "k":
      return "link"
    default:
      return null
  }
}

/** Buttons that write the Markdown for the author, above the content textarea. */
export function MarkdownToolbar({
  textareaRef,
  controls,
  disabled,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>
  /** Id of the textarea the buttons edit. */
  controls: string
  disabled?: boolean
}) {
  return (
    <div
      role="toolbar"
      aria-label="Định dạng nội dung"
      aria-controls={controls}
      className="mb-1.5 flex flex-wrap items-center gap-0.5"
    >
      {BUTTONS.map(({ format, label, icon: Icon, shortcut }) => (
        <Tooltip key={format}>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={shortcut ? `${label} (${shortcut})` : label}
                disabled={disabled}
                // Keep the textarea's selection: a click would otherwise move focus first.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  if (textareaRef.current) applyMarkdownFormat(textareaRef.current, format)
                }}
              />
            }
          >
            <Icon aria-hidden />
          </TooltipTrigger>
          <TooltipContent>{shortcut ? `${label} · ${shortcut}` : label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}
