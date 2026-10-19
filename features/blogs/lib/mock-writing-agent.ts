/**
 * Canned replies for the writing assistant's side panel. There is no model
 * behind it yet: the panel is a design stand-in, so nothing here may read as
 * advice from a real assistant about nutrition or health.
 */

type MockProposal = {
  summary: string
  /** Markdown the author can put in the post. */
  markdown: string
}

export type MockReply = {
  text: string
  /** Names the edit the assistant marked in the post, shown on its card. */
  summary?: string
  /** Titles the author can pick from. */
  titles?: string[]
  proposal?: MockProposal
}

export const QUICK_PROMPTS = [
  "Gợi ý tiêu đề",
  "Lên dàn ý cho công thức",
  "Viết mở bài",
  "Gợi ý phần mẹo nhỏ",
  "Chỉnh câu văn",
] as const

/** Prompts that ask to edit the author's own text rather than write new text. */
export const EDIT_PATTERN = /sửa|chỉnh|viết lại|gọn|câu văn|rà /i

const FILLERS = /\s*\b(rất|thật sự|khá là|kiểu như|nói chung là|thì|à|nha|nhé nha|ấy)\b/gi

/**
 * A stand-in for a rewrite: drops filler words, tidies spacing and
 * punctuation, and capitalises. It only removes and re-spaces; it never adds
 * words, so it can't put claims in the author's mouth.
 */
export function tidyText(text: string) {
  const tidy = text
    .replace(FILLERS, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim()
  if (tidy === "") return text
  const capitalised = tidy.charAt(0).toLocaleUpperCase("vi") + tidy.slice(1)
  return /[.!?…:]$/.test(capitalised) ? capitalised : `${capitalised}.`
}

export const AGENT_WELCOME =
  "Chào bạn! Mình sẽ ngồi cạnh khi bạn viết: gợi ý tiêu đề, lên dàn ý, viết mở bài hay chỉnh câu văn. Bạn muốn bắt đầu từ đâu?"

/** The topic is the author's own title, or a placeholder when they have none yet. */
export function mockReply(prompt: string, title: string): MockReply {
  const topic = title.trim() || "món ăn của bạn"
  const text = prompt.toLowerCase()

  if (/tiêu đề|tieu de|đặt tên|title/.test(text)) {
    return {
      text: "Mình có vài hướng đặt tên, bạn bấm để dùng nhé:",
      titles: [
        `${topic}: làm tại nhà trong một buổi tối`,
        `Cách nấu ${topic} đơn giản, dễ làm`,
        `${topic} — công thức mình hay nấu mỗi tuần`,
      ],
    }
  }
  if (/dàn ý|dan y|outline|cấu trúc|công thức/.test(text)) {
    return {
      text: "Đây là dàn ý cho một bài công thức. Bạn thêm vào bài rồi điền chi tiết nhé.",
      proposal: {
        summary: "Dàn ý công thức",
        markdown: [
          "## Vì sao mình thích món này",
          "",
          "Kể ngắn gọn câu chuyện hoặc dịp bạn hay nấu món này.",
          "",
          "## Nguyên liệu",
          "",
          "- Nguyên liệu chính",
          "- Gia vị",
          "",
          "## Cách làm",
          "",
          "1. Sơ chế",
          "2. Nấu",
          "3. Trình bày",
          "",
          "## Mẹo nhỏ",
          "",
          "Một điều bạn rút ra sau nhiều lần nấu.",
        ].join("\n"),
      },
    }
  }
  if (/mở bài|mo bai|giới thiệu|bắt đầu/.test(text)) {
    return {
      text: "Một đoạn mở bài để bạn chỉnh lại theo giọng của mình:",
      proposal: {
        summary: "Đoạn mở bài",
        markdown: `Hôm nay mình muốn chia sẻ cách nấu ${topic}. Đây là món mình hay làm khi muốn một bữa ăn nhẹ nhàng mà vẫn đủ đầy, và công thức bên dưới đủ đơn giản để bạn thử ngay tối nay.`,
      },
    }
  }
  if (/mẹo|meo|lưu ý|tip/.test(text)) {
    return {
      text: "Bạn có thể kết bài bằng một phần mẹo ngắn:",
      proposal: {
        summary: "Phần mẹo nhỏ",
        markdown: "## Mẹo nhỏ\n\n- Nếm và chỉnh gia vị ở cuối cùng.\n- Chuẩn bị sẵn nguyên liệu trước khi bắt đầu nấu.",
      },
    }
  }
  return {
    text: "Mình giúp được những việc như gợi ý tiêu đề, lên dàn ý, viết mở bài hay phần mẹo. Bạn thử một gợi ý bên dưới nhé.",
  }
}
