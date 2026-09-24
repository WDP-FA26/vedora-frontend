"use client"

import { createContext, use, useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"

import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"
import {
  PET_COOKIE,
  PET_OFFSET_COOKIE,
  isPetChoice,
  pets,
  serializeOffset,
  type PetChoice,
  type PetOffset,
  type PetPreference,
} from "@/features/shared/lib/pet-preference"

const ONE_YEAR = 60 * 60 * 24 * 365

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${ONE_YEAR}; samesite=lax`
}

type PetContextValue = PetPreference & {
  setPet: (pet: PetChoice) => void
  setOffset: (offset: PetOffset) => void
}

const PetContext = createContext<PetContextValue | null>(null)

/** Seeded from cookies on the server, so the right pet renders on the first frame. */
export function PetProvider({ initial, children }: { initial: PetPreference; children: ReactNode }) {
  const [pet, setPetState] = useState(initial.pet)
  const [offset, setOffsetState] = useState(initial.offset)

  const value: PetContextValue = {
    pet,
    offset,
    setPet: (next) => {
      writeCookie(PET_COOKIE, next)
      setPetState(next)
    },
    setOffset: (next) => {
      writeCookie(PET_OFFSET_COOKIE, serializeOffset(next))
      setOffsetState(next)
    },
  }

  return <PetContext value={value}>{children}</PetContext>
}

function usePet() {
  const context = use(PetContext)
  if (!context) throw new Error("usePet must be used inside <PetProvider>")
  return context
}

export function PetMenuGroup() {
  const { pet, setPet } = usePet()

  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>Trợ lý dinh dưỡng</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={pet}
        onValueChange={(value) => {
          if (isPetChoice(value)) setPet(value)
        }}
      >
        {pets.map(({ value, label }) => (
          <DropdownMenuRadioItem key={value} value={value}>
            {label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuGroup>
  )
}

const DRAG_THRESHOLD = 4

const GREETING = "Xin chào! Mình là trợ lý dinh dưỡng của bạn 🌱"
const REMINDER = "Hỏi mình về dinh dưỡng nhé!"
const MESSAGE_VISIBLE_MS = 25_000
const MESSAGE_INTERVAL_MS = 3 * 60_000

/** Greets on first load, then repeats the reminder every 3 minutes for 25s. */
function usePetMessage() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const show = (text: string) => {
      setMessage(text)
      timers.push(setTimeout(() => setMessage(null), MESSAGE_VISIBLE_MS))
    }
    timers.push(setTimeout(() => show(GREETING), 0))
    const interval = setInterval(() => show(REMINDER), MESSAGE_INTERVAL_MS)
    return () => {
      timers.forEach(clearTimeout)
      clearInterval(interval)
    }
  }, [])

  return message
}

export function NutritionPet() {
  const message = usePetMessage()
  const { pet, offset: savedOffset, setOffset } = usePet()
  const [dragOffset, setDragOffset] = useState<PetOffset | null>(null)
  const drag = useRef<{ startX: number; startY: number; origin: PetOffset; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const offset = dragOffset ?? savedOffset

  return (
    <Link
      href="/home/nutrition-chat"
      aria-label="Mở Trợ lý dinh dưỡng (kéo để di chuyển)"
      draggable={false}
      style={{ translate: `${offset.x}px ${offset.y}px` }}
      className="group fixed right-4 bottom-20 z-40 flex touch-none items-end gap-2 select-none sm:right-6 sm:bottom-6"
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.currentTarget.setPointerCapture(event.pointerId)
        drag.current = { startX: event.clientX, startY: event.clientY, origin: offset, moved: false }
      }}
      onPointerMove={(event) => {
        const state = drag.current
        if (!state) return
        const dx = event.clientX - state.startX
        const dy = event.clientY - state.startY
        if (!state.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
        state.moved = true
        setDragOffset({ x: state.origin.x + dx, y: state.origin.y + dy })
      }}
      onPointerUp={(event) => {
        const state = drag.current
        drag.current = null
        if (!state?.moved || !dragOffset) return
        suppressClick.current = true
        // keep the pet fully on screen
        const rect = event.currentTarget.getBoundingClientRect()
        const nudgeX = Math.max(0, -rect.left) - Math.max(0, rect.right - window.innerWidth)
        const nudgeY = Math.max(0, -rect.top) - Math.max(0, rect.bottom - window.innerHeight)
        setOffset({ x: dragOffset.x + nudgeX, y: dragOffset.y + nudgeY })
        setDragOffset(null)
      }}
      onPointerCancel={() => {
        drag.current = null
        setDragOffset(null)
      }}
      onClick={(event) => {
        if (!suppressClick.current) return
        suppressClick.current = false
        event.preventDefault()
      }}
    >
      <span
        role="status"
        data-visible={message !== null || undefined}
        className="mb-16 max-w-52 rounded-2xl rounded-br-sm border border-border bg-popover px-3 py-1.5 text-sm font-medium text-popover-foreground pointer-events-none opacity-0 shadow-sm transition-opacity duration-300 data-visible:pointer-events-auto data-visible:opacity-100 sm:group-hover:opacity-100"
      >
        {message ?? REMINDER}
      </span>
      {pet === "salad" ? <SaladPet /> : <SproutPet />}
    </Link>
  )
}

const petClassName =
  "size-24 animate-pet-bob drop-shadow-md transition-transform group-hover:scale-110 sm:size-32"

function Eyes({ cy }: { cy: number }) {
  return (
    <g className="animate-pet-blink" style={{ transformOrigin: `32px ${cy}px` }}>
      <ellipse cx="25" cy={cy} rx="2.5" ry="3.5" fill="oklch(0.2 0 0)" />
      <ellipse cx="39" cy={cy} rx="2.5" ry="3.5" fill="oklch(0.2 0 0)" />
      <circle cx="25.8" cy={cy - 1.3} r="0.9" fill="white" />
      <circle cx="39.8" cy={cy - 1.3} r="0.9" fill="white" />
    </g>
  )
}

function SproutPet() {
  return (
    <svg viewBox="0 0 64 72" className={petClassName} aria-hidden>
      <g className="origin-[32px_22px] animate-pet-sway">
        <path d="M32 22 C32 14 32 10 32 8" stroke="var(--color-primary)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M32 10 C24 2 16 6 18 12 C22 14 28 13 32 10Z" fill="oklch(0.72 0.17 145)" />
        <path d="M32 10 C40 2 48 6 46 12 C42 14 36 13 32 10Z" fill="oklch(0.65 0.17 145)" />
      </g>
      <ellipse cx="32" cy="46" rx="24" ry="22" fill="oklch(0.8 0.15 140)" />
      <ellipse cx="32" cy="52" rx="15" ry="11" fill="oklch(0.9 0.08 140)" />
      <circle cx="17" cy="48" r="3.5" fill="oklch(0.78 0.12 20)" opacity="0.6" />
      <circle cx="47" cy="48" r="3.5" fill="oklch(0.78 0.12 20)" opacity="0.6" />
      <Eyes cy={42} />
      <path d="M28 50 Q32 54 36 50" stroke="oklch(0.2 0 0)" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  )
}

const limb = { stroke: "oklch(0.3 0.03 60)", strokeWidth: 2.2, fill: "none", strokeLinecap: "round" as const }

function SaladPet() {
  return (
    <svg viewBox="0 0 64 72" className={petClassName} aria-hidden>
      {/* legs */}
      <g className="origin-[26px_56px] animate-pet-step">
        <path d="M26 56 L24 67 L20 68" {...limb} />
      </g>
      <g className="origin-[38px_56px] animate-pet-step [animation-delay:-0.4s]">
        <path d="M38 56 L40 67 L44 68" {...limb} />
      </g>
      {/* arms */}
      <path d="M9 40 L3 46 L1 43" {...limb} />
      <g className="origin-[55px_40px] animate-pet-wave">
        <path d="M55 40 L61 32 L63 34 M61 32 L60 29" {...limb} />
      </g>
      {/* greens piled above the bowl */}
      <circle cx="18" cy="30" r="8" fill="oklch(0.7 0.17 140)" />
      <circle cx="30" cy="24" r="9" fill="oklch(0.62 0.17 145)" />
      <circle cx="44" cy="28" r="8.5" fill="oklch(0.74 0.16 130)" />
      <circle cx="24" cy="23" r="3.5" fill="oklch(0.65 0.2 28)" />
      <circle cx="40" cy="21" r="3" fill="oklch(0.65 0.2 28)" />
      <ellipse cx="50" cy="33" rx="4" ry="2.5" fill="oklch(0.88 0.15 95)" />
      <ellipse cx="13" cy="34" rx="3.5" ry="2" fill="oklch(0.6 0.12 330)" />
      {/* bowl */}
      <path d="M7 34 H57 C57 48 47 58 32 58 C17 58 7 48 7 34Z" fill="oklch(0.93 0.03 80)" stroke="oklch(0.75 0.06 70)" strokeWidth="1.5" />
      <circle cx="17" cy="45" r="3" fill="oklch(0.78 0.12 20)" opacity="0.6" />
      <circle cx="47" cy="45" r="3" fill="oklch(0.78 0.12 20)" opacity="0.6" />
      <Eyes cy={42} />
      <path d="M28 49 Q32 53 36 49" stroke="oklch(0.2 0 0)" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  )
}
