import { TRANSFORMERS, type ElementTransformer, type Transformer } from "@lexical/markdown"
import {
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
  HorizontalRuleNode,
} from "@lexical/react/LexicalHorizontalRuleNode"
import type { ElementNode, LexicalNode } from "lexical"

import { $createMediaNode, $isMediaNode, MediaNode } from "@/features/blogs/editor/media-node"
import { isAllowedBlogMediaUrl } from "@/features/blogs/lib/media-upload"

function placeBlock(parent: ElementNode, node: LexicalNode, isImport: boolean) {
  if (isImport || parent.getNextSibling() !== null) parent.replace(node)
  else parent.insertBefore(node)
  node.selectNext()
}

export const MEDIA: ElementTransformer = {
  dependencies: [MediaNode],
  export: (node) => {
    if (!$isMediaNode(node)) return null
    const alt = node.getAlt().replace(/[[\]\n]/g, " ")
    return `![${alt}](${node.getSrc()})`
  },
  regExp: /^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)\s?$/,
  replace: (parent, _children, match, isImport) => {
    if (!isAllowedBlogMediaUrl(match[2])) return false
    placeBlock(parent, $createMediaNode(match[2], match[1]), isImport)
  },
  type: "element",
}

export const HORIZONTAL_RULE: ElementTransformer = {
  dependencies: [HorizontalRuleNode],
  export: (node) => ($isHorizontalRuleNode(node) ? "---" : null),
  regExp: /^(---|\*\*\*|___)\s?$/,
  replace: (parent, _children, _match, isImport) => {
    placeBlock(parent, $createHorizontalRuleNode(), isImport)
  },
  type: "element",
}

export const BLOG_TRANSFORMERS: Transformer[] = [MEDIA, HORIZONTAL_RULE, ...TRANSFORMERS]
