"use client"

import { useEffect, useState } from "react"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { $getSelection, $isParagraphNode, $isRangeSelection, $isRootNode } from "lexical"

export function EmptyLineHintPlugin() {
  const [editor] = useLexicalComposerContext()
  const [focused, setFocused] = useState(false)
  const [box, setBox] = useState<{ top: number; left: number } | null>(null)

  useEffect(
    () =>
      editor.registerUpdateListener(({ editorState }) => {
        const key = editorState.read(() => {
          const selection = $getSelection()
          if (!$isRangeSelection(selection) || !selection.isCollapsed()) return null
          const node = selection.anchor.getNode()
          const blank = $isParagraphNode(node) && node.getChildrenSize() === 0 && $isRootNode(node.getParent())
          return blank ? node.getKey() : null
        })
        const element = key ? editor.getElementByKey(key) : null
        const top = element?.offsetTop
        const left = element?.offsetLeft
        setBox((previous) =>
          top === undefined || left === undefined
            ? null
            : previous?.top === top && previous.left === left
              ? previous
              : { top, left }
        )
      }),
    [editor]
  )

  useEffect(() => {
    const on = () => setFocused(true)
    const off = () => setFocused(false)
    return editor.registerRootListener((root, previous) => {
      previous?.removeEventListener("focus", on)
      previous?.removeEventListener("blur", off)
      root?.addEventListener("focus", on)
      root?.addEventListener("blur", off)
      setFocused(root !== null && root === document.activeElement)
    })
  }, [editor])

  if (!focused || !box) return null
  return (
    <p
      aria-hidden
      style={{ top: box.top, left: box.left }}
      className="pointer-events-none absolute flex items-center gap-1.5 leading-7 text-muted-foreground/60 select-none"
    >
      Nhập
      <kbd className="rounded border border-border bg-muted/60 px-1.5 text-sm leading-5 text-muted-foreground">/</kbd>
      để chọn lệnh…
    </p>
  )
}
