"use client"

import { useEffect, useState, type ReactNode } from "react"
import {
  ActivityIcon,
  BookOpenIcon,
  CalendarRangeIcon,
  MicIcon,
  MicOffIcon,
  NotebookPenIcon,
  PhoneOffIcon,
  RotateCcwIcon,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { VoiceOrb, type VoiceOrbState } from "@/components/ui/voice-orb"
import { useMealPlannerVoice, type VoiceUsageAnchor } from "@/features/meal-plan/hooks/use-meal-planner-voice"
import { VOICE_MAX_SECONDS, type VoiceOpenRecipe, type VoiceScreen, type VoiceScreenCommand } from "@/features/meal-plan/voice"
import { LogoMark } from "@/features/shared/components/wordmark"

const STATE_TEXT: Record<VoiceOrbState, { label: string; hint: string }> = {
  idle: { label: "Đã kết thúc", hint: "Cuộc trò chuyện đã được lưu vào khung chat." },
  connecting: { label: "Đang kết nối…", hint: "Cho phép dùng micro nếu trình duyệt hỏi." },
  listening: { label: "Đang nghe", hint: "Cứ nói tự nhiên. Nói “tạm biệt” khi muốn kết thúc." },
  thinking: { label: "Đang làm việc", hint: "Trợ lý đang xem và chỉnh thực đơn bên phải." },
  speaking: { label: "Đang trả lời", hint: "Nói chen vào để dừng trợ lý." },
  interrupted: { label: "Đang nghe", hint: "Trợ lý đã dừng để nghe bạn." },
  muted: { label: "Đã tắt micro", hint: "Trợ lý không nghe thấy bạn cho tới khi bật lại." },
  error: { label: "Mất kết nối", hint: "Không giữ được cuộc trò chuyện." },
}

/** What the assistant can do, shown under the orb until the user speaks. */
const FEATURES: { icon: LucideIcon; text: string }[] = [
  { icon: CalendarRangeIcon, text: "Lên và đổi món trong thực đơn tuần" },
  { icon: BookOpenIcon, text: "Mở công thức, đọc nguyên liệu và từng bước" },
  { icon: NotebookPenIcon, text: "Ghi món đã ăn vào nhật ký" },
  { icon: ActivityIcon, text: "Cập nhật cân nặng, xem BMI" },
]

const MINUTE_SECONDS = 60

/**
 * Remaining time in the call, synced from AI Gateway usage snapshots: rounded to
 * minutes until under a minute remains, then ticking down by the second while live.
 */
function VoiceCountdown({ usage, live }: { usage: VoiceUsageAnchor | null; live: boolean }) {
  const [now, setNow] = useState<number | null>(null)
  const baseRemaining =
    usage === null ? VOICE_MAX_SECONDS : Math.max(0, VOICE_MAX_SECONDS - usage.seconds)
  const elapsedSinceSync =
    live && usage !== null && now !== null && now > usage.at ? (now - usage.at) / 1000 : 0
  const secondsLeft = Math.max(0, Math.ceil(baseRemaining - elapsedSinceSync))
  const countingSeconds = live && usage !== null && secondsLeft < MINUTE_SECONDS

  useEffect(() => {
    if (!live || usage === null) return
    if (countingSeconds) {
      const timer = setInterval(() => setNow(Date.now()), 1000)
      return () => clearInterval(timer)
    }
    const waitMs = Math.max(0, (baseRemaining - (MINUTE_SECONDS - 1)) * 1000)
    const timer = setTimeout(() => setNow(Date.now()), waitMs)
    return () => clearTimeout(timer)
  }, [live, usage, countingSeconds, baseRemaining])

  if (secondsLeft < MINUTE_SECONDS) {
    return <>Trò chuyện bằng giọng nói · còn {secondsLeft} giây</>
  }
  return <>Trò chuyện bằng giọng nói · còn {Math.round(secondsLeft / MINUTE_SECONDS)} phút</>
}

/**
 * The assistant column during a voice call: the orb in the middle, a few things to
 * try until the user speaks, and the call controls. The agent works on the calendar beside it.
 *Owns `useMealPlannerVoice` so realtime updates never re-render `MealPlannerView`.
 */
export function VoicePanel({
  weekStart,
  today,
  threadId,
  onScreen,
  onTurnEnd,
  onClose,
  getScreen,
  openRecipe,
  leading,
  trailing,
}: {
  weekStart?: string
  today?: string
  threadId: string
  onScreen: (screen: VoiceScreenCommand) => void
  onTurnEnd: (threadId: string) => void
  onClose: () => void
  getScreen: () => VoiceScreen | null
  openRecipe?: VoiceOpenRecipe | null
  leading?: ReactNode
  trailing?: ReactNode
}) {
  const voice = useMealPlannerVoice({
    weekStart,
    today,
    threadId,
    onScreen,
    onTurnEnd,
    onClose,
    getScreen,
    openRecipe,
  })
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
            <VoiceCountdown usage={voice.usage} live={live} />
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
            outputLevel={voice.outputLevel}
            simulate
            label={`Trợ lý giọng nói: ${text.label.toLowerCase()}`}
          />
        </div>
        <div className="text-center">
          <p className="font-heading text-lg font-semibold">{text.label}</p>
          <p className="mt-1 max-w-xs text-balance text-xs text-muted-foreground">{text.hint}</p>
        </div>

        {voice.ending && !failed && (
          <div role="status" className="flex max-w-xs flex-col items-center gap-2 text-center text-sm text-muted-foreground">
            <p>Đang kết thúc cuộc gọi…</p>
            <Button variant="outline" size="sm" onClick={voice.keepTalking}>
              Tiếp tục nói chuyện
            </Button>
          </div>
        )}
        {failed && (
          <div role="alert" className="flex max-w-xs flex-col items-center gap-3 text-center text-sm text-destructive">
            <p>{voice.error ?? "Cuộc trò chuyện bị ngắt."}</p>
            <Button variant="outline" size="sm" onClick={() => void voice.start()}>
              <RotateCcwIcon aria-hidden /> Kết nối lại
            </Button>
          </div>
        )}
        {!failed && !voice.heard && live && (
          <ul aria-label="Trợ lý có thể giúp" className="grid w-full max-w-xs gap-2 text-xs text-muted-foreground">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2">
                <Icon aria-hidden className="size-4 shrink-0 text-primary" />
                {text}
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
