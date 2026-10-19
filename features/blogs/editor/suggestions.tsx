import {
  $createTextNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isRootNode,
  $nodesOfType,
  ElementNode,
  type LexicalNode,
  type SerializedElementNode,
  type Spread,
} from "lexical"
import { $isListNode } from "@lexical/list"

type SuggestionKind = "delete" | "insert"

type SerializedSuggestionNode = Spread<{ kind: SuggestionKind; group: string }, SerializedElementNode>

// Like an IDE diff: the text keeps its colour on a solid block, struck through
// when removed. `box-decoration-clone` keeps the block unbroken across wrapped lines.
const STYLES: Record<SuggestionKind, string> = {
  delete:
    "box-decoration-clone bg-red-500/45 text-foreground line-through decoration-foreground/70 decoration-1",
  insert: "ml-1 box-decoration-clone bg-green-500/40 text-foreground",
}

/**
 * Text the writing assistant proposes. `delete` wraps text it would remove
 * (red, struck through), `insert` wraps text it would add (green). All marks
 * of one proposal share a `group`, which is accepted or discarded as a unit.
 */
export class SuggestionNode extends ElementNode {
  __kind: SuggestionKind
  __group: string

  static getType() {
    return "suggestion"
  }

  static clone(node: SuggestionNode) {
    return new SuggestionNode(node.__kind, node.__group, node.__key)
  }

  static importJSON(json: SerializedSuggestionNode) {
    return $createSuggestionNode(json.kind, json.group).updateFromJSON(json)
  }

  constructor(kind: SuggestionKind, group: string, key?: string) {
    super(key)
    this.__kind = kind
    this.__group = group
  }

  exportJSON(): SerializedSuggestionNode {
    return { ...super.exportJSON(), kind: this.__kind, group: this.__group }
  }

  createDOM() {
    const span = document.createElement("span")
    span.className = STYLES[this.__kind]
    span.dataset.suggestionGroup = this.__group
    span.dataset.suggestionKind = this.__kind
    return span
  }

  updateDOM(prev: SuggestionNode) {
    return prev.__kind !== this.__kind || prev.__group !== this.__group
  }

  isInline() {
    return true
  }

  canBeEmpty() {
    return false
  }

  canInsertTextBefore() {
    return false
  }

  canInsertTextAfter() {
    return false
  }

  getKind() {
    return this.__kind
  }

  getGroup() {
    return this.__group
  }
}

export function $createSuggestionNode(kind: SuggestionKind, group: string) {
  return new SuggestionNode(kind, group)
}

export function $isSuggestionNode(node: LexicalNode | null | undefined): node is SuggestionNode {
  return node instanceof SuggestionNode
}

/** Groups that still have marks in the document. */
export function $pendingGroups(): Set<string> {
  return new Set($nodesOfType(SuggestionNode).map((node) => node.getGroup()))
}

/** Removes `node`, then the blocks it leaves empty (a proposed list item, heading…). */
function $removeWithEmptyParents(node: LexicalNode) {
  let current: LexicalNode | null = node
  while (current && !$isRootNode(current)) {
    const parent: LexicalNode | null = current.getParent()
    current.remove()
    if (!parent || !$isElementNode(parent) || parent.getChildrenSize() > 0) break
    current = parent
  }
}

function $unwrap(node: SuggestionNode) {
  for (const child of node.getChildren()) node.insertBefore(child)
  node.remove()
}

/** Accepting keeps what was proposed (drops the struck text); discarding keeps the original. */
export function $resolveSuggestion(group: string, decision: "accept" | "discard") {
  for (const node of $nodesOfType(SuggestionNode)) {
    if (node.getGroup() !== group) continue
    const keep = (node.getKind() === "insert") === (decision === "accept")
    if (keep) $unwrap(node)
    else $removeWithEmptyParents(node)
  }
}

/** Marks every inline run in `nodes` (new blocks) as proposed text of `group`. */
export function $markAsInsertion(nodes: LexicalNode[], group: string) {
  function visit(node: LexicalNode) {
    if (!$isElementNode(node) || node.isInline()) return
    if ($isListNode(node)) {
      node.getChildren().forEach(visit)
      return
    }
    const inline = node.getChildren().filter((child) => !$isElementNode(child) || child.isInline())
    if (inline.length > 0 && inline.length === node.getChildrenSize()) {
      const mark = $createSuggestionNode("insert", group)
      inline.forEach((child) => mark.append(child))
      node.append(mark)
      return
    }
    node.getChildren().forEach(visit)
  }
  nodes.forEach(visit)
}

/** Strikes out all of `block`'s text and proposes `text` next to it. */
export function $suggestRewrite(block: ElementNode, text: string, group: string) {
  const removed = $createSuggestionNode("delete", group)
  block.getChildren().forEach((child) => removed.append(child))
  const added = $createSuggestionNode("insert", group)
  added.append($createTextNode(text))
  block.append(removed, added)
}

/**
 * The block an edit request is about: the one holding the caret, else the
 * last block with text. `null` when the post has no text, or the block
 * already carries an unresolved suggestion.
 */
export function $findRewriteTarget(): ElementNode | null {
  const selection = $getSelection()
  let node: LexicalNode | null = $isRangeSelection(selection) ? selection.anchor.getNode() : null
  while (node && !($isElementNode(node) && !node.isInline() && !$isRootNode(node) && !$isListNode(node))) {
    node = node.getParent()
  }
  const hasText = (block: LexicalNode | null): block is ElementNode =>
    $isElementNode(block) && block.getTextContent().trim() !== ""
  let block: ElementNode | null = hasText(node) ? node : null
  if (!block) {
    for (const child of $getRoot().getChildren().reverse()) {
      if ($isListNode(child)) {
        const item = child.getLastChild()
        if (hasText(item)) block = item
      } else if (hasText(child)) {
        block = child
      }
      if (block) break
    }
  }
  return block && !block.getChildren().some($isSuggestionNode) ? block : null
}
