"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { useBilling } from "@/features/billing/hooks"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { Spinner } from "@/components/ui/spinner"
import {
  ActivityIcon,
  BookOpenIcon,
  CalendarRangeIcon,
  MicIcon,
  MicOffIcon,
  NotebookPenIcon,
  PhoneOffIcon,
  RotateCcwIcon,
  ShoppingBasketIcon,
  SlidersHorizontalIcon,
  type LucideIcon,
} from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { VoiceOrb, type VoiceOrbState } from "@/components/ui/voice-orb"
import { useMealPlannerVoice } from "@/features/meal-plan/hooks/use-meal-planner-voice"
import { type VoiceAiDenoiseStatus, type VoiceMicSettings } from "@/features/meal-plan/voice/voice-capture"
import type { VoiceOpenRecipe } from "@/features/meal-plan/voice/voice-session"
import type { VoiceScreen, VoiceScreenCommand } from "@/features/meal-plan/voice/voice-stream"
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

const FEATURES: { icon: LucideIcon; text: string }[] = [
  { icon: CalendarRangeIcon, text: "Lên và đổi món trong thực đơn tuần" },
  { icon: BookOpenIcon, text: "Mở công thức, đọc nguyên liệu và từng bước" },
  { icon: ShoppingBasketIcon, text: "Mở và đọc danh sách đi chợ" },
  { icon: NotebookPenIcon, text: "Ghi món đã ăn vào nhật ký" },
  { icon: ActivityIcon, text: "Cập nhật cân nặng, xem BMI" },
]

const METER_MIN_DB = -70
const METER_MAX_DB = -10

function dbToPercent(db: number): number {
  const clamped = Math.max(METER_MIN_DB, Math.min(METER_MAX_DB, db))
  return ((clamped - METER_MIN_DB) / (METER_MAX_DB - METER_MIN_DB)) * 100
}

const AI_DENOISE_STATUS_TEXT: Record<VoiceAiDenoiseStatus, string | null> = {
  off: null,
  loading: "Đang nạp mô hình…",
  active: "Đang khử nhiễu 48 kHz",
  overloaded: "Thiết bị quá tải, tạm dùng lọc cơ bản",
  error: "Không tải được mô hình, dùng lọc cơ bản",
}

function MicSettingsPopover({
  settings,
  aiDenoiseStatus,
  onChange,
  readLevelDb,
  disabled,
}: {
  settings: VoiceMicSettings
  aiDenoiseStatus: VoiceAiDenoiseStatus
  onChange: (patch: Partial<VoiceMicSettings>) => void
  readLevelDb: () => number
  disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    let rafId = 0
    const tick = () => {
      if (barRef.current) {
        barRef.current.style.width = `${dbToPercent(readLevelDb()).toFixed(1)}%`
      }
      rafId = window.requestAnimationFrame(tick)
    }
    rafId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(rafId)
  }, [open, readLevelDb])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            shape="pill"
            disabled={disabled}
            aria-label="Micro và lọc nhiễu"
          />
        }
      >
        <SlidersHorizontalIcon aria-hidden />
      </PopoverTrigger>
      <PopoverContent side="top" align="center" sideOffset={10} className="w-72">
        <PopoverHeader>
          <PopoverTitle>Micro</PopoverTitle>
          <PopoverDescription>
            Trợ lý nghe trọn những gì micro thu được. Bật lọc nhiễu AI nếu xung quanh ồn.
          </PopoverDescription>
        </PopoverHeader>

        <div className="space-y-2.5">
          <label className="flex cursor-pointer items-center justify-between gap-3 text-xs font-medium">
            <span className="flex flex-col gap-0.5">
              <span>Lọc nhiễu AI (DeepFilterNet3)</span>
              {AI_DENOISE_STATUS_TEXT[aiDenoiseStatus] && (
                <span className="text-[11px] font-normal text-muted-foreground">
                  {AI_DENOISE_STATUS_TEXT[aiDenoiseStatus]}
                </span>
              )}
            </span>
            <Switch
              size="sm"
              checked={settings.aiDenoise}
              onCheckedChange={(checked) => onChange({ aiDenoise: checked })}
            />
          </label>
        </div>

        <div className="space-y-1.5">
          <div className="text-[11px] text-muted-foreground">Mức âm thanh micro</div>
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div ref={barRef} className="h-full rounded-full bg-emerald-500" style={{ width: "0%" }} />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function VoicePanel(props: Parameters<typeof ProVoicePanel>[0]) {
  const billing = useBilling()
  if (billing.isLoading || !billing.data || billing.error) {
    return <div className="flex h-full min-h-64 flex-col items-center justify-center gap-4 p-6 text-center">
      {billing.error ? <><p>Chưa kiểm tra được quyền sử dụng thoại AI.</p><Button variant="outline" onClick={() => void billing.mutate().catch(() => undefined)}>Thử lại</Button></> : <><Spinner /><p>Đang kiểm tra gói của bạn…</p></>}
      <Button variant="ghost" onClick={props.onClose}>Quay lại</Button>
    </div>
  }
  if (billing.data.membership.planCode !== "PRO") {
    return <div className="flex h-full min-h-64 flex-col items-center justify-center gap-4 p-6 text-center">
      <LogoMark className="size-16" />
      <h2 className="font-heading text-xl font-semibold">Thoại AI hai chiều dành cho Pro</h2>
      <p className="max-w-sm text-sm text-muted-foreground">Nâng cấp Pro để trò chuyện trực tiếp với trợ lý Vedora. Mỗi yêu cầu trợ lý qua voice dùng 1 lượt AI chữ, không tính hạn mức phút.</p>
      <Link href="/billing" className={buttonVariants()}>Xem gói Pro</Link>
      <Button variant="ghost" onClick={props.onClose}>Quay lại</Button>
    </div>
  }
  return <ProVoicePanel {...props} />
}

