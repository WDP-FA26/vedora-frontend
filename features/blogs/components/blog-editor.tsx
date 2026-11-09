"use client"

import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { LexicalComposer } from "@lexical/react/LexicalComposer"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { ContentEditable } from "@lexical/react/LexicalContentEditable"
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary"
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin"
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin"
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin"
import { ListPlugin } from "@lexical/react/LexicalListPlugin"
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin"
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin"
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin"
import { $convertFromMarkdownString } from "@lexical/markdown"
import { $createParagraphNode, $getRoot, $isParagraphNode, type EditorState } from "lexical"
import { ArrowLeftIcon, FileTextIcon, SendIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { WritingAgentPanel } from "@/features/blogs/components/writing-agent-panel"
import { BLOGS_PATH } from "@/features/blogs/blogs-cache"
import { BLOG_NODES } from "@/features/blogs/editor/nodes"
import { EmptyLineHintPlugin } from "@/features/blogs/editor/empty-line-hint-plugin"
import { SlashMenuPlugin } from "@/features/blogs/editor/slash-menu-plugin"
import { SuggestionHoverPlugin } from "@/features/blogs/editor/suggestion-hover-plugin"
import { blogTheme } from "@/features/blogs/editor/theme"
import { BLOG_TRANSFORMERS } from "@/features/blogs/editor/transformers"
import { useBlogDraft, type SaveState } from "@/features/blogs/hooks/use-blog-draft"
import { MAX_BLOG_TITLE_LENGTH, type ApiBlog } from "@/features/blogs/schemas"

const SAVE_LABEL: Record<SaveState, string> = {
  idle: "Chưa lưu",
  saving: "Đang lưu…",
  saved: "Đã lưu",
  error: "Chưa lưu được",
}

const subscribeNever = () => () => {}

/** True for no content at all, or a single blank paragraph. Reads only the top level. */
function $isDocumentEmpty() {
  const root = $getRoot()
  const first = root.getFirstChild()
  return first === null || (root.getChildrenSize() === 1 && $isParagraphNode(first) && first.isEmpty())
}

/**
 * Full-page blog drafting in the style of a page editor: an icon, a big
 * title, then the text, with a `/` menu for blocks and media. The blog is
 * stored as Markdown, but authors never see it. The writing assistant takes
 * the right 30% of the screen. `initial` is the saved blog when
 * editing, `null` for a new one.
 */
export function BlogEditor({ initial }: { initial: ApiBlog | null }) {
  const draft = useBlogDraft(initial)
  const [empty, setEmpty] = useState(!initial?.content.trim())
  // Lexical renders its content area differently on the server (no editor
  // state, no selection), so the editor only exists in the browser.
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false)

  const published = draft.status === "PUBLISHED"
  const busy = draft.saveState === "saving"

  function onDocumentChange(state: EditorState) {
    draft.setDocument(state)
    setEmpty(state.read($isDocumentEmpty))
  }

  async function publish() {
    if (await draft.publish()) toast.add({ title: "Đã đăng blog", description: draft.title.trim() })
  }

  if (!mounted) return <div className="min-h-dvh" aria-busy />

  return (
    <LexicalComposer
      initialConfig={{
        namespace: "vedora-blog",
        nodes: BLOG_NODES,
        theme: blogTheme,
        onError: (error) => {
          throw error
        },
        editorState: () => {
          if (initial?.content) $convertFromMarkdownString(initial.content, BLOG_TRANSFORMERS)
          else $getRoot().append($createParagraphNode())
        },
      }}
    >
      <div className="flex min-h-dvh">
        <div className="relative flex h-dvh min-w-0 flex-1 flex-col overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 bg-background/90 px-3 backdrop-blur">
            <Button
              variant="ghost"
              size="icon"
              nativeButton={false}
              render={<Link href={BLOGS_PATH} aria-label="Quay lại danh sách blog" />}
            >
              <ArrowLeftIcon />
            </Button>
            <p
              role="status"
              className={
                draft.saveState === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"
              }
            >
              {draft.error ?? SAVE_LABEL[draft.saveState]}
              {published && draft.saveState !== "error" && " · Đã đăng"}
            </p>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => void draft.save()}>
                {published ? "Lưu" : "Lưu nháp"}
              </Button>
              {published ? (
                <Button variant="secondary" size="sm" disabled={busy} onClick={() => void draft.unpublish()}>
                  Chuyển về nháp
                </Button>
              ) : (
                <Button
                  variant="raised"
                  size="sm"
                  shape="pill"
                  disabled={busy || empty || draft.title.trim() === ""}
                  onClick={() => void publish()}
                >
                  <SendIcon data-icon="inline-start" />
                  Đăng
                </Button>
              )}
            </div>
          </header>

          <div className="mx-auto w-full max-w-[44rem] flex-1 px-6 pt-16 pb-40">
            <span
              aria-hidden
              className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground"
            >
              <FileTextIcon className="size-5" />
            </span>
            <TitleField value={draft.title} onChange={draft.setTitle} />
            <div className="relative">
              <RichTextPlugin
                contentEditable={
                  <ContentEditable
                    aria-label="Nội dung bài viết"
                    className="min-h-[24rem] text-base outline-none"
                  />
                }
                ErrorBoundary={LexicalErrorBoundary}
              />
              <EmptyLineHintPlugin />
            </div>
          </div>
        </div>

        <WritingAgentPanel title={draft.title} blogId={draft.blogId} onPickTitle={draft.setTitle} />
      </div>

      <OnChangePlugin ignoreSelectionChange onChange={onDocumentChange} />
      <HistoryPlugin />
      <ListPlugin />
      <LinkPlugin validateUrl={(url) => /^(https?:\/\/|mailto:)/i.test(url)} />
      <HorizontalRulePlugin />
      <MarkdownShortcutPlugin transformers={BLOG_TRANSFORMERS} />
      <SlashMenuPlugin />
      <SuggestionHoverPlugin />
    </LexicalComposer>
  )
}

/**
 * The big title. Long titles wrap and the field grows to fit them; it stays a
 * single line of text, so Enter moves on to the start of the text, as in a page
 * editor, and pasted line breaks become spaces.
 */
function TitleField({ value, onChange }: { value: string; onChange: (title: string) => void }) {
  const [editor] = useLexicalComposerContext()
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const field = ref.current
    if (!field) return
    const fit = () => {
      field.style.height = "auto"
      field.style.height = `${field.scrollHeight}px`
    }
    fit()
    window.addEventListener("resize", fit)
    return () => window.removeEventListener("resize", fit)
  }, [value])

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(event) => onChange(event.target.value.replace(/\s*[\r\n]+\s*/g, " "))}
      onKeyDown={(event) => {
        if (event.key !== "Enter" || event.nativeEvent.isComposing) return
        event.preventDefault()
        editor.focus(() => editor.update(() => $getRoot().selectStart()))
      }}
      maxLength={MAX_BLOG_TITLE_LENGTH}
      placeholder="Tiêu đề"
      aria-label="Tiêu đề bài viết"
      className="mt-5 mb-8 block w-full resize-none overflow-hidden bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/50 sm:text-4xl"
    />
  )
}
