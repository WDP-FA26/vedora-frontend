"use client"

import { useEffect, useState, type ReactNode } from "react"
import { MicIcon, MicOffIcon, PhoneOffIcon, RotateCcwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { VoiceOrb, type VoiceOrbState } from "@/components/ui/voice-orb"
import type { MealPlannerVoice, VoiceCaption } from "@/features/meal-plan/hooks/use-meal-planner-voice"
import { VOICE_MAX_SECONDS } from "@/features/meal-plan/voice"
import { LogoMark } from "@/features/shared/components/wordmark"
import { cn } from "@/lib/utils"

const STATE_TEXT: Record<VoiceOrbState, { label: string; hint: string }> = {
  idle: { label: "Đã kết thúc", hint: "Cuộc trò chuyện đã được lưu vào khung chat." },
  connecting: { label: "Đang kết nối…", hint: "Cho phép dùng micro nếu trình duyệt hỏi." },
  listening: { label: "Đang nghe", hint: "Cứ nói tự nhiên, bạn có thể ngắt lời trợ lý bất cứ lúc nào." },
  thinking: { label: "Đang làm việc", hint: "Trợ lý đang xem và chỉnh thực đơn bên phải." },
  speaking: { label: "Đang trả lời", hint: "Nói chen vào để dừng trợ lý." },
  interrupted: { label: "Đang nghe", hint: "Trợ lý đã dừng để nghe bạn." },
  muted: { label: "Đã tắt micro", hint: "Trợ lý không nghe thấy bạn cho tới khi bật lại." },
  error: { label: "Mất kết nối", hint: "Không giữ được cuộc trò chuyện." },
}

const SUGGESTIONS = [
  "Cho mình xem công thức món tối nay",
  "Trưa nay mình ăn một tô phở chay",
  "Mình vừa cân lại, 58 ký",
  "Cân đối lại thực đơn tuần này",
]

function clock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, "0")}`
}

/** Seconds left in the call, ticking once a second while it runs. */
function useSecondsLeft(startedAt: number | null) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (startedAt === null) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [startedAt])
  if (startedAt === null) return VOICE_MAX_SECONDS
  const elapsed = Math.floor((now - startedAt) / 1000)
  return Math.max(0, VOICE_MAX_SECONDS - elapsed)
}

function Captions({ captions }: { captions: VoiceCaption[] }) {
  return (
    <div aria-live="polite" className="flex min-h-16 w-full max-w-sm flex-col gap-1.5 text-center">
      {captions.map((caption) => (
        <p
          key={caption.id}
          className={cn(
            "text-balance line-clamp-3",
            caption.speaker === "user" ? "text-xs text-muted-foreground" : "text-sm text-foreground"
          )}
        >
          <span className="font-semibold text-primary">{caption.speaker === "user" ? "Bạn: " : "Vedora: "}</span>
          {caption.text}
        </p>
      ))}
    </div>
  )
}

/**
 * The assistant column during a voice call: the orb in the middle, what is being
 * said under it, and the call controls. The agent works on the calendar beside it.
 */
export function VoicePanel({
  voice,
  leading,
  trailing,
}: {
  voice: MealPlannerVoice
  leading?: ReactNode
  trailing?: ReactNode
}) {
  const secondsLeft = useSecondsLeft(voice.startedAt)
  const text = STATE_TEXT[voice.orbState]
  const live = voice.status === "connected"
  const failed = voice.error !== null || voice.status === "error"

  return (
    <div className="flex h-[calc(100dvh-4.5rem)] min-h-[24rem] min-w-0 flex-col bg-background lg:h-full">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-card px-3 sm:px-4">
        {leading}
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-secondary">
          <LogoMark className="size-7" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-base font-bold leading-tight">Trợ lý Vedora</h2>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            Trò chuyện bằng giọng nói · còn {clock(secondsLeft)}
          </p>
        </div>
        {trailing}
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 overflow-y-auto px-6 py-8">
        {/* The orb draws in --chatcn-fg; setting it here tints it with the brand colour without restyling it. */}
        <div className="[--chatcn-fg:var(--primary)]">
          <VoiceOrb
            size={176}
            state={voice.orbState}
            inputLevel={voice.inputLevel}
            simulate
            label={`Trợ lý giọng nói: ${text.label.toLowerCase()}`}
          />
        </div>
        <div className="text-center">
          <p className="font-heading text-lg font-semibold">{text.label}</p>
          <p className="mt-1 max-w-xs text-balance text-xs text-muted-foreground">{text.hint}</p>
        </div>

        {failed && (
          <div role="alert" className="flex max-w-xs flex-col items-center gap-3 text-center text-sm text-destructive">
            <p>{voice.error ?? "Cuộc trò chuyện bị ngắt."}</p>
            <Button variant="outline" size="sm" onClick={() => void voice.start()}>
              <RotateCcwIcon aria-hidden /> Kết nối lại
            </Button>
          </div>
        )}
        {!failed && voice.captions.length > 0 && <Captions captions={voice.captions} />}
        {!failed && voice.captions.length === 0 && live && (
          <ul className="grid w-full max-w-xs gap-1.5 text-center text-xs text-muted-foreground">
            {SUGGESTIONS.map((suggestion) => (
              <li key={suggestion} className="rounded-xl border border-border bg-card px-3 py-2">
                “{suggestion}”
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="flex shrink-0 items-center justify-center gap-3 border-t border-border bg-card px-4 py-3">
        <Button
          variant="outline"
          size="icon-lg"
          shape="pill"
          disabled={!live}
          aria-pressed={voice.muted}
          aria-label={voice.muted ? "Bật micro" : "Tắt micro"}
          onClick={() => void voice.toggleMute()}
        >
          {voice.muted ? <MicOffIcon aria-hidden /> : <MicIcon aria-hidden />}
        </Button>
        <Button variant="destructive" size="pill" shape="pill" onClick={() => void voice.end()}>
          <PhoneOffIcon aria-hidden /> Kết thúc
        </Button>
      </footer>
    </div>
  )
}
