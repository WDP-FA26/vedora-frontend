"use client"

// From chatcn, chat, voice and agent UI for shadcn: https://chatcn.dev

import * as React from "react"
import { cn } from "@/lib/utils"

/** chatcn theme variables and utilities this file uses, light and dark. */
const CHATCN_CSS = ":root{--chatcn-bg:oklch(1 0 0);--chatcn-border:var(--chatcn-gray-400);--chatcn-fg:var(--chatcn-gray-1000);--chatcn-fg-faint:var(--chatcn-gray-700);--chatcn-fg-muted:var(--chatcn-gray-900);--chatcn-fg-subtle:var(--chatcn-gray-800);--chatcn-fill:var(--chatcn-gray-100);--chatcn-fill-active:var(--chatcn-gray-300);--chatcn-gray-100:oklch(0.970 0 0);--chatcn-gray-1000:oklch(0.145 0 0);--chatcn-gray-300:oklch(0.930 0 0);--chatcn-gray-400:oklch(0.910 0 0);--chatcn-gray-700:oklch(0.700 0 0);--chatcn-gray-800:oklch(0.525 0 0);--chatcn-gray-900:oklch(0.440 0 0);--chatcn-radius-md:8px}.dark{--chatcn-bg:oklch(0.145 0 0);--chatcn-border:var(--chatcn-gray-400);--chatcn-fg:var(--chatcn-gray-1000);--chatcn-fg-faint:var(--chatcn-gray-700);--chatcn-fg-muted:var(--chatcn-gray-900);--chatcn-fg-subtle:var(--chatcn-gray-800);--chatcn-fill:var(--chatcn-gray-100);--chatcn-fill-active:var(--chatcn-gray-300);--chatcn-gray-100:oklch(0.195 0 0);--chatcn-gray-1000:oklch(0.970 0 0);--chatcn-gray-300:oklch(0.255 0 0);--chatcn-gray-400:oklch(0.285 0 0);--chatcn-gray-700:oklch(0.500 0 0);--chatcn-gray-800:oklch(0.620 0 0);--chatcn-gray-900:oklch(0.720 0 0)}"
if (typeof document !== "undefined" && !document.getElementById("chatcn-voice-orb")) {
  const style = document.createElement("style")
  style.id = "chatcn-voice-orb"
  style.textContent = CHATCN_CSS
  document.head.appendChild(style)
}

/* -------------------------------------------------------------------------------------------------
 * Types
 * -----------------------------------------------------------------------------------------------*/

export type VoiceOrbState =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "interrupted"
  | "muted"
  | "error"

export const voiceOrbStateLabels: Record<VoiceOrbState, string> = {
  idle: "Ready",
  connecting: "Connecting",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  interrupted: "Interrupted",
  muted: "Muted",
  error: "Disconnected",
}

/* -------------------------------------------------------------------------------------------------
 * Level and band sources
 *
 * Voice components take audio levels as plain values or as getters. A number re-renders the
 * component on every change, which is fine at 20 updates a second. A getter is read once per
 * animation frame and never re-renders anything, which is what a 60 fps meter wants.
 * -----------------------------------------------------------------------------------------------*/

/** A level from 0 to 1, or a function that returns the current one. */
type ChatcnLevel = number | (() => number)

export type VoiceOrbSize = "sm" | "md" | "lg" | "xl"

export interface VoiceOrbProps extends Omit<React.ComponentProps<"div">, "children"> {
  state?: VoiceOrbState
  /**
   * Audio level from 0 to 1: the user's input while listening, the agent's output while speaking.
   * Pass a getter (`() => number`) to animate at 60 fps without re-rendering.
   */
  level?: ChatcnLevel
  /** Input level, when you meter both sides. Used while listening. Falls back to `level`. */
  inputLevel?: ChatcnLevel
  /** Output level, when you meter both sides. Used while speaking. Falls back to `level`. */
  outputLevel?: ChatcnLevel
  /**
   * Drive listening and speaking with a built-in speech simulator wherever no level is passed.
   * For demos, empty states and design reviews without a microphone. Default `false`.
   */
  simulate?: boolean
  /** 40, 72, 144 or 224 px, or any number of px. Default `lg`. */
  size?: VoiceOrbSize | number
  /**
   * `canvas` draws the moving sphere. `svg` is the lightweight fallback: the same forms, still,
   * with the level scaling the whole orb. `auto` picks canvas and falls back where 2D canvas is
   * missing. Default `auto`.
   */
  renderer?: "auto" | "canvas" | "svg"
  /** Force reduced motion on or off. Defaults to the user's setting. */
  reducedMotion?: boolean
  /** Accessible name. Defaults to the state, for example "Voice: listening". */
  label?: string
}

const SIZES: Record<VoiceOrbSize, number> = { sm: 40, md: 72, lg: 144, xl: 224 }

/* -------------------------------------------------------------------------------------------------
 * Reduced motion
 * -----------------------------------------------------------------------------------------------*/

const REDUCED = "(prefers-reduced-motion: reduce)"

