export type TranscriptCue = {
  /** Seconds from the start of the video. */
  start: number
  end: number
  text: string
}

const TIMING = /^((?:\d+:)?\d{2}:\d{2}[.,]\d{3})\s+-->\s+((?:\d+:)?\d{2}:\d{2}[.,]\d{3})/

function toSeconds(timestamp: string) {
  return timestamp
    .replace(",", ".")
    .split(":")
    .reduce((total, part) => total * 60 + Number(part), 0)
}

/** Reads the cues of a WebVTT file, dropping its header, notes and inline tags. */
export function parseVtt(vtt: string): TranscriptCue[] {
  const cues: TranscriptCue[] = []
  for (const block of vtt.replace(/\r/g, "").split(/\n{2,}/)) {
    const lines = block.split("\n")
    const timingIndex = lines.findIndex((line) => TIMING.test(line))
    if (timingIndex === -1) continue

    const [, start, end] = TIMING.exec(lines[timingIndex])!
    const text = lines
      .slice(timingIndex + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .trim()
    if (text) cues.push({ start: toSeconds(start), end: toSeconds(end), text })
  }
  return cues
}
