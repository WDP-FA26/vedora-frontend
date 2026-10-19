"use client"

import { useRef, useState } from "react"
import { createPortal } from "react-dom"
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from "@lexical/list"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { INSERT_HORIZONTAL_RULE_COMMAND } from "@lexical/react/LexicalHorizontalRuleNode"
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin"
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text"
import { $setBlocksType } from "@lexical/selection"
import { $createParagraphNode, $getSelection, $isRangeSelection, type ElementNode, type LexicalEditor } from "lexical"
import {
  Heading2Icon,
  Heading3Icon,
  ImageIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  PilcrowIcon,
  QuoteIcon,
  VideoIcon,
  type LucideIcon,
} from "lucide-react"
import { cn } from "cn"

import { Spinner } from "@/components/ui/spinner"
import { useMediaInsert } from "@/features/blogs/editor/use-media-insert"
import { BLOG_IMAGE_TYPES } from "@/features/blogs/schemas"

/** What an option can reach besides the editor: the hidden file pickers. */
type Pickers = { image: () => void; video: () => void }

class SlashOption extends MenuOption {
  constructor(
    readonly title: string,
    readonly hint: string,
    readonly Glyph: LucideIcon,
    readonly keywords: string[],
    readonly run: (editor: LexicalEditor, pickers: Pickers) => void
  ) {
    super(title)
  }
}

function setBlock(editor: LexicalEditor, create: () => ElementNode) {
  editor.update(() => {
    const selection = $getSelection()
    if ($isRangeSelection(selection)) $setBlocksType(selection, create)
  })
}

const ALL_OPTIONS = [
  new SlashOption("Văn bản", "Đoạn văn thường", PilcrowIcon, ["text", "van ban", "paragraph"], (e) =>
    setBlock(e, () => $createParagraphNode())
  ),
  new SlashOption("Tiêu đề lớn", "Chia bài thành các phần", Heading2Icon, ["h2", "heading", "tieu de"], (e) =>
    setBlock(e, () => $createHeadingNode("h2"))
  ),
  new SlashOption("Tiêu đề nhỏ", "Chia nhỏ một phần", Heading3Icon, ["h3", "heading", "tieu de"], (e) =>
    setBlock(e, () => $createHeadingNode("h3"))
  ),
  new SlashOption("Danh sách", "Nguyên liệu, ý chính", ListIcon, ["bullet", "list", "danh sach"], (e) =>
    e.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
  ),
  new SlashOption("Danh sách đánh số", "Các bước làm", ListOrderedIcon, ["number", "steps", "buoc"], (e) =>
    e.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
  ),
  new SlashOption("Trích dẫn", "Nhấn mạnh một câu", QuoteIcon, ["quote", "trich dan"], (e) =>
    setBlock(e, () => $createQuoteNode())
  ),
  new SlashOption("Đường kẻ", "Ngăn cách các phần", MinusIcon, ["divider", "hr", "duong ke"], (e) =>
    e.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined)
  ),
  new SlashOption("Ảnh", "Tải ảnh lên", ImageIcon, ["image", "photo", "anh"], (_e, pick) => pick.image()),
  new SlashOption("Video", "Tải video lên", VideoIcon, ["video", "clip"], (_e, pick) => pick.video()),
]

/** A hidden file input, opened from the menu with `ref.current.click()`. */
function FilePicker({
  ref,
  accept,
  multiple,
  onFiles,
}: {
  ref: React.Ref<HTMLInputElement>
  accept: string
  multiple?: boolean
  onFiles: (files: File[]) => void
}) {
  return (
    <input
      ref={ref}
      type="file"
      accept={accept}
      multiple={multiple}
      hidden
      onChange={(event) => {
        onFiles([...(event.target.files ?? [])])
        event.target.value = ""
      }}
    />
  )
}

/**
 * The `/` menu: type `/` on an empty line (or after a space) to turn it into a
 * heading, list, quote or divider, or to add an image or video. Also owns the
 * media uploads, so pasted and dropped files land through the same path.
 */
export function SlashMenuPlugin() {
  const [editor] = useLexicalComposerContext()
  const { progress, insertFiles } = useMediaInsert()
  const [query, setQuery] = useState<string | null>(null)
  const imageInput = useRef<HTMLInputElement>(null)
  const videoInput = useRef<HTMLInputElement>(null)
  const trigger = useBasicTypeaheadTriggerMatch("/", { minLength: 0 })

  const needle = (query ?? "").trim().toLowerCase()
  const options = needle
    ? ALL_OPTIONS.filter((option) =>
        [option.title.toLowerCase(), ...option.keywords].some((word) => word.includes(needle))
      )
    : ALL_OPTIONS

  return (
    <>
      <LexicalTypeaheadMenuPlugin<SlashOption>
        onQueryChange={setQuery}
        triggerFn={trigger}
        options={options}
        onSelectOption={(option, nodeToRemove, closeMenu) => {
          // Drop the "/query" text first, then apply to the line it was on.
          editor.update(() => nodeToRemove?.remove(), { discrete: true })
          option.run(editor, {
            image: () => imageInput.current?.click(),
            video: () => videoInput.current?.click(),
          })
          closeMenu()
        }}
        menuRenderFn={(anchor, { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }) =>
          anchor.current && options.length > 0
            ? createPortal(
                <ul
                  role="listbox"
                  aria-label="Chèn nội dung"
                  className="z-50 mt-1 w-64 overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg"
                >
                  {options.map((option, index) => (
                    <li key={option.key} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={selectedIndex === index}
                        ref={option.setRefElement}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        onClick={() => selectOptionAndCleanUp(option)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left",
                          selectedIndex === index && "bg-muted"
                        )}
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                          <option.Glyph className="size-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{option.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">{option.hint}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>,
                anchor.current
              )
            : null
        }
      />
      <FilePicker ref={imageInput} accept={BLOG_IMAGE_TYPES.join(",")} multiple onFiles={insertFiles} />
      <FilePicker ref={videoInput} accept="video/*" onFiles={insertFiles} />
      {progress && (
        <p
          role="status"
          className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full border border-border bg-popover px-3 py-1.5 text-xs text-muted-foreground shadow-md"
        >
          <Spinner className="size-3.5" />
          {progress.percent === null ? "Đang tải ảnh…" : `Đang tải video ${Math.round(progress.percent)}%`}
        </p>
      )}
    </>
  )
}
