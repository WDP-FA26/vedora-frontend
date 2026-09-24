import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export type FeatureArtName = "video" | "blog" | "verified" | "garden"

/**
 * Small looping line illustrations for the platform cards. Plain CSS
 * animations, so they cost nothing on the main thread and hold still under
 * reduced motion (each animation is `motion-safe:` only).
 */
export function FeatureArt({
  name,
  className,
}: {
  name: FeatureArtName
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 160 100"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("text-primary", className)}
    >
      {art[name]}
    </svg>
  )
}

const muted = "stroke-muted-foreground/35"

const art: Record<FeatureArtName, ReactNode> = {
  // A pot simmering on a phone screen while the clip plays through.
  video: (
    <>
      <rect x="52" y="6" width="56" height="88" rx="11" strokeWidth="2" className={muted} />
      <path d="M72 11h16" strokeWidth="2" className={muted} />
      {[72, 80, 88].map((x, i) => (
        <path
          key={x}
          d={`M${x} 50q-4-5 0-10t0-10`}
          stroke="currentColor"
          strokeWidth="2"
          className="transform-fill motion-safe:animate-feature-rise"
          style={{ animationDelay: `${i * 0.45}s` }}
        />
      ))}
      <path d="M62 58h36" stroke="currentColor" strokeWidth="2.5" />
      <path
        d="M65 58v8a8 8 0 0 0 8 8h14a8 8 0 0 0 8-8v-8"
        stroke="currentColor"
        strokeWidth="2.5"
        className="fill-primary/15"
      />
      <path d="M62 84h36" strokeWidth="3" className={muted} />
      <path
        d="M62 84h36"
        stroke="currentColor"
        strokeWidth="3"
        className="origin-left transform-fill motion-safe:animate-feature-fill"
      />
    </>
  ),

  // An article writing itself under a swaying leaf.
  blog: (
    <>
      <rect x="40" y="8" width="80" height="84" rx="9" strokeWidth="2" className={muted} />
      <rect x="48" y="16" width="64" height="30" rx="5" className="fill-primary/12" />
      <path
        d="M80 42c-10-6-12-16-2-22 8 5 10 14 2 22Zm0 0v-17"
        stroke="currentColor"
        strokeWidth="2"
        className="origin-bottom transform-fill motion-safe:animate-pet-sway"
      />
      {[
        [56, 64],
        [66, 56],
        [76, 42],
      ].map(([y, width], i) => (
        <path
          key={y}
          d={`M48 ${y}h${width}`}
          stroke="currentColor"
          strokeWidth="3"
          className="origin-left transform-fill motion-safe:animate-feature-fill"
          style={{ animationDelay: `${i * 0.35}s` }}
        />
      ))}
    </>
  ),

  // A chef whose badge checks in.
  verified: (
    <>
      <circle cx="78" cy="52" r="32" className="fill-primary/10" />
      <path
        d="M66 34a7 7 0 0 1 4-13 9 9 0 0 1 16 0 7 7 0 0 1 4 13v5H66Z"
        strokeWidth="2"
        className="fill-card stroke-muted-foreground/60"
      />
      <circle cx="78" cy="50" r="10" strokeWidth="2" className="fill-card stroke-muted-foreground/60" />
      <path d="M58 82a20 18 0 0 1 40 0" strokeWidth="2" className="stroke-muted-foreground/60" />
      <g className="origin-center transform-fill motion-safe:animate-feature-pop">
        <circle cx="104" cy="72" r="12" className="fill-primary" />
        <path
          d="m98 72 4 4 8-8"
          pathLength={1}
          strokeWidth="2.5"
          className="stroke-primary-foreground [stroke-dasharray:1] motion-safe:animate-feature-draw"
        />
      </g>
      {[
        [44, 28, 0],
        [116, 30, 0.8],
        [120, 50, 1.6],
      ].map(([cx, cy, delay]) => (
        <path
          key={cx}
          d={`M${cx} ${cy - 4}v8m-4-4h8`}
          stroke="currentColor"
          strokeWidth="2"
          className="origin-center transform-fill motion-safe:animate-feature-twinkle"
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
    </>
  ),

  // Rows sway in the sun while a harvest hops over to the plate.
  garden: (
    <>
      <g className="origin-center transform-fill motion-safe:animate-[spin_14s_linear_infinite]">
        {Array.from({ length: 8 }, (_, i) => (
          <path
            key={i}
            d="M30 12v-4"
            stroke="currentColor"
            strokeWidth="2"
            transform={`rotate(${i * 45} 30 24)`}
          />
        ))}
        <circle cx="30" cy="24" r="6" className="fill-primary/25" />
      </g>
      <path d="M14 82h64" strokeWidth="2" className={muted} />
      {[28, 46, 64].map((x, i) => (
        <path
          key={x}
          d={`M${x} 82v-14m0 4c-6-1-9-6-8-11 5 1 8 5 8 11Zm0-2c5-1 8-6 7-11-5 1-7 5-7 11Z`}
          stroke="currentColor"
          strokeWidth="2"
          className="origin-bottom fill-primary/15 transform-fill motion-safe:animate-pet-sway"
          style={{ animationDelay: `${i * -0.7}s` }}
        />
      ))}
      <path d="M74 60q24-34 50 14" strokeWidth="2" strokeDasharray="2 5" className={muted} />
      <circle
        r="4"
        className="fill-primary [offset-path:path('M74_60q24-34_50_14')] motion-safe:animate-feature-travel"
      />
      <path d="M100 76h48" stroke="currentColor" strokeWidth="2.5" />
      <path d="M104 76a20 12 0 0 0 40 0" strokeWidth="2" className="fill-primary/12 stroke-muted-foreground/60" />
    </>
  ),
}
