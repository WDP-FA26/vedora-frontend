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
import { ArrowLeftIcon, FileTextIcon, ScaleIcon, SendIcon, ShieldAlertIcon } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { CreateAppealDialog } from "@/features/support/components/create-appeal-dialog"
import { TicketStatusBadge } from "@/features/support/components/ticket-status-badge"
import { APPEAL_BLOCKED_LABELS } from "@/features/support/schemas"
import { supportTicketPath } from "@/features/support/support-cache"
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
import { ModerationFindings } from "@/features/posts/components/moderation-findings"
import { rejectionMessage } from "@/features/posts/lib/moderation-labels"
import { formatPostDateLong } from "@/features/shared/lib/format"

const SAVE_LABEL: Record<SaveState, string> = {
  idle: "Chưa lưu",
  saving: "Đang lưu…",
  saved: "Đã lưu",
  error: "Chưa lưu được",
}

const subscribeNever = () => () => {}

function $isDocumentEmpty() {
  const root = $getRoot()
  const first = root.getFirstChild()
  return first === null || (root.getChildrenSize() === 1 && $isParagraphNode(first) && first.isEmpty())
}

export function BlogEditor({ initial }: { initial: ApiBlog | null }) {
  const draft = useBlogDraft(initial)
  const [empty, setEmpty] = useState(!initial?.content.trim())
  const [appealDialogOpen, setAppealDialogOpen] = useState(false)
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false)

  const published = draft.status === "PUBLISHED" || draft.status === "PROCESSING" || draft.status === "PENDING_REVIEW"
  const appeal = initial?.appeal ?? null
  const locked = Boolean(appeal?.activeTicket) || draft.status === "REMOVED"
  const busy = draft.saveState === "saving" || locked

  function onDocumentChange(state: EditorState) {
    draft.setDocument(state)
    setEmpty(state.read($isDocumentEmpty))
  }

  async function publish() {
    const nextStatus = await draft.publish()
    if (!nextStatus) return
    toast.add({
      title: nextStatus === "PROCESSING" ? "Đã gửi blog để kiểm duyệt" : "Đã đăng blog",
      description: draft.title.trim(),
    })
  }

  if (!mounted) return <div className="min-h-dvh" aria-busy />

  return (
    <LexicalComposer
      initialConfig={{
        namespace: "vedora-blog",
        editable: !locked,
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
              {draft.status === "PUBLISHED" && draft.saveState !== "error" && " · Đã đăng"}
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
            {initial && (draft.status === "REJECTED" || draft.status === "REMOVED") && (
              <div
                role="status"
                className="mb-6 flex flex-col gap-2.5 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                <div className="flex items-start gap-2 font-medium">
                  <ShieldAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
                  <span>
                    {draft.status === "REMOVED"
                      ? `Blog này đã bị quản trị viên gỡ bỏ${initial.removalReason ? ` (${initial.removalReason})` : ""}.`
                      : rejectionMessage(initial.moderationVerdict, "Blog", initial.moderationReason)}
                  </span>
                </div>
                {draft.status === "REJECTED" && (
                  <ModerationFindings findings={initial.moderationFindings ?? []} />
                )}
                {appeal?.activeTicket ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-destructive/20 pt-2.5 text-foreground">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-medium">{appeal.activeTicket.code}</span>
                      <TicketStatusBadge
                        status={appeal.activeTicket.status}
                        appealOutcome={appeal.activeTicket.outcome}
                      />
                      <span className="text-muted-foreground">
                        Đang khóa chỉnh sửa cho đến khi kháng cáo kết thúc.
                      </span>
                    </div>
                    <Link
                      href={supportTicketPath(appeal.activeTicket.id)}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Xem hồ sơ kháng cáo
                    </Link>
                  </div>
                ) : appeal?.canAppeal ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-destructive/20 pt-2.5 text-foreground">
                    <span className="text-xs text-muted-foreground">
                      Bạn có thể gửi kháng cáo
                      {appeal.deadlineAt
                        ? ` trước ${formatPostDateLong(appeal.deadlineAt)}`
                        : " trong 14 ngày"}
                      .
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setAppealDialogOpen(true)}
                    >
                      <ScaleIcon aria-hidden />
                      Gửi kháng cáo
                    </Button>
                    <CreateAppealDialog
                      postId={initial.id}
                      subject="Blog"
                      deadlineAt={appeal.deadlineAt}
                      open={appealDialogOpen}
                      onOpenChange={setAppealDialogOpen}
                    />
                  </div>
                ) : appeal?.blockedReason ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-destructive/20 pt-2.5 text-xs text-muted-foreground">
                    <span>{APPEAL_BLOCKED_LABELS[appeal.blockedReason]}</span>
                    {appeal.latestTicket && (
                      <Link
                        href={supportTicketPath(appeal.latestTicket.id)}
                        className="font-medium text-foreground underline underline-offset-4"
                      >
                        Xem hồ sơ {appeal.latestTicket.code}
                      </Link>
                    )}
                  </div>
                ) : null}
              </div>
            )}
            <span
              aria-hidden
              className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground"
            >
              <FileTextIcon className="size-5" />
            </span>
            <TitleField value={draft.title} onChange={draft.setTitle} disabled={locked} />
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

function TitleField({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (title: string) => void
  disabled?: boolean
}) {
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
      disabled={disabled}
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