/** True when the user asked for reduced motion. Updates live when the setting changes. */
function useChatcnPrefersReducedMotion() {
  const [reduced, setReduced] = React.useState(false)
  React.useEffect(() => {
    const query = window.matchMedia?.(REDUCED)
    if (!query) return
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])
  return reduced
}

interface ChatcnSpeechLevel {
  /** Current smoothed level from 0 to 1. Call it every frame. */
  getLevel: () => number
  /** `count` band levels from 0 to 1, lowest first, with two moving formant humps. */
  getBands: (count: number) => Float32Array
  setSpeaking: (speaking: boolean) => void
  isSpeaking: () => boolean
}

/* -------------------------------------------------------------------------------------------------
 * Simulated speech levels
 *
 * Demos, tests and design reviews need a voice without a microphone. A random walk reads as
 * noise; speech has syllables (about four a second), short gaps between words and a slower phrase
 * contour. This generator models those three layers so a meter driven by it looks like someone
 * talking.
 * -----------------------------------------------------------------------------------------------*/

interface ChatcnSpeechLevelOptions {
  /** Changes the rhythm, so two voices never move in lockstep. Default 1. */
  seed?: number
  /** Syllables per second. Default 4.2. */
  syllableRate?: number
  /** Peak level from 0 to 1. Default 0.8. */
  loudness?: number
  /** Level while silent, so a live meter never looks dead. Default 0.02. */
  floor?: number
}

const fract = (x: number) => x - Math.floor(x)

const hash = (n: number, seed: number) => fract(Math.sin(n * 12.9898 + seed * 78.233) * 43758.5453)

/** A speech-like level source you start and stop. Framework free; see `useChatcnSimulatedLevel`. */
export function createChatcnSpeechLevel(options: ChatcnSpeechLevelOptions = {}): ChatcnSpeechLevel {
  const { seed = 1, syllableRate = 4.2, loudness = 0.8, floor = 0.02 } = options
  let speaking = false
  let envelope = floor
  let last = 0
  let phase = 0
  let syllable = 0

  const target = (t: number) => {
    if (!speaking) return floor + 0.01 * (0.5 + 0.5 * Math.sin(t * 7.3 + seed))
    const k = Math.floor(phase)
    const u = phase - k
    let amp = 0.45 + 0.55 * hash(k, seed)
    // Roughly one slot in six is the gap between words.
    if (hash(k * 1.7 + 3, seed) < 0.17) amp *= 0.08
    const shape = u < 0.22 ? (u / 0.22) ** 0.7 : (1 - (u - 0.22) / 0.78) ** 1.5
    const contour = 0.78 + 0.22 * Math.sin(t * 0.55 + seed * 2)
    return loudness * contour * (0.12 + 0.88 * amp * shape)
  }

  const getLevel = () => {
    const now = performance.now()
    if (now - last < 8) return envelope
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60
    last = now
    const t = now / 1000
    // Syllable length jitters by up to 40 percent, so the rhythm never ticks like a clock.
    const k = Math.floor(phase)
    phase += dt * syllableRate * (0.8 + 0.4 * hash(k * 3.1, seed))
    syllable = k
    const goal = target(t)
    const rate = goal > envelope ? 28 : 9
    envelope += (goal - envelope) * (1 - Math.exp(-rate * dt))
    return envelope
  }

  const getBands = (count: number) => {
    const level = getLevel()
    const out = new Float32Array(Math.max(0, count))
    const t = performance.now() / 1000
    // Formants move per syllable: vowels change where the energy sits.
    const f1 = 0.16 + 0.1 * hash(syllable * 2.3, seed)
    const f2 = 0.42 + 0.18 * hash(syllable * 5.9 + 1, seed)
    for (let i = 0; i < count; i++) {
      const x = count === 1 ? 0.5 : i / (count - 1)
      const bump = Math.exp(-(((x - f1) / 0.14) ** 2)) + 0.75 * Math.exp(-(((x - f2) / 0.2) ** 2))
      const air = 0.18 * (1 - x)
      const flicker = 0.85 + 0.15 * Math.sin(t * 23 + i * 1.9 + seed)
      out[i] = Math.min(1, level * (bump + air) * flicker * 1.15)
    }
    return out
  }

  return {
    getLevel,
    getBands,
    setSpeaking: (next) => {
      speaking = next
    },
    isSpeaking: () => speaking,
  }
}

const clamp01 = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0)

/** Reads a level source. Undefined reads as silence. */
function readLevel(level: ChatcnLevel | undefined): number {
  if (level === undefined) return 0
  return clamp01(typeof level === "function" ? level() : level)
}

