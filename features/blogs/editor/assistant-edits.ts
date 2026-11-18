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
  type TextNode,
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

function $isProposed(node: LexicalNode) {
  for (let current: LexicalNode | null = node; current; current = current.getParent()) {
    if ($isSuggestionNode(current)) return current.getKind() === "insert"
  }
  return false
}

/** A text node's place in a line: `start` characters in. */
type Segment = { node: TextNode; start: number }
/** One line of the draft as the agent sees it, and the nodes behind it. */
type Line = { block: ElementNode; text: string; segments: Segment[] }

/**
 * The post as the agent's `<draft>` shows it, one entry per non-empty line:
 * soft line breaks start a new line, empty paragraphs are left out (the
 * Markdown export drops them) and so is text only proposed so far (the export
 * discards pending suggestions).
 */
function $draftLines(): Line[] {
  const lines: Line[] = []
  for (const block of $textBlocks()) {
    let line: Line = { block, text: "", segments: [] }
    const flush = () => {
      if (line.text.trim()) lines.push(line)
      line = { block, text: "", segments: [] }
    }
    const visit = (node: LexicalNode) => {
      if ($isTextNode(node)) {
        if ($isProposed(node)) return
        line.segments.push({ node, start: line.text.length })
        line.text += node.getTextContent()
      } else if ($isLineBreakNode(node)) {
        if (!$isProposed(node)) flush()
      } else if ($isElementNode(node)) node.getChildren().forEach(visit)
    }
    block.getChildren().forEach(visit)
    flush()
  }
  return lines
}

type Passage = { first: Line; start: number; last: Line; end: number }

/** The one place `quote` appears in the draft, possibly across lines and blocks. */
function $findPassage(quote: string): Passage | EditError {
  const quoted = plainText(quote)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (quoted.length === 0) return "NOT_FOUND"
  const lines = $draftLines()
  const found: Passage[] = []

  if (quoted.length === 1) {
    const [needle] = quoted
    for (const line of lines) {
      for (let at = line.text.indexOf(needle); at !== -1; at = line.text.indexOf(needle, at + 1)) {
        found.push({ first: line, start: at, last: line, end: at + needle.length })
      }
    }
  } else {
    const head = quoted[0]
    const tail = quoted[quoted.length - 1]
    const middle = quoted.slice(1, -1)
    for (let index = 0; index + quoted.length <= lines.length; index++) {
      const first = lines[index].text.trimEnd()
      const last = lines[index + quoted.length - 1]
      const lastText = last.text.trimStart()
      if (!first.endsWith(head) || !lastText.startsWith(tail)) continue
      if (!middle.every((text, offset) => lines[index + 1 + offset].text.trim() === text)) continue
      found.push({
        first: lines[index],
        start: first.length - head.length,
        last,
        end: last.text.length - lastText.length + tail.length,
      })
    }
  }
  if (found.length === 0) return "NOT_FOUND"
  return found.length === 1 ? found[0] : "AMBIGUOUS"
}

/** A text point `offset` characters into `line`. */
function pointIn(line: Line, offset: number, edge: "start" | "end"): Point | null {
  for (const { node, start } of line.segments) {
    const size = node.getTextContentSize()
    const inside = edge === "start" ? offset < start + size : offset <= start + size
    if (inside && offset >= start) return { key: node.getKey(), offset: offset - start, type: "text" }
  }
  return null
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
  return typeof passage === "string" ? passage : passage.last.block.getTopLevelElementOrThrow()
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
