import type { EvidenceItem } from "@/features/admin/schemas"

interface Segment {
  text: string
  marked: boolean
}

/** Splits `text` (NFC) into plain and marked runs; overlapping ranges merge. */
function segmentsOf(text: string, ranges: { start: number; end: number }[]): Segment[] {
  const sorted = [...ranges].sort((left, right) => left.start - right.start)
  const segments: Segment[] = []
  let cursor = 0
  for (const range of sorted) {
    const start = Math.max(range.start, cursor)
    const end = Math.min(range.end, text.length)
    if (end <= start) continue
    if (start > cursor) segments.push({ text: text.slice(cursor, start), marked: false })
    segments.push({ text: text.slice(start, end), marked: true })
    cursor = end
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), marked: false })
  return segments
}

/** The post body with the explainer's quotes marked, as plain text. */
export function HighlightedText({
  text,
  items,
  className,
}: {
  text: string
  items: EvidenceItem[]
  className?: string
}) {
  const normalized = text.normalize("NFC")
  const ranges: { start: number; end: number }[] = []
  for (const item of items) {
    if (item.field === "body" && item.start !== null && item.end !== null) {
      ranges.push({ start: item.start, end: item.end })
    }
  }
  if (ranges.length === 0) return <p className={className}>{text}</p>

  return (
    <p className={className}>
      {segmentsOf(normalized, ranges).map((segment, index) =>
        segment.marked ? (
          <mark key={index} className="rounded-sm bg-destructive/15 px-0.5 text-foreground">
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        )
      )}
    </p>
  )
}
