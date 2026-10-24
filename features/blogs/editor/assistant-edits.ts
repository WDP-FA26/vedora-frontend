import { $generateNodesFromMarkdownString } from "@lexical/markdown"
import { $isListItemNode, $isListNode } from "@lexical/list"
import {
  $createRangeSelection,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isDecoratorNode,
  $isElementNode,
  $isLineBreakNode,
  $isParagraphNode,
  $isRangeSelection,
  $isRootNode,
  $isTextNode,
  $nodesOfType,
  type ElementNode,
  type LexicalNode,
  type PointType,
  type RangeSelection,
} from "lexical"

import { $createMediaNode, MediaNode } from "@/features/blogs/editor/media-node"
import {
  $createSuggestionNode,
  $isSuggestionNode,
  $markAsInsertion,
} from "@/features/blogs/editor/suggestions"
import { BLOG_TRANSFORMERS } from "@/features/blogs/editor/transformers"

/**
 * The writing assistant's editor tools, applied as suggestions the author
 * accepts or discards (see `suggestions.tsx`). Each `$` function runs inside
 * `editor.update` and returns the reason it could not apply, or `null`.
 * The agent quotes the draft as Markdown, so quoted passages are matched
 * against the editor's text with the Markdown syntax removed.
 */

export type EditError = "NO_SELECTION" | "NOT_FOUND" | "AMBIGUOUS" | "STALE"
export type InsertPosition = "cursor" | "end" | "after"

type Point = { key: string; offset: number; type: "text" | "element" }

/** Where the author was when they sent the message. */
export type Captured = {
  selection: { anchor: Point; focus: Point; text: string } | null
  /** The top-level block holding the caret. */
  caretBlock: string | null
}

const point = ({ key, offset, type }: PointType): Point => ({ key, offset, type })

export function $captureSelection(): Captured {
  const selection = $getSelection()
  if (!$isRangeSelection(selection)) return { selection: null, caretBlock: null }
  const anchor = selection.anchor.getNode()
  const caretBlock = $isRootNode(anchor) ? null : (anchor.getTopLevelElement()?.getKey() ?? null)
  const text = selection.getTextContent()
  if (selection.isCollapsed() || text.trim() === "") return { selection: null, caretBlock }
  return { selection: { anchor: point(selection.anchor), focus: point(selection.focus), text }, caretBlock }
}

/** The captured selection again, if the text it covered is still there unchanged. */
function $restore(captured: NonNullable<Captured["selection"]>): RangeSelection | null {
  for (const { key, offset } of [captured.anchor, captured.focus]) {
    const node = $getNodeByKey(key)
    if (!node?.isAttached()) return null
    const size = $isTextNode(node)
      ? node.getTextContentSize()
      : $isElementNode(node)
        ? node.getChildrenSize()
        : -1
    if (offset > size) return null
  }
  const selection = $createRangeSelection()
  selection.anchor.set(captured.anchor.key, captured.anchor.offset, captured.anchor.type)
  selection.focus.set(captured.focus.key, captured.focus.offset, captured.focus.type)
  return selection.getTextContent() === captured.text ? selection : null
}

function $insideSuggestion(node: LexicalNode) {
  for (let current: LexicalNode | null = node; current; current = current.getParent()) {
    if ($isSuggestionNode(current)) return true
  }
  return false
}

/** New blocks from Markdown, without media: images go through `insertImage`. */
function $blocksFrom(markdown: string) {
  const text = markdown.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\n{3,}/g, "\n\n")
  return $generateNodesFromMarkdownString(text, BLOG_TRANSFORMERS).filter(
    (node) => !$isDecoratorNode(node)
  )
}

function $insertBlocksAfter(anchor: LexicalNode | null, nodes: LexicalNode[]) {
  if (!anchor) {
    $getRoot().append(...nodes)
    return
  }
  let previous = anchor
  for (const node of nodes) {
    previous.insertAfter(node)
    previous = node
  }
  // a blank line the author left for the assistant
  if ($isParagraphNode(anchor) && anchor.isEmpty()) anchor.remove()
}

