import { z } from "zod"

export const MAX_CHAT_MESSAGE_LENGTH = 500

export const chatMessageSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Nhập câu hỏi")
    .max(MAX_CHAT_MESSAGE_LENGTH, `Câu hỏi tối đa ${MAX_CHAT_MESSAGE_LENGTH} ký tự`),
})

export type ChatMessageValues = z.infer<typeof chatMessageSchema>
