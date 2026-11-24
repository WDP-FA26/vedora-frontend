import type { ModerationFinding } from "@/features/posts/schemas"

const PLACE_LABELS: Record<NonNullable<ModerationFinding["field"]>, string> = {
  body: "Nội dung",
  title: "Tiêu đề",
  content: "Nội dung blog",
  transcript: "Lời nói trong video",
  frame: "Khung hình video",
  image: "Ảnh",
}

function formatSeconds(seconds: number) {
  const whole = Math.floor(seconds)
  const minutes = Math.floor(whole / 60)
  const rest = String(whole % 60).padStart(2, "0")
  return `${minutes}:${rest}`
}

function placeOf(finding: ModerationFinding): string | null {
  if (!finding.field) return null
  const label = PLACE_LABELS[finding.field]
  if (finding.field === "frame" && finding.seconds != null) {
    return `${label} lúc ${formatSeconds(finding.seconds)}`
  }
  return label
}

/**
 * The parts of rejected content that broke the policy: where each one is, the
 * offending words, and why, so the author knows what to change.
 */
export function ModerationFindings({ findings }: { findings: readonly ModerationFinding[] }) {
  if (findings.length === 0) return null
  return (
    <ul aria-label="Phần vi phạm" className="flex flex-col gap-2 text-sm font-normal text-foreground">
      {findings.map((finding, index) => {
        const place = placeOf(finding)
        return (
          <li key={index} className="flex flex-col gap-0.5 rounded-lg bg-background/70 px-3 py-2">
            {place && <span className="text-xs text-muted-foreground">{place}</span>}
            {finding.quote && (
              <q className="font-medium break-words text-destructive">{finding.quote}</q>
            )}
            <span>{finding.reason}</span>
          </li>
        )
      })}
    </ul>
  )
}
