import { $convertToMarkdownString } from "@lexical/markdown"
import { createEditor, type EditorState, type LexicalEditor } from "lexical"

import { BLOG_NODES } from "@/features/blogs/editor/nodes"
import { $pendingGroups, $resolveSuggestion } from "@/features/blogs/editor/suggestions"
import { BLOG_TRANSFORMERS } from "@/features/blogs/editor/transformers"

let scratch: LexicalEditor | null = null

/**
 * The Markdown that gets saved: the post as it stands, without anything the
 * assistant has only proposed. With no pending suggestions that is a plain
 * export; otherwise the state is copied into a headless editor and every
 * suggestion discarded there, so the live document is never touched.
 */
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
