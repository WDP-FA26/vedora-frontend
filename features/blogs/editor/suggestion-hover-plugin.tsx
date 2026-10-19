"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { CheckIcon, XIcon } from "lucide-react"

import { $resolveSuggestion } from "@/features/blogs/editor/suggestions"

type Hover = { group: string; left: number; top: number }

const HIDE_DELAY_MS = 180
const CHIP_OFFSET_PX = 30

/**
 * Hover over a proposed change to get its "Chấp nhận" / "Bỏ" chips, placed
 * above where the change starts. They stay while the pointer is on the change
 * or on the chips, and go away shortly after it leaves both.
 */
export function SuggestionHoverPlugin() {
  const [editor] = useLexicalComposerContext()
  const [hover, setHover] = useState<Hover | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** The group whose chips are showing, so repeated `mouseover`s cost nothing. */
  const shown = useRef<string | null>(null)

  function hide() {
    shown.current = null
    setHover(null)
  }

  useEffect(() => {
    function cancelHide() {
      if (hideTimer.current) clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
    function scheduleHide() {
      cancelHide()
      hideTimer.current = setTimeout(() => hide(), HIDE_DELAY_MS)
    }
    function onOver(event: MouseEvent) {
      const mark = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-suggestion-group]")
      if (!mark) return
      cancelHide()
      const group = mark.dataset.suggestionGroup!
      // Moving across the parts of one change keeps the chips where they are.
      if (shown.current === group) return
      shown.current = group
      // The first mark of the group, so the chips don't jump between its parts.
      const root = event.currentTarget as HTMLElement
      const first = root.querySelector<HTMLElement>(`[data-suggestion-group="${CSS.escape(group)}"]`) ?? mark
      const rect = first.getBoundingClientRect()
      setHover({ group, left: rect.left, top: Math.max(rect.top - CHIP_OFFSET_PX, 8) })
    }
    function onOut(event: MouseEvent) {
      if ((event.target as HTMLElement | null)?.closest("[data-suggestion-group]")) scheduleHide()
    }
    return editor.registerRootListener((root, previous) => {
      previous?.removeEventListener("mouseover", onOver)
      previous?.removeEventListener("mouseout", onOut)
      root?.addEventListener("mouseover", onOver)
      root?.addEventListener("mouseout", onOut)
    })
  }, [editor])

  if (!hover) return null

  function resolve(decision: "accept" | "discard") {
    const { group } = hover!
    hide()
    editor.update(() => $resolveSuggestion(group, decision))
  }

  return createPortal(
    <div
      role="toolbar"
      aria-label="Đề xuất của trợ lý"
      style={{ left: hover.left, top: hover.top }}
      onMouseEnter={() => hideTimer.current && clearTimeout(hideTimer.current)}
      onMouseLeave={hide}
      className="fixed z-50 flex items-center gap-1 rounded-full border border-border bg-popover p-0.5 text-xs shadow-md"
    >
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => resolve("accept")}
        className="flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-1 font-medium text-green-700 hover:bg-green-500/25 dark:text-green-300"
      >
        <CheckIcon className="size-3" />
        Chấp nhận
      </button>
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => resolve("discard")}
        className="flex items-center gap-1 rounded-full px-2 py-1 font-medium text-muted-foreground hover:bg-muted"
      >
        <XIcon className="size-3" />
        Bỏ
      </button>
    </div>,
    document.body
  )
}
