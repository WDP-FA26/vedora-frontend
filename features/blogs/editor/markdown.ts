import { $convertToMarkdownString } from "@lexical/markdown"
import { createEditor, type EditorState, type LexicalEditor } from "lexical"

import { BLOG_NODES } from "@/features/blogs/editor/nodes"
import { $pendingGroups, $resolveSuggestion } from "@/features/blogs/editor/suggestions"
import { BLOG_TRANSFORMERS } from "@/features/blogs/editor/transformers"

let scratch: LexicalEditor | null = null

export function markdownOf(state: EditorState): string {
  if (!state.read(() => $pendingGroups().size > 0)) {
    return state.read(() => $convertToMarkdownString(BLOG_TRANSFORMERS))
  }
  scratch ??= createEditor({
    namespace: "vedora-blog-export",
    nodes: BLOG_NODES,
    onError: (error) => {
      throw error
    },
  })
  scratch.setEditorState(scratch.parseEditorState(state.toJSON()))
  scratch.update(
    () => {
      for (const group of $pendingGroups()) $resolveSuggestion(group, "discard")
    },
    { discrete: true }
  )
  return scratch.getEditorState().read(() => $convertToMarkdownString(BLOG_TRANSFORMERS))
}