/* -------------------------------------------------------------------------------------------------
 * Form
 *
 * The orb is a sphere drawn as fine contour lines, tilted toward the viewer. Lines facing you are
 * darker and heavier, lines turning away are lighter, and the far side shows through faintly, so
 * the form reads as volume without a single gradient. Every state is a set of form parameters;
 * the canvas eases the current form toward the target every frame, so any state can follow any
 * other and the sphere morphs instead of cutting.
 *
 * - idle: calm, breathing slowly, the surface barely drifting.
 * - connecting: each line traced only in part, the traces chasing around the sphere.
 * - listening: waves travel inward to the front of the sphere and swell with the user's voice.
 * - thinking: smaller, turning on its axis, a band of light sweeping down it. Masks latency.
 * - speaking: waves travel outward from the front and the sphere swells with the agent's voice.
 * - interrupted: pressed flat, the waves stopped, the moment the user cuts in.
 * - muted: dotted lines, faint and still.
 * - error: the sphere split in two.
 *
 * The direction of the waves says who is talking, so the orb reads with the sound off.
 * -----------------------------------------------------------------------------------------------*/

interface OrbForm {
  /** Radius multiplier. */
  scale: number
  /** Flowing surface displacement. */
  flow: number
  /** How fast the surface flows. */
  stir: number
  /** Height of the waves running across the front. */
  wave: number
  /** Wave speed. Positive travels outward from the front, negative inward. */
  travel: number
  /** Turn speed around the vertical axis, in radians per second. */
  turn: number
  /** Breathing amplitude. */
  breathe: number
  /** Line opacity. */
  ink: number
  /** Opacity of the far side, seen through the front. */
  back: number
  /** Share of each line drawn, 1 whole. Below 1 the traces chase around the sphere. */
  trace: number
  /** 0 solid lines, 1 dotted. */
  dots: number
  /** 0 whole, 1 split in two. */
  split: number
  /** 0 round, 1 flattened. */
  squash: number
  /** A band of light sweeping down the lines, the orb's version of the Thinking shimmer. */
  shimmer: number
}

/** Level-driven additions. Listening draws waves inward; speaking sends them out and swells. */
function withLevel(form: OrbForm, state: VoiceOrbState, level: number): OrbForm {
  if (state === "listening") {
    return {
      ...form,
      scale: form.scale + 0.06 * level,
      flow: form.flow + 0.05 * level,
      stir: form.stir + 1.1 * level,
      wave: form.wave + 0.05 * level,
      travel: form.travel - 2.2 * level,
    }
  }
  if (state === "speaking") {
    return {
      ...form,
      scale: form.scale + 0.08 * level,
      flow: form.flow + 0.03 * level,
      stir: form.stir + 1.4 * level,
      wave: form.wave + 0.065 * level,
      travel: form.travel + 2.6 * level,
    }
  }
  return form
}

function f(partial: Partial<OrbForm>): OrbForm {
  return {
    scale: 0.9,
    flow: 0,
    stir: 0,
    wave: 0,
    travel: 0,
    turn: 0,
    breathe: 0,
    ink: 1,
    back: 0.11,
    trace: 1,
    dots: 0,
    split: 0,
    squash: 0,
    shimmer: 0,
    ...partial,
  }
}

const FORMS: Record<VoiceOrbState, OrbForm> = {
  idle: f({ flow: 0.022, stir: 0.32, turn: 0.1, breathe: 0.014 }),
  connecting: f({ scale: 0.86, flow: 0.012, stir: 0.4, turn: 0.5, trace: 0.3, back: 0.08 }),
  listening: f({ flow: 0.03, stir: 0.6, wave: 0.014, travel: -0.9, turn: 0.16, breathe: 0.01 }),
  thinking: f({ scale: 0.84, flow: 0.08, stir: 1.3, turn: 1, breathe: 0.024, shimmer: 1 }),
  speaking: f({ flow: 0.026, stir: 0.7, wave: 0.02, travel: 1.3, turn: 0.22 }),
  interrupted: f({ scale: 0.88, flow: 0.016, squash: 0.16, back: 0.1 }),
  muted: f({ scale: 0.86, ink: 0.62, back: 0.05, dots: 1 }),
  error: f({ scale: 0.86, ink: 0.55, back: 0.06, split: 1 }),
}

/** Mid level for still frames, so listening and speaking still differ in shape. */
const STILL_LEVEL = 0.4

/** A state's form as a still frame: no breathing, and a longer trace so connecting reads. */
function stillForm(state: VoiceOrbState): OrbForm {
  const form = withLevel(FORMS[state], state, STILL_LEVEL)
  return { ...form, breathe: 0, trace: form.trace < 1 ? 0.55 : 1 }
}

/** Lines and samples per line for an orb of `px` CSS pixels. */
function density(px: number) {
  return {
    lines: Math.round(Math.min(22, Math.max(5, px / 10))),
    samples: px > 120 ? 120 : px > 60 ? 84 : 56,
  }
}

/** Phases that advance with time. Kept apart from the form so speed changes never jump. */
interface OrbPhase {
  flow: number
  wave: number
  turn: number
  breath: number
  trace: number
  /** Shimmer position, 0 above the sphere to 1 below it. */
  sweep: number
}

/* -------------------------------------------------------------------------------------------------
 * Geometry, shared by the canvas and the SVG renderers
 * -----------------------------------------------------------------------------------------------*/

type Point = [number, number]

