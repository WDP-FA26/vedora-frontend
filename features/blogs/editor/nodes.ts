import { CodeNode } from "@lexical/code"
import { AutoLinkNode, LinkNode } from "@lexical/link"
import { ListItemNode, ListNode } from "@lexical/list"
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode"
import { HeadingNode, QuoteNode } from "@lexical/rich-text"

import { MediaNode } from "@/features/blogs/editor/media-node"
import { SuggestionNode } from "@/features/blogs/editor/suggestions"

export const BLOG_NODES = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  AutoLinkNode,
  CodeNode,
  HorizontalRuleNode,
  MediaNode,
  SuggestionNode,
]