function ProVoicePanel({
  weekStart,
  today,
  threadId,
  onScreen,
  onTurnEnd,
  onClose,
  getScreen,
  openRecipe,
  showFloatingBar = false,
  onExpandMobile,
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
  showFloatingBar?: boolean
  onExpandMobile?: () => void
  leading?: ReactNode
  trailing?: ReactNode
}) {
  const billing = useBilling()
  const { user } = useAuth()
  const exhausted = user?.role !== "ADMIN" && billing.data?.usage.text.remaining === 0
  const voice = useMealPlannerVoice({
    canStart: !exhausted,
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
            Trò chuyện bằng giọng nói · Đặc quyền Pro
          </p>
          <p className="text-xs text-muted-foreground">Mỗi yêu cầu qua voice dùng 1 lượt AI chữ{billing.data && ` · Còn ${billing.data.usage.text.remaining.toLocaleString("vi-VN")} lượt`}</p>
        </div>
        {trailing}
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 overflow-y-auto px-6 py-8">
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
            <Button variant="outline" size="sm" disabled={exhausted} onClick={() => void voice.start()}>
              <RotateCcwIcon aria-hidden /> Kết nối lại
            </Button>
            {exhausted && <Link href="/billing" className={buttonVariants({ variant: "outline", size: "sm" })}>Xem gói và hạn mức</Link>}
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
        <MicSettingsPopover
          settings={voice.micSettings}
          aiDenoiseStatus={voice.aiDenoiseStatus}
          onChange={voice.updateMicSettings}
          readLevelDb={voice.readMicLevelDb}
          disabled={!live}
        />
        <Button variant="destructive" size="pill" shape="pill" onClick={() => void voice.end()}>
          <PhoneOffIcon aria-hidden /> Kết thúc
        </Button>
      </footer>
      {showFloatingBar &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="region"
            aria-label="Điều khiển giọng nói"
            className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-sm items-center justify-between gap-2 rounded-full border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur-md lg:hidden"
          >
            <button
              type="button"
              onClick={onExpandMobile}
              className="flex min-w-0 items-center gap-2 text-left text-xs font-semibold text-foreground"
            >
              <span
                className="size-2.5 shrink-0 rounded-full bg-primary animate-pulse motion-reduce:animate-none"
                aria-hidden
              />
              <span className="truncate">{text.label}</span>
            </button>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                shape="pill"
                disabled={!live}
                aria-pressed={voice.muted}
                aria-label={voice.muted ? "Bật micro" : "Tắt micro"}
                onClick={() => void voice.toggleMute()}
              >
                {voice.muted ? <MicOffIcon aria-hidden /> : <MicIcon aria-hidden />}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="pill-sm"
                shape="pill"
                onClick={() => void voice.end()}
              >
                <PhoneOffIcon aria-hidden />
                Kết thúc
              </Button>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
