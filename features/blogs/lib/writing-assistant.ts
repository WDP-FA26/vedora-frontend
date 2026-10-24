import { z } from "zod"

import { API_URL } from "@/features/auth/lib/api"

export const BLOG_ASSISTANT_CHAT_URL = `${API_URL}/blogs/ai/chat`
export const BLOG_ASSISTANT_QUOTA_URL = `${API_URL}/blogs/ai/quota`

/** Mirror `BlogAssistantChatDto` in vedora-api. */
export const MAX_ASSISTANT_MESSAGES = 40
export const MAX_ASSISTANT_MESSAGE_LENGTH = 4000
export const MAX_SELECTION_LENGTH = 4000

/** Tools the agent calls but the browser runs, on the author's say-so. */
export const EDITOR_TOOLS = ["replaceSelection", "replaceText", "insertMarkdown", "setTitle", "insertImage"] as const
export type EditorTool = (typeof EDITOR_TOOLS)[number]

export function isEditorTool(name: string): name is EditorTool {
  return (EDITOR_TOOLS as readonly string[]).includes(name)
}

/** Editor tools that mark their change in the post. */
export const SUGGESTION_TOOLS = ["replaceSelection", "replaceText", "insertMarkdown"] as const

const position = z.enum(["cursor", "end", "after"])

// Mirror the input schemas of vedora-api's editor tools.
export const editorToolInputs = {
  replaceSelection: z.object({ markdown: z.string() }),
  replaceText: z.object({ find: z.string(), replace: z.string() }),
  insertMarkdown: z.object({ markdown: z.string(), position, after: z.string().optional() }),
  setTitle: z.object({ title: z.string() }),
  insertImage: z.object({
    url: z.string(),
    alt: z.string(),
    position,
    after: z.string().optional(),
    /** An image already in the post that this one takes the place of. */
    replaces: z.string().optional(),
  }),
} satisfies Record<EditorTool, z.ZodType>

export const editorToolOutputSchema = z.object({
  applied: z.boolean(),
  error: z.enum(["NO_SELECTION", "NOT_FOUND", "AMBIGUOUS", "STALE"]).optional(),
  reason: z.string().optional(),
})
export type EditorToolOutput = z.infer<typeof editorToolOutputSchema>

const usageSchema = z.object({ used: z.number(), limit: z.number(), resetsAt: z.string() })
export const quotaSchema = z.object({ messages: usageSchema, images: usageSchema })
export type AssistantQuota = z.infer<typeof quotaSchema>

/** What each suggestion card in the chat is about. */
export const EDIT_LABELS: Record<EditorTool, string> = {
  replaceSelection: "Viết lại đoạn đã chọn",
  replaceText: "Sửa một đoạn trong bài",
  insertMarkdown: "Thêm nội dung mới",
  setTitle: "Đổi tiêu đề",
  insertImage: "Chèn ảnh minh hoạ",
}

export const EDIT_ERRORS: Record<NonNullable<EditorToolOutput["error"]>, string> = {
  NO_SELECTION: "Chưa có đoạn nào được chọn",
  NOT_FOUND: "Không tìm thấy đoạn cần sửa",
  AMBIGUOUS: "Đoạn cần sửa xuất hiện nhiều lần",
  STALE: "Đoạn này đã thay đổi",
}

export const AGENT_WELCOME =
  "Chào bạn! Mình ngồi cạnh khi bạn viết: viết lại hay rút gọn đoạn bạn bôi đen, viết mở bài, gợi ý tiêu đề, dịch sang tiếng Anh, hay tạo ảnh minh hoạ. Mọi thay đổi đều hiện trong bài để bạn chấp nhận hoặc bỏ."

export const QUICK_PROMPTS = [
  "Viết lại đoạn đang chọn cho mượt hơn",
  "Viết đoạn mở bài",
  "Gợi ý tiêu đề",
  "Tạo ảnh minh hoạ cho bài",
] as const
