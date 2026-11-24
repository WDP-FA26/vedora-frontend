import { cn } from "cn"

import { Badge } from "@/components/ui/badge"

/** The admin name of a risk level: 0 none, 1 low, 2 medium, 3 high. */
function riskLevelLabel(level: number) {
  switch (level) {
    case 0:
      return "Không rủi ro"
    case 1:
      return "Thấp"
    case 2:
      return "Trung bình"
    case 3:
      return "Cao"
    default:
      return `Mức ${level}`
  }
}

function toneOf(level: number) {
  if (level >= 3) return "destructive"
  if (level === 2) return "outline"
  return "secondary"
}

/** A quiet badge for a risk level; "—" for unrated and legacy posts. */
export function RiskLevelBadge({ level, className }: { level: number | null; className?: string }) {
  if (level === null) {
    return (
      <span className={cn("text-muted-foreground", className)} aria-label="Chưa có mức rủi ro">
        —
      </span>
    )
  }
  return (
    <Badge variant={toneOf(level)} className={className}>
      {riskLevelLabel(level)}
    </Badge>
  )
}
