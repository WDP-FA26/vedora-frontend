"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowLeftIcon, BookOpenTextIcon, ChefHatIcon, ClapperboardIcon, FileTextIcon, XIcon } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useProcessingPost } from "@/features/posts/hooks/use-feed-posts"
import type { ApiPost } from "@/features/posts/schemas"
import { cn } from "@/lib/utils"
import { Composer, EMPTY_DRAFT, type ComposerDraft } from "./composer"

type ComposeMode = "choose" | "video" | "post"

/** Every entry point shares one dialog and the existing post uploader. */
export function ComposeDialog({
  trigger,
  mediaTrigger,
}: {
  trigger: React.ReactElement
  mediaTrigger?: React.ReactElement
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<ComposeMode>("choose")
  const [showVideoPicker, setShowVideoPicker] = useState(false)
  const [draft, setDraft] = useState<ComposerDraft>(EMPTY_DRAFT)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [discardTo, setDiscardTo] = useState<ComposeMode | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [processingIds, setProcessingIds] = useState<string[]>([])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(null), 6000)
    return () => window.clearTimeout(timeout)
  }, [notice])

  function close() {
    setDraft(EMPTY_DRAFT)
    setMode("choose")
    setShowVideoPicker(false)
    setConfirmDiscard(false)
    setDiscardTo(null)
    setOpen(false)
  }

  function requestLeave(next: ComposeMode | null) {
    if (submittingRef.current) return
    if (draft.hasText || draft.mediaCount > 0) {
      setDiscardTo(next)
      setConfirmDiscard(true)
      return
    }
    if (next) setMode(next)
    else close()
  }

  function requestClose() {
    requestLeave(null)
  }

  function discard() {
    if (!discardTo) {
      close()
      return
    }
    setDraft(EMPTY_DRAFT)
    setShowVideoPicker(false)
    setMode(discardTo)
    setDiscardTo(null)
    setConfirmDiscard(false)
  }

  function handlePosted(post: ApiPost) {
    const wasVideo = mode === "video"
    if (post.status === "PROCESSING") {
      setProcessingIds((ids) =>
        ids.includes(post.id) ? ids : [...ids, post.id]
      )
    }
    close()
    setNotice(
      post.status === "PROCESSING"
        ? `${wasVideo ? "Video" : "Bài viết"} đang được xử lý và sẽ hiển thị nếu xử lý thành công.`
        : `${wasVideo ? "Video" : "Bài viết"} đã đăng.`
    )
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) setOpen(true)
          else requestClose()
        }}
      >
        <DialogTrigger
          render={trigger}
          onClick={() => {
            setMode("choose")
            setShowVideoPicker(false)
            setNotice(null)
          }}
        />
        {mediaTrigger && (
          <DialogTrigger
            render={mediaTrigger}
            onClick={() => {
              setMode("video")
              setShowVideoPicker(true)
              setNotice(null)
            }}
          />
        )}
        <DialogContent
          showCloseButton={false}
          flush
          mobileFullscreen
          className={cn(
            "top-0 left-0 flex h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[90dvh] sm:-translate-x-1/2 sm:-translate-y-1/2",
            mode === "video"
              ? "sm:w-[min(46rem,calc(100vw-2rem))] sm:max-w-[46rem]"
              : "sm:w-[min(36rem,calc(100vw-2rem))] sm:max-w-[36rem]"
          )}
        >
          <header className="relative flex shrink-0 items-center justify-center border-b border-border/70 px-14 pt-[max(1rem,env(safe-area-inset-top))] pb-4 sm:py-4">
            {mode !== "choose" && (
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                shape="pill"
                aria-label="Quay lại chọn loại nội dung"
                disabled={isSubmitting}
                onClick={() => requestLeave("choose")}
                className="absolute top-1/2 left-4 -translate-y-1/2"
              >
                <ArrowLeftIcon aria-hidden />
              </Button>
            )}
            <DialogTitle size="lg" className="text-center">
              {mode === "choose" ? "Tạo nội dung" : mode === "video" ? "Tạo video hướng dẫn" : "Tạo bài viết"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {mode === "choose" ? "Chọn loại nội dung bạn muốn chia sẻ." : "Chia sẻ bài viết hoặc video với cộng đồng Vedora."}
            </DialogDescription>
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              shape="pill"
              aria-label="Đóng dialog tạo bài viết"
              disabled={isSubmitting}
              onClick={requestClose}
              className="absolute top-1/2 right-4 -translate-y-1/2"
            >
              <XIcon aria-hidden />
            </Button>
          </header>
          {mode === "choose" ? (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-6">
              <p className="mb-5 text-sm leading-6 text-muted-foreground">Bạn muốn chia sẻ điều gì với cộng đồng Vedora?</p>
              <div className="space-y-2.5">
                <button type="button" onClick={() => { setMode("video"); setShowVideoPicker(true) }} className="group flex w-full items-center gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><ClapperboardIcon aria-hidden className="size-6" /></span>
                  <span className="min-w-0 flex-1"><span className="block font-heading text-base font-bold">Video hướng dẫn</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">Chia sẻ cách nấu bằng video và phần hướng dẫn ngắn.</span></span>
                </button>
                <div aria-disabled="true" className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 opacity-65">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary"><ChefHatIcon aria-hidden className="size-6" /></span>
                  <span className="min-w-0 flex-1"><span className="block font-heading text-base font-bold">Công thức</span><span className="mt-1 block text-xs text-muted-foreground">Biên tập công thức đầy đủ.</span></span>
                  <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[0.6875rem] font-semibold text-muted-foreground">Sắp có</span>
                </div>
                <div aria-disabled="true" className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 opacity-65">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary"><BookOpenTextIcon aria-hidden className="size-6" /></span>
                  <span className="min-w-0 flex-1"><span className="block font-heading text-base font-bold">Blog</span><span className="mt-1 block text-xs text-muted-foreground">Viết bài dài về bếp chay.</span></span>
                  <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[0.6875rem] font-semibold text-muted-foreground">Sắp có</span>
                </div>
              </div>
              <Button type="button" variant="ghost" className="mt-5 w-full" onClick={() => setMode("post")}><FileTextIcon aria-hidden /> Viết bài ngắn</Button>
            </div>
          ) : (
            <Composer
              key={mode}
              mode={mode}
              autoFocus={mode === "post" && !showVideoPicker}
              showVideoPickerInitially={mode === "video" || showVideoPicker}
              onPosted={handlePosted}
              onSubmittingChange={(busy) => {
                submittingRef.current = busy
                setIsSubmitting(busy)
              }}
              onDraftChange={(next) =>
                setDraft((previous) =>
                  previous.hasText === next.hasText &&
                  previous.mediaCount === next.mediaCount
                    ? previous
                    : next
                )
              }
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bỏ bài viết đang soạn?</AlertDialogTitle>
            <AlertDialogDescription>
              {draft.mediaCount > 0
                ? "Nội dung và video đã chọn sẽ bị xóa khi bạn bỏ bài viết."
                : "Nội dung bạn đã viết sẽ bị mất khi bạn bỏ bài viết."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Tiếp tục chỉnh sửa</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={discard}>
              Bỏ bài viết
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {notice && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-sm rounded-xl border border-primary/20 bg-card px-4 py-3 text-sm font-medium text-foreground shadow-lg sm:right-6 sm:bottom-6 sm:left-auto"
        >
          {notice}
        </div>
      )}
      {processingIds.map((id) => (
        <ProcessingPostTracker key={id} id={id} />
      ))}
    </>
  )
}

function ProcessingPostTracker({ id }: { id: string }) {
  useProcessingPost(id)
  return null
}