/**
 * Strikes out the text in `selection` and proposes `markdown` in its place:
 * inline when one paragraph replaces part of one block, otherwise as new
 * blocks after the last block touched.
 */
function $suggestReplacement(selection: RangeSelection, markdown: string, group: string): EditError | null {
  if (selection.getNodes().some($insideSuggestion)) return "STALE"
  const [start, end] = selection.isBackward()
    ? [selection.focus, selection.anchor]
    : [selection.anchor, selection.focus]
  const startBlock = start.getNode().getTopLevelElementOrThrow()
  const endBlock = end.getNode().getTopLevelElementOrThrow()

  const extracted = selection.extract()
  const keys = new Set(extracted.map((node) => node.getKey()))
  const inline = extracted.filter((node) => {
    if (!($isTextNode(node) || $isLineBreakNode(node) || ($isElementNode(node) && node.isInline()))) return false
    const parent = node.getParent()
    return !(parent && parent.isInline() && keys.has(parent.getKey()))
  })
  if (inline.length === 0) return "NO_SELECTION"

  // wrap each run of neighbouring nodes in one mark
  let last: ElementNode | null = null
  for (const node of inline) {
    if (last && node.getPreviousSibling()?.is(last)) {
      last.append(node)
      continue
    }
    const mark = $createSuggestionNode("delete", group)
    node.insertBefore(mark)
    mark.append(node)
    last = mark
  }

  if (markdown.trim() === "") return null
  const nodes = $blocksFrom(markdown)
  const [only] = nodes
  if (startBlock.is(endBlock) && nodes.length === 1 && $isParagraphNode(only)) {
    const mark = $createSuggestionNode("insert", group)
    only.getChildren().forEach((child) => mark.append(child))
    last!.insertAfter(mark)
  } else {
    $markAsInsertion(nodes, group)
    $insertBlocksAfter(endBlock, nodes)
  }
  return null
}

export function $applyReplaceSelection(captured: Captured, markdown: string, group: string): EditError | null {
  if (!captured.selection) return "NO_SELECTION"
  const selection = $restore(captured.selection)
  return selection ? $suggestReplacement(selection, markdown, group) : "STALE"
}

/** Markdown as the editor shows it: no emphasis marks, link targets or block markers. */
export function plainText(markdown: string) {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\\([\\`*_{}[\]()#+\-.!>~])/g, "$1")
    .replace(/(\*\*|__|~~|\*|_|`)/g, "")
    .replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/gm, "")
}

/** Paragraphs, headings, quotes and list items, in document order. */
function $textBlocks(): ElementNode[] {
  const blocks: ElementNode[] = []
  function visit(node: LexicalNode) {
    if ($isListNode(node)) node.getChildren().forEach(visit)
    else if ($isListItemNode(node)) {
      if (node.getChildren().some($isListNode)) node.getChildren().forEach(visit)
      else blocks.push(node)
    } else if ($isElementNode(node) && !node.isInline()) blocks.push(node)
  }
  $getRoot().getChildren().forEach(visit)
  return blocks
}

type Passage = { first: ElementNode; start: number; last: ElementNode; end: number }

