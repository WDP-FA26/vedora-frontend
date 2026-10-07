"use client"

import { useState } from "react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useTranscript } from "@/features/admin/hooks/use-admin-posts"
import type { CaptionStatus, CaptionTrack } from "@/features/admin/schemas"

/** Shown when a video has no caption track to read. */
const STATUS_MESSAGES: Record<CaptionStatus, string> = {
  NONE: "Chưa có bản ghi lời. Video được ghi lời sau khi bài được đăng.",
  GENERATING: "Đang ghi lời video…",
  ATTACHING: "Đang ghi lời video…",
  TRANSLATING: "Đang dịch bản ghi lời…",
  READY: "Không đọc được bản ghi lời từ Mux. Thử mở lại nhé.",
  NO_SPEECH: "Video không có lời thoại.",
  FAILED: "Không ghi lời được video này.",
}

function formatTimestamp(seconds: number) {
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`
}

/** What is said in a video, in the spoken language and its translation. */
export function Transcript({
  captionStatus,
  tracks,
  time,
  onSeek,
}: {
  captionStatus: CaptionStatus
  tracks: CaptionTrack[]
  /** The player's position in seconds, to mark the line being spoken. */
  time: number
  onSeek: (seconds: number) => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const track = tracks.find(({ id }) => id === selected) ?? tracks[0] ?? null
  const { cues, error } = useTranscript(track?.url ?? null)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-7 flex-wrap items-center justify-between gap-2">
        <h4 className="text-[0.8125rem] text-muted-foreground">Bản ghi lời</h4>
        {tracks.length > 1 && (
          <div className="flex items-center gap-1">
            {tracks.map(({ id, name }) => (
              <Button
                key={id}
                variant={id === track?.id ? "outline" : "action"}
                size="sm"
                aria-pressed={id === track?.id}
                onClick={() => setSelected(id)}
              >
                {name}
              </Button>
            ))}
          </div>
        )}
      </div>

      {track && !cues && !error ? (
        <div className="space-y-2" aria-hidden>
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-5 w-3/5" />
        </div>
      ) : !track || !cues ? (
        <p className="text-muted-foreground">
          {error
            ? "Không tải được bản ghi lời. Thử mở lại nhé."
            : STATUS_MESSAGES[captionStatus]}
        </p>
      ) : (
        <ol
          lang={track.languageCode ?? undefined}
          className="-mx-2"
        >
          {cues.map((cue) => {
            const speaking = time >= cue.start && time < cue.end
            return (
              <li key={cue.start}>
                <button
                  type="button"
                  aria-current={speaking || undefined}
                  title="Phát từ đây"
                  onClick={() => onSeek(cue.start)}
                  className={cn(
                    "flex w-full gap-3 rounded-lg px-2 py-1.5 text-left leading-6 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40",
                    speaking && "bg-muted"
                  )}
                >
                  <span className="w-10 shrink-0 text-muted-foreground tabular-nums">
                    {formatTimestamp(cue.start)}
                  </span>
                  <span className="min-w-0 break-words">{cue.text}</span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