interface Strokes {
  /** Front polylines by depth band (nearest last), then by shimmer step: `band * GLOWS + step`. */
  front: Point[][][]
  /** Far side polylines. */
  back: Point[][]
}

/** Depth bands for the front lines. Each band strokes once, so a frame is a handful of strokes. */
const BANDS = 5

/** Shimmer steps per depth band. Lines move between them a step at a time as the light passes. */
const GLOWS = 4

/** View tilt: the top of the sphere leans toward the viewer, so the upper lines open into rings. */
const TILT = 0.36

const COS_T = Math.cos(TILT)

const SIN_T = Math.sin(TILT)

/** Contour lines of the sphere at radius `r` around (cx, cy), sorted into depth bands. */
function sphere(
  form: OrbForm,
  phase: OrbPhase,
  cx: number,
  cy: number,
  r: number,
  lines: number,
  samples: number,
): Strokes {
  const front: Point[][][] = Array.from({ length: BANDS * GLOWS }, () => [])
  const back: Point[][] = []
  const breath = 1 + form.breathe * Math.sin(phase.breath)
  const radius = r * form.scale * breath
  const sx = 1 + form.squash * 0.5
  const sy = 1 - form.squash
  const ct = Math.cos(phase.turn)
  const st = Math.sin(phase.turn)

  for (let i = 0; i < lines; i++) {
    const lat = -Math.PI / 2 + (Math.PI * (i + 1)) / (lines + 1)
    const cl = Math.cos(lat)
    const sl = Math.sin(lat)
    // Each line's trace starts a little later than the one above, so traces spiral.
    const start = phase.trace + i * 0.06
    // How lit this line is by the shimmer band, in steps. Full light everywhere without shimmer.
    // Lines count from the bottom, so the light runs from the top of the sphere down.
    const off = (1 - (i + 0.5) / lines - (phase.sweep * 1.3 - 0.15)) / 0.18
    const near = Math.exp(-off * off)
    const lit = 1 - form.shimmer * (1 - near)
    const step = Math.round(lit * (GLOWS - 1))

    let line: Point[] | null = null
    let band = -2
    let prev: Point | null = null
    let prevZ = 0
    let prevOn = false

    for (let j = 0; j <= samples; j++) {
      const a = (j / samples) * Math.PI * 2
      const ux = cl * Math.cos(a)
      const uy = sl
      const uz = cl * Math.sin(a)
      // The flow field turns with the sphere; the lines themselves are symmetric.
      const fx = ux * ct - uz * st
      const fz = ux * st + uz * ct
      // Tilt toward the viewer: view space y and depth.
      const vy = uy * COS_T - uz * SIN_T
      const vz = uy * SIN_T + uz * COS_T

      const flow =
        0.5 * Math.sin(2.3 * fx + 1.4 * uy + phase.flow) +
        0.3 * Math.sin(3.1 * uy - 1.9 * fz - phase.flow * 1.27 + 1.1) +
        0.2 * Math.sin(4.3 * fz + 2.6 * fx + phase.flow * 0.71 + 2.4)
      // Waves run out from (or in to) the point of the sphere nearest the viewer.
      const front01 = Math.max(vz, 0)
      const dist = Math.acos(Math.min(1, Math.max(-1, vz)))
      const wave = Math.sin(dist * 8 - phase.wave) * front01

      // Small rings near the poles move less, so they never crumple into polygons.
      const give = 0.3 + 0.7 * cl
      const rr = radius * (1 + give * (form.flow * flow + form.wave * wave))
      // Waves also lift the lines on screen, so they read even where the surface faces you.
      const lift = form.wave * wave * radius * 0.7 * give
      const point: Point = [cx + ux * rr * sx, cy - (vy * rr + lift) * sy]

      let on = true
      // Near whole, draw whole: the last sliver of a trace would show as a pinhole gap.
      if (form.trace < 0.985) {
        const u = (((j / samples - start) % 1) + 1) % 1
        on = u < form.trace
      }

      if (prev && on && prevOn) {
        const z = (prevZ + vz) / 2
        const next = z < 0 ? -1 : Math.min(BANDS - 1, Math.floor(z * BANDS)) * GLOWS + step
        if (next !== band || !line) {
          line = [prev]
          if (next < 0) back.push(line)
          else (front[next] as Point[][]).push(line)
          band = next
        }
        line.push(point)
      } else {
        line = null
        band = -2
      }
      prev = point
      prevZ = vz
      prevOn = on
    }
  }
  return { front, back }
}

const STILL_PHASE: OrbPhase = {
  flow: 1.3,
  wave: 2.2,
  turn: 0.6,
  breath: 0,
  trace: 0.15,
  sweep: 0.4,
}

/** Base line weight in CSS pixels for an orb of `px`. */
const lineWeight = (px: number) => Math.min(1.6, Math.max(0.9, px / 130))

/** Moves `current` toward `target` with an exponential approach: critically damped, no bounce. */
function approach(current: number, target: number, rate: number, dt: number) {
  return current + (target - current) * (1 - Math.exp(-rate * dt))
}

