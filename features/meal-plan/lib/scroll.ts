export const SCREEN_SCROLL_DIRECTIONS = ["up", "down", "top", "bottom"] as const
export type ScreenScrollDirection = (typeof SCREEN_SCROLL_DIRECTIONS)[number]

export type VoiceScrollState = {
  percent: number
  atTop: boolean
  atBottom: boolean
}

const SCROLL_EDGE_TOLERANCE_PX = 4
const SCROLL_VIEWPORT_FRACTION = 0.7

export function readScrollState(element: HTMLElement | null): VoiceScrollState | undefined {
  if (!element) return undefined
  const maxScroll = element.scrollHeight - element.clientHeight
  if (maxScroll <= SCROLL_EDGE_TOLERANCE_PX) {
    return { percent: 0, atTop: true, atBottom: true }
  }
  const top = Math.max(0, Math.min(element.scrollTop, maxScroll))
  return {
    percent: Math.round((top / maxScroll) * 100),
    atTop: top <= SCROLL_EDGE_TOLERANCE_PX,
    atBottom: top >= maxScroll - SCROLL_EDGE_TOLERANCE_PX,
  }
}

export function scrollContainer(element: HTMLElement | null, direction: ScreenScrollDirection) {
  if (!element) return
  const reduceMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const behavior: ScrollBehavior = reduceMotion ? "auto" : "smooth"
  if (direction === "top") {
    element.scrollTo({ top: 0, behavior })
    return
  }
  if (direction === "bottom") {
    element.scrollTo({ top: element.scrollHeight, behavior })
    return
  }
  const delta = Math.round(element.clientHeight * SCROLL_VIEWPORT_FRACTION)
  element.scrollBy({ top: direction === "down" ? delta : -delta, behavior })
}
