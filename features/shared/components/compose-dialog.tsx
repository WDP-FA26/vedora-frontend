"use client"

import { useState } from "react"
import { ArrowLeftIcon, BookOpenTextIcon, MessageSquareTextIcon } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Composer } from "./composer"

type Step = "choose" | "post"

/**
 * Wraps any trigger element so it opens the post dialog: first pick a post
 * type, then write it. Blogs (long reads) aren't available yet.
 */
export function ComposeDialog({ trigger }: { trigger: React.ReactElement }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("choose")

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setStep("choose")
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
              onClick={() => setStep("choose")}
              className="-ml-2 justify-self-start"
            >
              <ArrowLeftIcon aria-hidden />
              Chọn loại bài
            </Button>
            <Composer
              autoFocus
              onPosted={() => {
                setOpen(false)
                setStep("choose")
              }}
              className="border-b-0 px-0 pt-2 pb-0 sm:px-0"
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
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
    <button
      type="button"
      onClick={onSelect}
      disabled={!onSelect}
      className="group flex flex-col items-start gap-2 rounded-2xl border border-border p-4 text-left transition-colors outline-none hover:border-primary/60 hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border disabled:hover:bg-transparent"
    >
      <span className="flex w-full items-center justify-between gap-2">
        <Icon aria-hidden className="size-6 text-primary" strokeWidth={1.75} />
        {badge && <Badge variant="secondary">{badge}</Badge>}
      </span>
      <span className="font-bold">{title}</span>
      <span className="text-sm text-muted-foreground">{description}</span>
    </button>
  )
}
