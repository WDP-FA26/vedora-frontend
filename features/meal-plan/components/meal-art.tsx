"use client"

import { useId, useState } from "react"

import type { MealSection } from "@/features/meal-plan/meal-plan"
import { cn } from "@/lib/utils"

const FRAMES: Record<MealSection, string> = {
  BREAKFAST: "bg-brand-lemon/25",
  LUNCH: "bg-secondary",
  DINNER: "bg-brand-forest/85",
  OTHER: "bg-brand-cream/60",
}

// SVG shapes rotate and scale around their own centre, not the canvas origin.
const SELF = "origin-center [transform-box:fill-box]"
const RAYS = [0, 45, 90, 135, 180, 225, 270, 315]

/** The dish photo when the recipe has one that loads, else a small animated picture of the meal. */
export function MealArt({
  section,
  imageUrl,
  photoOnly = false,
  className,
}: {
  section: MealSection
  imageUrl?: string | null
  /** Render nothing, not the drawing, when there is no photo to show. */
  photoOnly?: boolean
  className?: string
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)

  if (imageUrl && imageUrl !== failedUrl) {
    return (
      // Hot-linked from another site, so the Next image optimizer is not used.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailedUrl(imageUrl)}
        className={cn("size-12 shrink-0 rounded-xl bg-secondary object-cover", className)}
      />
    )
  }
  if (photoOnly) return null

  return (
    <span
      aria-hidden
      className={cn("flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl", FRAMES[section], className)}
    >
      <svg viewBox="0 0 48 48" className="size-full" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {section === "BREAKFAST" && <Sunrise />}
        {section === "LUNCH" && <Noon />}
        {section === "DINNER" && <Night />}
        {section === "OTHER" && <Cup />}
      </svg>
    </span>
  )
}

function Sunrise() {
  const clip = useId()
  return (
    <>
      <clipPath id={clip}>
        <rect width="48" height="31" />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <g className="animate-meal-rise">
          <g className="stroke-brand-orange" strokeWidth="2">
            <path d="M24 12v4M12.7 17.7l2.8 2.8M35.3 17.7l-2.8 2.8M8 30h4M36 30h4" />
          </g>
          <circle cx="24" cy="30" r="9" className="fill-brand-lemon stroke-brand-orange" strokeWidth="2" />
        </g>
      </g>
      <path d="M8 32h32M14 37h20" className="stroke-brand-orange" strokeWidth="2" />
    </>
  )
}

function Noon() {
  return (
    <>
      <g className={cn("animate-meal-spin stroke-brand-orange", SELF)} strokeWidth="2">
        {RAYS.map((angle) => (
          <path key={angle} d="M24 7v5" transform={`rotate(${angle} 24 24)`} />
        ))}
      </g>
      <circle cx="24" cy="24" r="8" className="fill-brand-lemon stroke-brand-orange" strokeWidth="2" />
    </>
  )
}

function Night() {
  return (
    <>
      <path d="M31 30.5A11 11 0 0 1 19.5 15a11 11 0 1 0 11.5 15.5Z" className="fill-brand-lemon" />
      <circle cx="32" cy="14" r="1.8" className={cn("animate-feature-twinkle fill-brand-cream", SELF)} />
      <circle cx="38" cy="23" r="1.3" className={cn("animate-feature-twinkle fill-brand-cream [animation-delay:800ms]", SELF)} />
      <circle cx="27" cy="9" r="1.1" className={cn("animate-feature-twinkle fill-brand-cream [animation-delay:1500ms]", SELF)} />
    </>
  )
}

function Cup() {
  return (
    <>
      <g className="stroke-brand-orange" strokeWidth="2">
        <path d="M20 17c-1.5-2 1.5-3 0-5" className="animate-meal-steam" />
        <path d="M26 17c-1.5-2 1.5-3 0-5" className="animate-meal-steam [animation-delay:900ms]" />
      </g>
      <path d="M13 22h20v7a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8Z" className="fill-card stroke-brand-orange" strokeWidth="2" />
      <path d="M33 24h2a3.5 3.5 0 0 1 0 7h-2.5" className="stroke-brand-orange" strokeWidth="2" />
    </>
  )
}
