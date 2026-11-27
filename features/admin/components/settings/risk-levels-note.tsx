import { RiskLevelBadge } from "@/features/admin/components/moderation/risk-level-badge"

const LEVELS = [
  { level: 0, outcome: "Đăng ngay." },
  { level: 1, outcome: "Đăng ngay." },
  { level: 2, outcome: "Giữ lại, chờ admin duyệt." },
  { level: 3, outcome: "Bị chặn khi model chỉ ra được bằng chứng trong bài." },
] as const

export function RiskLevelsNote() {
  return (
    <section aria-labelledby="risk-levels-title" className="flex flex-col gap-3">
      <div>
        <h2 id="risk-levels-title" className="text-lg font-semibold">
          Mức rủi ro
        </h2>
        <p className="text-muted-foreground">
          Model đọc mỗi nội dung theo các tiêu chí dưới đây và cho một mức rủi ro. Nếu model lỗi hoặc từ chối đọc,
          bài chờ admin duyệt tay.
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {LEVELS.map(({ level, outcome }) => (
          <li key={level} className="flex items-start gap-3">
            <RiskLevelBadge level={level} className="mt-0.5 w-24 justify-center" />
            <span className="text-sm">{outcome}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