function polylineData(points: Point[]) {
  let d = ""
  for (let k = 0; k < points.length; k++) {
    const p = points[k] as Point
    d += `${k ? "L" : "M"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`
  }
  return d
}

/** Opacity and weight of a front band: the nearer, the darker and heavier, then the shimmer. */
function bandStyle(index: number) {
  const z = (Math.floor(index / GLOWS) + 0.5) / BANDS
  const lit = (index % GLOWS) / (GLOWS - 1)
  return { alpha: (0.28 + 0.72 * z ** 0.8) * (0.45 + 0.55 * lit), weight: 0.7 + 0.55 * z }
}

/* -------------------------------------------------------------------------------------------------
 * SVG renderer: the fallback, and the form reference
 * -----------------------------------------------------------------------------------------------*/

function OrbSvg({
  state,
  px,
  levelFor,
  reducedMotion,
}: {
  state: VoiceOrbState
  px: number
  levelFor: () => number
  reducedMotion: boolean
}) {
  // A plain id: useId's punctuation is not valid inside url(#...).
  const id = `orb${React.useId().replace(/[^a-zA-Z0-9]/g, "")}`
  const scaleRef = React.useRef<SVGGElement>(null)
  const form = stillForm(state)
  const C = 50
  const R = 45
  const { lines, samples } = density(px)
  const strokes = sphere(form, STILL_PHASE, C, C, R, lines, samples)
  // Stroke widths in viewBox units, so lines keep their CSS pixel weight at any size.
  const unit = 100 / px
  const weight = lineWeight(px) * unit
  const live = !reducedMotion && (state === "listening" || state === "speaking")

  // Level drives a scale on the whole sphere, written straight to the DOM at about 30 fps.
  const levelRef = React.useRef(levelFor)
  levelRef.current = levelFor
  React.useEffect(() => {
    const el = scaleRef.current
    if (!el) return
    if (!live) {
      el.style.scale = ""
      return
    }
    let raf = 0
    let last = 0
    let env = 0
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (now - last < 33) return
      const dt = last ? (now - last) / 1000 : 0.033
      last = now
      const lvl = levelRef.current()
      env = approach(env, lvl, lvl > env ? 16 : 5, dt)
      el.style.scale = String(1 + env * 0.08)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [live])

  const dash = form.dots > 0.5 ? `0 ${(weight * 3.2).toFixed(2)}` : undefined
  const drawing = (
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      {strokes.back.length ? (
        <path
          d={strokes.back.map(polylineData).join("")}
          strokeOpacity={form.back * form.ink}
          strokeWidth={weight * 0.7}
          strokeDasharray={dash}
        />
      ) : null}
      {strokes.front.map((bandLines, band) => {
        if (!bandLines.length) return null
        const style = bandStyle(band)
        return (
          <path
            // Bands are fixed positions from near to far.
            key={band}
            d={bandLines.map(polylineData).join("")}
            strokeOpacity={style.alpha * form.ink}
            strokeWidth={weight * style.weight * (form.dots > 0.5 ? 1.5 : 1)}
            strokeDasharray={dash}
          />
        )
      })}
    </g>
  )

  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      data-slot="voice-orb-svg"
      className="absolute inset-0 size-full overflow-visible"
    >
      <defs>
        <clipPath id={`${id}-top`}>
          <rect x="0" y="0" width="100" height="50" />
        </clipPath>
        <clipPath id={`${id}-bottom`}>
          <rect x="0" y="50" width="100" height="50" />
        </clipPath>
      </defs>
      <g
        ref={scaleRef}
        className="origin-center transition-[scale] duration-100 ease-linear [transform-box:view-box]"
      >
        {form.split > 0 ? (
          <>
            <g transform={`translate(0 ${-R * 0.06})`}>
              <g clipPath={`url(#${id}-top)`}>{drawing}</g>
            </g>
            <g transform={`translate(0 ${R * 0.06})`}>
              <g clipPath={`url(#${id}-bottom)`}>{drawing}</g>
            </g>
          </>
        ) : (
          drawing
        )}
      </g>
    </svg>
  )
}

/* -------------------------------------------------------------------------------------------------
 * Theme colors for canvas
 * -----------------------------------------------------------------------------------------------*/

/** Resolved theme colors as CSS strings the canvas understands. Alpha goes through `globalAlpha`. */
interface ChatcnVoiceColors {
  /** The canvas `color`, so `text-*` classes tint the drawing. Defaults to the foreground. */
  fg: string
  muted: string
  subtle: string
  faint: string
  border: string
  fill: string
  bg: string
}

/* -------------------------------------------------------------------------------------------------
 * useChatcnVoiceCanvas
 * -----------------------------------------------------------------------------------------------*/

interface ChatcnVoiceFrame {
  ctx: CanvasRenderingContext2D
  /** CSS pixels. The context is already scaled for the device pixel ratio. */
  width: number
  height: number
  dpr: number
  /** Seconds of animated time. Only advances while frames run, so nothing jumps on resume. */
  t: number
  /** Seconds since the previous frame, capped at 50 ms. */
  dt: number
  colors: ChatcnVoiceColors
  reducedMotion: boolean
}