/** The one place `quote` appears in the draft, possibly across blocks. */
function $findPassage(quote: string): Passage | EditError {
  const lines = plainText(quote)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length === 0) return "NOT_FOUND"
  const blocks = $textBlocks()
  const texts = blocks.map((block) => block.getTextContent())
  const found: Passage[] = []

  if (lines.length === 1) {
    const [line] = lines
    texts.forEach((text, index) => {
      for (let at = text.indexOf(line); at !== -1; at = text.indexOf(line, at + 1)) {
        found.push({ first: blocks[index], start: at, last: blocks[index], end: at + line.length })
      }
    })
  } else {
    const head = lines[0]
    const tail = lines[lines.length - 1]
    const middle = lines.slice(1, -1)
    for (let index = 0; index + lines.length <= blocks.length; index++) {
      const first = texts[index].trimEnd()
      const lastText = texts[index + lines.length - 1].trimStart()
      if (!first.endsWith(head) || !lastText.startsWith(tail)) continue
      if (!middle.every((line, offset) => texts[index + 1 + offset].trim() === line)) continue
      const last = texts[index + lines.length - 1]
      found.push({
        first: blocks[index],
        start: first.length - head.length,
        last: blocks[index + lines.length - 1],
        end: last.length - lastText.length + tail.length,
      })
    }
  }
  if (found.length === 0) return "NOT_FOUND"
  return found.length === 1 ? found[0] : "AMBIGUOUS"
}

/** A text point `offset` characters into `block`'s text. */
function pointIn(block: ElementNode, offset: number, edge: "start" | "end"): Point | null {
  let seen = 0
  let lastText: Point | null = null
  for (const node of block.getAllTextNodes()) {
    // line breaks sit between text nodes and count as one character
    const before = node.getPreviousSibling()
    if (before && $isLineBreakNode(before)) seen += 1
    const size = node.getTextContentSize()
    const inside = edge === "start" ? offset < seen + size : offset <= seen + size
    if (inside && offset >= seen) return { key: node.getKey(), offset: offset - seen, type: "text" }
    seen += size
    lastText = { key: node.getKey(), offset: size, type: "text" }
  }
  return offset === seen ? lastText : null
}

function $selectPassage({ first, start, last, end }: Passage): RangeSelection | null {
  const from = pointIn(first, start, "start")
  const to = pointIn(last, end, "end")
  if (!from || !to) return null
  const selection = $createRangeSelection()
  selection.anchor.set(from.key, from.offset, from.type)
  selection.focus.set(to.key, to.offset, to.type)
  return selection
}

export function $applyReplaceText(find: string, replace: string, group: string): EditError | null {
  const passage = $findPassage(find)
  if (typeof passage === "string") return passage
  const selection = $selectPassage(passage)
  return selection ? $suggestReplacement(selection, replace, group) : "NOT_FOUND"
}

/** The top-level block new content goes after; `null` for the end of the post. */
function $insertionAnchor(position: InsertPosition, after: string | undefined, captured: Captured) {
  if (position === "end") return null
  if (position === "cursor") {
    const block = captured.caretBlock ? $getNodeByKey(captured.caretBlock) : null
    return block?.isAttached() ? block : null
  }
  if (!after) return "NOT_FOUND"
  const passage = $findPassage(after)
  return typeof passage === "string" ? passage : passage.last.getTopLevelElementOrThrow()
}

export function $applyInsertMarkdown(
  markdown: string,
  position: InsertPosition,
  after: string | undefined,
  captured: Captured,
  group: string
): EditError | null {
  const anchor = $insertionAnchor(position, after, captured)
  if (typeof anchor === "string") return anchor
  const nodes = $blocksFrom(markdown)
  if (nodes.length === 0) return "NOT_FOUND"
  $markAsInsertion(nodes, group)
  $insertBlocksAfter(anchor, nodes)
  return null
}

/**
 * Media can't carry a suggestion mark, so the author approves an image in the
 * chat first. With `replaces`, the image takes that one's place.
 */
export function $applyInsertImage(
  url: string,
  alt: string,
  position: InsertPosition,
  after: string | undefined,
  replaces: string | undefined,
  captured: Captured
): EditError | null {
  if (replaces) {
    const old = $nodesOfType(MediaNode).find((node) => node.getSrc() === replaces)
    if (!old) return "NOT_FOUND"
    old.replace($createMediaNode(url, alt))
    return null
  }
  const anchor = $insertionAnchor(position, after, captured)
  if (typeof anchor === "string") return anchor
  $insertBlocksAfter(anchor, [$createMediaNode(url, alt)])
  return null
}
