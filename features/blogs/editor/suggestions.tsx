import {
  $isElementNode,
  $isRootNode,
  $nodesOfType,
  createCommand,
  ElementNode,
  type LexicalNode,
  type SerializedElementNode,
  type Spread,
} from "lexical"
import { $isListNode } from "@lexical/list"

type SuggestionKind = "delete" | "insert"

export type SuggestionDecision = "accept" | "discard"

export const RESOLVE_SUGGESTION_COMMAND = createCommand<{ group: string; decision: SuggestionDecision }>(
  "RESOLVE_SUGGESTION_COMMAND"
)

type SerializedSuggestionNode = Spread<{ kind: SuggestionKind; group: string }, SerializedElementNode>

const STYLES: Record<SuggestionKind, string> = {
  delete:
    "box-decoration-clone bg-red-500/45 text-foreground line-through decoration-foreground/70 decoration-1",
  insert: "ml-1 box-decoration-clone bg-green-500/40 text-foreground",
}

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

export function $pendingGroups(): Set<string> {
  return new Set($nodesOfType(SuggestionNode).map((node) => node.getGroup()))
}

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

export function $resolveSuggestion(group: string, decision: SuggestionDecision) {
  for (const node of $nodesOfType(SuggestionNode)) {
    if (node.getGroup() !== group) continue
    const keep = (node.getKind() === "insert") === (decision === "accept")
    if (keep) $unwrap(node)
    else $removeWithEmptyParents(node)
  }
}

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