/** Draws one frame. Return true to keep animating, false to sleep until `invalidate()`. */
type ChatcnVoiceDraw = (frame: ChatcnVoiceFrame) => boolean

interface UseChatcnVoiceCanvasOptions {
  /** Force reduced motion on or off. Defaults to the user's setting. */
  reducedMotion?: boolean
}

interface ChatcnVoiceCanvas {
  /** Attach to a `<canvas>`. Its CSS size is observed; the backing store follows it. */
  ref: (element: HTMLCanvasElement | null) => void
  /** Ask for a frame. Call after props change; the loop sleeps when the drawing settles. */
  invalidate: () => void
  reducedMotion: boolean
  /** False until the canvas has a 2D context. Render a fallback while false. */
  supported: boolean
}

function readColors(element: Element): ChatcnVoiceColors {
  const style = getComputedStyle(element)
  const v = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  const fg = style.color || v("--chatcn-fg", "currentColor")
  return {
    fg,
    muted: v("--chatcn-fg-muted", fg),
    subtle: v("--chatcn-fg-subtle", fg),
    faint: v("--chatcn-fg-faint", fg),
    border: v("--chatcn-border", fg),
    fill: v("--chatcn-fill-active", fg),
    bg: v("--chatcn-bg", "transparent"),
  }
}

/**
 * A sleeping requestAnimationFrame loop for voice visuals. Handles device pixel ratio, resizes,
 * theme changes (colors are re-read from CSS, so dark mode and `text-*` classes just work), and
 * pauses while the canvas is off screen or the tab is hidden. The draw function decides when to
 * sleep, so a settled orb or a silent meter costs nothing.
 */
function useChatcnVoiceCanvas(
  draw: ChatcnVoiceDraw,
  options: UseChatcnVoiceCanvasOptions = {},
): ChatcnVoiceCanvas {
  const prefersReduced = useChatcnPrefersReducedMotion()
  const reducedMotion = options.reducedMotion ?? prefersReduced
  const [supported, setSupported] = React.useState(true)

  const drawRef = React.useRef(draw)
  drawRef.current = draw
  const reducedRef = React.useRef(reducedMotion)
  reducedRef.current = reducedMotion

  const s = React.useRef({
    canvas: null as HTMLCanvasElement | null,
    ctx: null as CanvasRenderingContext2D | null,
    colors: null as ChatcnVoiceColors | null,
    raf: 0,
    running: false,
    visible: true,
    last: 0,
    t: 0,
    cleanup: [] as (() => void)[],
  })

  const frame = React.useCallback((now: number) => {
    const st = s.current
    st.raf = 0
    const canvas = st.canvas
    const ctx = st.ctx
    if (!canvas || !ctx) {
      st.running = false
      return
    }
    const dt = st.last ? Math.min(0.05, Math.max(0, (now - st.last) / 1000)) : 1 / 60
    st.last = now
    st.t += dt

    const dpr = Math.min(3, window.devicePixelRatio || 1)
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    const bw = Math.max(1, Math.round(width * dpr))
    const bh = Math.max(1, Math.round(height * dpr))
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw
      canvas.height = bh
    }
    if (!st.colors) st.colors = readColors(canvas)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    ctx.globalAlpha = 1

    const keep =
      width > 0 &&
      height > 0 &&
      drawRef.current({
        ctx,
        width,
        height,
        dpr,
        t: st.t,
        dt,
        colors: st.colors,
        reducedMotion: reducedRef.current,
      })

    if (keep && st.visible) {
      st.raf = requestAnimationFrame(frameRef.current)
    } else {
      st.running = false
      st.last = 0
    }
  }, [])
  const frameRef = React.useRef(frame)
  frameRef.current = frame

  const invalidate = React.useCallback(() => {
    const st = s.current
    if (st.running || !st.ctx) return
    st.running = true
    st.raf = requestAnimationFrame(frameRef.current)
  }, [])

  const ref = React.useCallback(
    (canvas: HTMLCanvasElement | null) => {
      const st = s.current
      for (const fn of st.cleanup) fn()
      st.cleanup = []
      if (st.raf) cancelAnimationFrame(st.raf)
      st.raf = 0
      st.running = false
      st.canvas = canvas
      st.ctx = null
      st.colors = null
      if (!canvas) return

      const ctx = canvas.getContext("2d")
      if (!ctx) {
        setSupported(false)
        return
      }
      st.ctx = ctx

      const refreshColors = () => {
        st.colors = null
        invalidate()
      }

      const resize = new ResizeObserver(() => invalidate())
      resize.observe(canvas)
      st.cleanup.push(() => resize.disconnect())

      const io = new IntersectionObserver((entries) => {
        const entry = entries[entries.length - 1]
        st.visible = entry ? entry.isIntersecting && !document.hidden : true
        if (st.visible) invalidate()
      })
      io.observe(canvas)
      st.cleanup.push(() => io.disconnect())

      const onVisibility = () => {
        st.visible = !document.hidden
        if (st.visible) invalidate()
      }
      document.addEventListener("visibilitychange", onVisibility)
      st.cleanup.push(() => document.removeEventListener("visibilitychange", onVisibility))

      // Theme switches toggle a class or attribute on <html>; the system theme fires a query.
      const mo = new MutationObserver(refreshColors)
      mo.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "style", "data-theme"],
      })
      st.cleanup.push(() => mo.disconnect())
      const dark = window.matchMedia?.("(prefers-color-scheme: dark)")
      dark?.addEventListener("change", refreshColors)
      st.cleanup.push(() => dark?.removeEventListener("change", refreshColors))

      invalidate()
    },
    [invalidate],
  )

  // Reduced motion changes the drawing, so draw again.
  React.useEffect(() => {
    void reducedMotion
    invalidate()
  }, [reducedMotion, invalidate])

  React.useEffect(
    () => () => {
      const st = s.current
      for (const fn of st.cleanup) fn()
      if (st.raf) cancelAnimationFrame(st.raf)
    },
    [],
  )

  return { ref, invalidate, reducedMotion, supported }
}

