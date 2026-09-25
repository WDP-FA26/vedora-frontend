"use client"

import { useState } from "react"
import { ArrowLeftIcon, BookOpenTextIcon, MessageSquareTextIcon } from "lucide-react"
import type { LucideIcon } from "lucide-react"

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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Composer, EMPTY_DRAFT, type ComposerDraft } from "./composer"

type Step = "choose" | "post"

/** Where the user was headed when leaving the composer. */
type Leave = "close" | "back"

/**
 * Wraps any trigger element so it opens the post dialog: first pick a post
 * type, then write it. Blogs (long reads) aren't available yet. Leaving the
 * composer with a draft (text or attachments) asks first, since leaving
 * discards it.
 */
export function ComposeDialog({ trigger }: { trigger: React.ReactElement }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("choose")
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [pendingLeave, setPendingLeave] = useState<Leave | null>(null)

  /** Unmounts the composer, which cancels and deletes its uploads. */
  function leave(target: Leave) {
    setDraft(EMPTY_DRAFT)
    setStep("choose")
    if (target === "close") setOpen(false)
  }

  function requestLeave(target: Leave) {
    if (step === "post" && (draft.hasText || draft.mediaCount > 0)) setPendingLeave(target)
    else leave(target)
  }

  return (
    <>
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setOpen(true)
        else requestLeave("close")
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="top-[12%] translate-y-0 sm:max-w-[36rem]">
        {step === "choose" ? (
          <div className="pt-2">
            <DialogTitle>Bạn muốn đăng gì?</DialogTitle>
            <DialogDescription className="mt-1">
              Chọn loại bài phù hợp với nội dung của bạn.
            </DialogDescription>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <TypeOption
                icon={MessageSquareTextIcon}
                title="Bài đăng"
                description="Vài dòng chia sẻ, kèm video nấu ăn."
                onSelect={() => setStep("post")}
              />
              <TypeOption
                icon={BookOpenTextIcon}
                title="Blog"
                description="Bài đọc dài: công thức chi tiết, câu chuyện, nghiên cứu."
                badge="Sắp ra mắt"
              />
            </div>
          </div>
        ) : (
          <>
            <DialogTitle className="sr-only">Bài đăng mới</DialogTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => requestLeave("back")}
              className="-ml-2 justify-self-start"
            >
              <ArrowLeftIcon aria-hidden />
              Chọn loại bài
            </Button>
            <Composer
              autoFocus
              onPosted={() => leave("close")}
              onDraftChange={(next) =>
                // Keystrokes report the same draft; skip those re-renders.
                setDraft((prev) =>
                  prev.hasText === next.hasText && prev.mediaCount === next.mediaCount
                    ? prev
                    : next
                )
              }
              className="border-b-0 px-0 pt-2 pb-0 sm:px-0"
            />
          </>
        )}
      </DialogContent>
    </Dialog>

    <AlertDialog
      open={pendingLeave !== null}
      onOpenChange={(next) => {
        if (!next) setPendingLeave(null)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Bỏ bài đăng này?</AlertDialogTitle>
          <AlertDialogDescription>
            {discardMessage(draft)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Ở lại</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              if (pendingLeave) leave(pendingLeave)
              setPendingLeave(null)
            }}
          >
            Bỏ bài
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}

function discardMessage({ hasText, mediaCount }: ComposerDraft) {
  const videos = mediaCount > 1 ? `${mediaCount} video` : "video"
  if (mediaCount > 0 && hasText) {
    return `Nội dung bạn đã viết và ${videos} đã tải lên sẽ bị xóa.`
  }
  if (mediaCount > 0) return `${mediaCount > 1 ? videos : "Video"} bạn đã tải lên sẽ bị xóa.`
  return "Nội dung bạn đã viết sẽ bị mất."
}

function TypeOption({
  icon: Icon,
  title,
  description,
  badge,
  onSelect,
}: {
  icon: LucideIcon
  title: string
  description: string
  badge?: string
  /** Omitted: the option is shown but unavailable. */
  onSelect?: () => void
}) {
  return (
    <Item
      variant="outline"
      render={<button type="button" onClick={onSelect} disabled={!onSelect} />}
      className="items-start rounded-2xl p-4 text-left enabled:hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <ItemMedia variant="icon">
        <Icon aria-hidden className="size-6 text-primary" strokeWidth={1.75} />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>
          {title}
          {badge && <Badge variant="secondary">{badge}</Badge>}
        </ItemTitle>
        <ItemDescription>{description}</ItemDescription>
      </ItemContent>
    </Item>
  )
}
