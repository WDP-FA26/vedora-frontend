"use client"

import { useId, useState } from "react"
import {
  CalendarClockIcon,
  ClapperboardIcon,
  FileTextIcon,
  GlobeIcon,
  ImageIcon,
  SmileIcon,
  UtensilsCrossedIcon,
} from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { AuthorAvatar } from "@/features/shared/components/author-avatar"
import { useAuth } from "@/features/auth/hooks/use-auth"

const MAX_LENGTH = 280

const tools = [
  { label: "Thêm ảnh", icon: ImageIcon },
  { label: "Tải video lên", icon: ClapperboardIcon },
  { label: "Đính kèm công thức", icon: UtensilsCrossedIcon },
  { label: "Viết bài blog", icon: FileTextIcon },
  { label: "Lên lịch đăng", icon: CalendarClockIcon, desktopOnly: true },
  { label: "Thêm biểu tượng cảm xúc", icon: SmileIcon, desktopOnly: true },
]

export function Composer({
  className,
  autoFocus,
  onPosted,
}: {
  className?: string
  autoFocus?: boolean
  /** Called after a post is submitted; posts aren't persisted yet. */
  onPosted?: () => void
}) {
  const [text, setText] = useState("")
  const { author } = useAuth()
  const inputId = useId()
  const remaining = MAX_LENGTH - text.length
  const empty = text.trim().length === 0

  return (
    <form
      className={cn("flex gap-3 border-b border-border px-4 py-4 sm:px-5", className)}
      onSubmit={(event) => {
        event.preventDefault()
        if (empty || remaining < 0) return
        setText("")
        onPosted?.()
      }}
    >
      {author && <AuthorAvatar author={author} size="lg" className="mt-0.5" />}
      <div className="min-w-0 flex-1">
        <label htmlFor={inputId} className="sr-only">
          Bài viết mới
        </label>
        <textarea
          id={inputId}
          autoFocus={autoFocus}
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={2}
          placeholder="Chia sẻ công thức, câu chuyện mùa vụ hoặc video nấu ăn…"
          className="field-sizing-content block max-h-80 min-h-14 w-full resize-none bg-transparent py-2 text-[1.0625rem] leading-relaxed outline-none placeholder:text-muted-foreground"
        />
        <p className="flex items-center gap-1.5 border-b border-border pb-3 text-xs font-semibold text-primary">
          <GlobeIcon aria-hidden className="size-3.5" />
          Mọi người đều có thể xem và trả lời
        </p>
        <div className="flex items-center justify-between gap-2 pt-2.5">
          <div className="-ml-2 flex items-center">
            {tools.map(({ label, icon: Icon, desktopOnly }) => (
              <Tooltip key={label}>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="tool"
                      size="icon"
                      shape="pill"
                      className={cn(desktopOnly && "max-sm:hidden")}
                    />
                  }
                  aria-label={label}
                >
                  <Icon aria-hidden strokeWidth={1.75} />
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {!empty && (
              <span
                aria-live="polite"
                className={cn(
                  "text-xs font-medium text-muted-foreground tabular-nums",
                  remaining < 20 && "text-[oklch(0.55_0.13_70)]",
                  remaining < 0 && "text-destructive"
                )}
              >
                {remaining}
                <span className="sr-only"> ký tự còn lại</span>
              </span>
            )}
            <Button
              type="submit"
              disabled={empty || remaining < 0}
              size="pill"
              shape="pill"
            >
              Đăng
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}