const KEYS = Object.keys(FORMS.idle) as (keyof OrbForm)[]

/** Breathing period per state, in seconds. */
const BREATH: Partial<Record<VoiceOrbState, number>> = { idle: 4.6, listening: 3.4, thinking: 1.8 }

function tracePolyline(ctx: CanvasRenderingContext2D, points: Point[]) {
  const first = points[0] as Point
  ctx.moveTo(first[0], first[1])
  for (let k = 1; k < points.length; k++) {
    const p = points[k] as Point
    ctx.lineTo(p[0], p[1])
  }
}

/* -------------------------------------------------------------------------------------------------
 * Canvas renderer
 * -----------------------------------------------------------------------------------------------*/

function OrbCanvas({
  state,
  levelFor,
  reducedMotion,
  onUnsupported,
}: {
  state: VoiceOrbState
  levelFor: () => number
  reducedMotion?: boolean
  onUnsupported: () => void
}) {
  const stateRef = React.useRef(state)
  stateRef.current = state
  const levelRef = React.useRef(levelFor)
  levelRef.current = levelFor

  const m = React.useRef({
    form: { ...FORMS[state] },
    phase: { ...STILL_PHASE },
    level: 0,
    first: true,
  })

  const canvas = useChatcnVoiceCanvas(
    ({ ctx, width, height, dt, colors, reducedMotion: reduced }) => {
      const st = m.current
      const current = stateRef.current
      const raw = current === "listening" || current === "speaking" ? levelRef.current() : 0

      // Reduced motion: the target form at fixed phases. Nothing moves; each state is a still.
      let form: OrbForm
      let phase: OrbPhase
      if (reduced) {
        form = stillForm(current)
        phase = STILL_PHASE
        st.form = { ...form }
        st.phase = { ...STILL_PHASE }
        st.level = 0
      } else {
        // Fast attack, slower release: syllables swell and settle, never flicker.
        st.level = approach(st.level, raw, raw > st.level ? 16 : 5, dt)
        const target = withLevel(FORMS[current], current, st.level)
        for (const key of KEYS) {
          // Splits and squashes land quickly; everything else glides.
          const rate = key === "split" || key === "squash" ? 11 : key === "trace" ? 4 : 6
          st.form[key] = st.first ? target[key] : approach(st.form[key], target[key], rate, dt)
        }
        st.first = false
        form = st.form
        st.phase.flow += dt * form.stir
        st.phase.wave += dt * form.travel * 6
        st.phase.turn += dt * form.turn
        st.phase.breath += (dt * Math.PI * 2) / (BREATH[current] ?? 3.6)
        st.phase.trace += dt * 0.42
        // One sweep every 1.8 s, the same pace as the Thinking label's shimmer.
        st.phase.sweep = (st.phase.sweep + dt / 1.8) % 1
        phase = st.phase
      }

      const px = Math.min(width, height)
      const cx = width / 2
      const cy = height / 2
      const r = (px / 2) * 0.9
      const { lines, samples } = density(px)
      const strokes = sphere(form, phase, cx, cy, r, lines, samples)
      const weight = lineWeight(px)

      const paint = () => {
        ctx.strokeStyle = colors.fg
        ctx.lineCap = "round"
        ctx.lineJoin = "round"
        if (form.dots > 0.5) ctx.setLineDash([0, weight * 3.2])
        else if (form.dots > 0.01) ctx.setLineDash([weight * 6 * (1 - form.dots), weight * 3.2])
        if (form.back > 0.005 && strokes.back.length) {
          ctx.beginPath()
          for (const line of strokes.back) tracePolyline(ctx, line)
          ctx.globalAlpha = form.back * form.ink
          ctx.lineWidth = weight * 0.7
          ctx.stroke()
        }
        strokes.front.forEach((bandLines, band) => {
          if (!bandLines.length) return
          const style = bandStyle(band)
          ctx.beginPath()
          for (const line of bandLines) tracePolyline(ctx, line)
          ctx.globalAlpha = style.alpha * form.ink
          ctx.lineWidth = weight * style.weight * (form.dots > 0.5 ? 1.5 : 1)
          ctx.stroke()
        })
        ctx.setLineDash([])
        ctx.globalAlpha = 1
      }

      if (form.split > 0.01) {
        const gap = form.split * r * 0.12
        for (const half of [-1, 1]) {
          ctx.save()
          // Move first, then clip in the moved space, so each half keeps a clean cut edge.
          ctx.translate(0, (gap / 2) * half)
          ctx.beginPath()
          ctx.rect(0, half < 0 ? 0 : cy, width, half < 0 ? cy : height - cy)
          ctx.clip()
          paint()
          ctx.restore()
        }
      } else {
        paint()
      }

      if (reduced) return false
      // Sleep once the form has settled and nothing moves.
      const target = withLevel(FORMS[current], current, st.level)
      const settled = KEYS.every((key) => Math.abs(st.form[key] - target[key]) < 0.0015)
      const moving =
        (form.stir > 0.002 && form.flow > 0.0005) ||
        form.breathe > 0.0005 ||
        form.turn > 0.002 ||
        form.trace < 0.985 ||
        form.shimmer > 0.005 ||
        (Math.abs(form.travel) > 0.002 && form.wave > 0.0005)
      return !settled || moving || st.level > 0.002
    },
    { reducedMotion },
  )

  React.useEffect(() => {
    void state
    canvas.invalidate()
  }, [state, canvas.invalidate])

  React.useEffect(() => {
    if (!canvas.supported) onUnsupported()
  }, [canvas.supported, onUnsupported])

  return (
    // The wrapper is role="img", so the canvas is already presentational.
    <canvas ref={canvas.ref} data-slot="voice-orb-canvas" className="absolute inset-0 size-full" />
  )
}

