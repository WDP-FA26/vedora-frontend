import type { ModerationChoice, ModerationPolicyDraft, ModerationSettings } from "@/features/admin/schemas"

export const KEY_PATTERN = /^[a-z][a-z0-9_]{1,31}$/
export const MAX_CHOICES = 16

/** The editable part of saved settings, which is what the API takes back. */
export function policyOf(settings: ModerationSettings): ModerationPolicyDraft {
  const { instructions, allowDescription, choices, rejectThreshold, reviewThreshold } = settings
  return {
    instructions,
    allowDescription,
    choices,
    rejectThreshold,
    reviewThreshold,
  }
}

/** How strict the check is: where a violation chance turns into "wait for an admin" and "blocked". */
export const STRICTNESS_LEVELS = [
  {
    id: "relaxed",
    label: "Thoải mái",
    detail: "Hợp với cộng đồng nhỏ hoặc khi admin ít thời gian. Bài hơi đáng ngờ vẫn được đăng.",
    review: 0.5,
    reject: 0.95,
  },
  {
    id: "balanced",
    label: "Cân bằng",
    detail: "Cân giữa an toàn và công sức duyệt. Bài rõ ràng vi phạm bị chặn, bài lưng chừng chờ admin.",
    review: 0.3,
    reject: 0.85,
  },
  {
    id: "strict",
    label: "Nghiêm ngặt",
    detail: "Hợp khi cần an toàn cao, ví dụ mới ra mắt hoặc có người dùng nhỏ tuổi. Sẽ có nhiều bài chờ duyệt hơn.",
    review: 0.15,
    reject: 0.7,
  },
] as const

/** The level the thresholds match, or null for custom ones set under "Nâng cao". */
export function strictnessOf(settings: Pick<ModerationSettings, "rejectThreshold" | "reviewThreshold">) {
  return (
    STRICTNESS_LEVELS.find(
      (level) => level.reject === settings.rejectThreshold && level.review === settings.reviewThreshold
    ) ?? null
  )
}

/** "Thông tin sai lệch" -> "thong_tin_sai_lech": a code the model and stored verdicts can use. */
export function slugify(name: string) {
  const words = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
  // Keep whole words up to the API's 32-character limit, leaving room for a "_2" suffix.
  let slug = ""
  for (const word of words) {
    const next = slug ? `${slug}_${word}` : word
    if (next.length > 28) break
    slug = next
  }
  if (!slug) slug = (words[0] ?? "").slice(0, 28)
  return /^[a-z]/.test(slug) ? slug : `c_${slug}`
}

/** `base`, or `base_2`, `base_3`… when a category already uses it. */
export function uniqueKey(base: string, taken: ReadonlySet<string>) {
  const root = base.length >= 2 ? base : `${base}_x`
  if (!taken.has(root) && root !== "allow") return root
  for (let n = 2; ; n++) {
    const candidate = `${root}_${n}`
    if (!taken.has(candidate)) return candidate
  }
}

/** Why a category cannot be saved yet, in plain Vietnamese. */
export function criterionProblems(choice: Pick<ModerationChoice, "label" | "description" | "reasonText">) {
  const problems: string[] = []
  const label = choice.label.trim().length
  const description = choice.description.trim().length
  const reason = choice.reasonText.trim().length
  if (label < 1 || label > 40) problems.push("Tên tiêu chí cần 1–40 ký tự.")
  if (description < 10 || description > 800) problems.push("Mô tả cần 10–800 ký tự.")
  if (reason < 3 || reason > 120) problems.push("Lý do hiển thị cho tác giả cần 3–120 ký tự.")
  return problems
}

/** The draft with every text trimmed, which is what gets saved and compared. */
export function normalizeDraft(draft: ModerationPolicyDraft): ModerationPolicyDraft {
  return {
    instructions: draft.instructions.trim(),
    allowDescription: draft.allowDescription.trim(),
    choices: draft.choices.map(({ key, label, reasonText, description }) => ({
      key,
      label: label.trim(),
      reasonText: reasonText.trim(),
      description: description.trim(),
    })),
    rejectThreshold: draft.rejectThreshold,
    reviewThreshold: draft.reviewThreshold,
  }
}

/** Whether saving would change anything: whitespace and untouched edits do not count. */
export function isDirty(draft: ModerationPolicyDraft, saved: ModerationPolicyDraft) {
  return JSON.stringify(normalizeDraft(draft)) !== JSON.stringify(normalizeDraft(saved))
}

/** Why the draft cannot be saved yet, in plain Vietnamese. */
export function draftProblems(draft: ModerationPolicyDraft) {
  const problems: string[] = []
  const instructions = draft.instructions.trim().length
  const allow = draft.allowDescription.trim().length
  if (instructions < 20 || instructions > 3000) problems.push("Hướng dẫn chung cần 20–3000 ký tự.")
  if (allow < 10 || allow > 800) problems.push("Mô tả “Không vi phạm” cần 10–800 ký tự.")
  if (draft.choices.length < 1) problems.push("Cần ít nhất một tiêu chí vi phạm.")
  for (const choice of draft.choices) {
    for (const problem of criterionProblems(choice)) problems.push(`${choice.label || choice.key}: ${problem}`)
  }
  const { reviewThreshold, rejectThreshold } = draft
  if (!(reviewThreshold >= 0 && rejectThreshold <= 1 && reviewThreshold < rejectThreshold)) {
    problems.push("Ngưỡng chờ admin phải nhỏ hơn ngưỡng chặn (trong khoảng 0–100%).")
  }
  return problems
}
