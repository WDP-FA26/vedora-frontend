import { z } from "zod"

export const MAX_MESSAGE_LENGTH = 2000
export const inboxSchema = z.enum(["friends", "requests"])
export type Inbox = z.infer<typeof inboxSchema>

export const messagingPeerSchema = z.object({
  id: z.string(),
  username: z.string(),
  fullName: z.string(),
  avatarUrl: z.string().nullable(),
  isProfessional: z.boolean(),
})
export const messageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  senderId: z.string(),
  recipientId: z.string(),
  clientMessageId: z.string(),
  sequence: z.number().int().positive(),
  body: z.string(),
  createdAt: z.string(),
})
export const messagePageSchema = z.object({
  items: z.array(messageSchema),
  nextCursor: z.string().nullable(),
})
export const contactSchema = z.object({
  peer: messagingPeerSchema,
  conversationId: z.string().nullable(),
  box: inboxSchema,
  followsPeer: z.boolean(),
  peerFollowsYou: z.boolean(),
  canSend: z.boolean(),
})
export const conversationSchema = z.object({
  id: z.string(),
  peer: messagingPeerSchema,
  box: inboxSchema,
  requestDirection: z.enum(["incoming", "outgoing"]).nullable(),
  followsPeer: z.boolean(),
  peerFollowsYou: z.boolean(),
  canSend: z.boolean(),
  lastMessage: z
    .object({
      id: z.string(),
      senderId: z.string(),
      body: z.string(),
      createdAt: z.string(),
    })
    .nullable(),
  unreadCount: z.number().int().nonnegative(),
  myReadSequence: z.number().int().nonnegative(),
  peerReadSequence: z.number().int().nonnegative(),
})
export const conversationPageSchema = z.object({
  items: z.array(conversationSchema),
  nextCursor: z.string().nullable(),
})
export const sendMessageResponseSchema = z.object({
  conversationId: z.string(),
  message: messageSchema,
})
export const readReceiptSchema = z.object({
  conversationId: z.string(),
  readSequence: z.number().int().nonnegative(),
  unreadCount: z.number().int().nonnegative(),
})
export const messagingEventSchema = z.object({
  conversationId: z.string().uuid().nullable(),
  messageId: z.string().uuid().nullable(),
  readerId: z.string().uuid().nullable(),
  readSequence: z.number().int().nonnegative().nullable(),
})

export type MessagingPeer = z.infer<typeof messagingPeerSchema>
export type DirectMessage = z.infer<typeof messageSchema>
export type MessagePage = z.infer<typeof messagePageSchema>
export type Conversation = z.infer<typeof conversationSchema>
export type ConversationPage = z.infer<typeof conversationPageSchema>
export type MessagingContact = z.infer<typeof contactSchema>