/* -------------------------------------------------------------------------------------------------
 * VoiceOrb
 * -----------------------------------------------------------------------------------------------*/

/**
 * The voice presence. A monochrome sphere of fine contour lines whose form and motion carry the
 * whole state machine: no color, no glow. Feed it a level (a number, or a getter for 60 fps) and
 * a state; it morphs between states on its own. Canvas by default, an SVG fallback with the same
 * forms, and a still form per state under reduced motion.
 */
export function VoiceOrb({
  state = "idle",
  level,
  inputLevel,
  outputLevel,
  simulate = false,
  size = "lg",
  renderer = "auto",
  reducedMotion: reducedProp,
  label,
  className,
  style,
  ...props
}: VoiceOrbProps) {
  const px = typeof size === "number" ? size : SIZES[size]
  const prefersReduced = useChatcnPrefersReducedMotion()
  const reducedMotion = reducedProp ?? prefersReduced
  const [canvasFailed, setCanvasFailed] = React.useState(false)
  const useSvg = renderer === "svg" || (renderer === "auto" && canvasFailed)

  // Two simulated voices, made on first use, so a plain orb costs nothing extra.
  const sims = React.useRef<{ user: ChatcnSpeechLevel; agent: ChatcnSpeechLevel } | null>(null)
  if (simulate && !sims.current) {
    sims.current = {
      user: createChatcnSpeechLevel({ seed: 3 }),
      agent: createChatcnSpeechLevel({ seed: 7, loudness: 0.85 }),
    }
  }
  React.useEffect(() => {
    const s = sims.current
    if (!s) return
    s.user.setSpeaking(simulate && state === "listening")
    s.agent.setSpeaking(simulate && state === "speaking")
  }, [simulate, state])

  const sources = React.useRef({ level, inputLevel, outputLevel, state, simulate })
  sources.current = { level, inputLevel, outputLevel, state, simulate }
  const levelFor = React.useCallback(() => {
    const { level: l, inputLevel: i, outputLevel: o, state: st, simulate: sim } = sources.current
    const s = sim ? sims.current : null
    if (st === "listening") {
      const source = i ?? l
      return source === undefined && s ? s.user.getLevel() : readLevel(source)
    }
    if (st === "speaking") {
      const source = o ?? l
      return source === undefined && s ? s.agent.getLevel() : readLevel(source)
    }
    return 0
  }, [])
  const onUnsupported = React.useCallback(() => setCanvasFailed(true), [])

  return (
    <div
      role="img"
      aria-label={label ?? `Voice: ${voiceOrbStateLabels[state].toLowerCase()}`}
      data-slot="voice-orb"
      data-voice-state={state}
      data-renderer={useSvg ? "svg" : "canvas"}
      style={{ width: px, height: px, ...style }}
      className={cn("text-(color:--chatcn-fg) relative shrink-0 select-none", className)}
      {...props}
    >
      {useSvg ? (
        <OrbSvg state={state} px={px} levelFor={levelFor} reducedMotion={reducedMotion} />
      ) : (
        <OrbCanvas
          state={state}
          levelFor={levelFor}
          reducedMotion={reducedProp}
          onUnsupported={onUnsupported}
        />
      )}
    </div>
  )
}

export default VoiceOrb
