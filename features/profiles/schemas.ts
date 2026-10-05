import { z } from "zod"

// Mirrors vedora-api's `/profiles` responses and `UpdateProfileDto`.
// Responses are parsed with these, so the types below are checked at runtime.

/** Same limit as the register form's full name. */
export const MAX_FULL_NAME_LENGTH = 100
export const MAX_BIO_LENGTH = 500

/** What `POST /profiles/me/images/uploads` and `DELETE .../images/{kind}` take. */
export const IMAGE_KINDS = ["AVATAR", "COVER"] as const
export const IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"]
/** Mirrors the API's limits: 5 MiB for an avatar, 10 MiB for a cover. */
export const MAX_IMAGE_MB = { AVATAR: 5, COVER: 10 } as const

/** A profile as listed in followers/following. */
export const apiProfileSummarySchema = z.object({
  id: z.string(),
  username: z.string(),
  fullName: z.string(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  coverUrl: z.string().nullable(),
})

/** A full public profile with its counts. */
export const apiProfileSchema = apiProfileSummarySchema.extend({
  createdAt: z.string(),
  postCount: z.number(),
  followerCount: z.number(),
  followingCount: z.number(),
})

export const profilePageSchema = z.object({
  items: z.array(apiProfileSummarySchema),
  nextCursor: z.string().nullable(),
})

export const relationshipSchema = z.object({
  isFollowing: z.boolean(),
})

/** A Vercel Blob client token scoped to one avatar or cover upload. */
export const imageUploadSchema = z.object({
  id: z.string(),
  pathname: z.string(),
  clientToken: z.string(),
})

export const profileFormSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Nhập tên hiển thị")
    .max(MAX_FULL_NAME_LENGTH, `Tối đa ${MAX_FULL_NAME_LENGTH} ký tự`),
  bio: z.string().trim().max(MAX_BIO_LENGTH, `Tối đa ${MAX_BIO_LENGTH} ký tự`),
})

export type ImageKind = (typeof IMAGE_KINDS)[number]
export type ApiProfileSummary = z.infer<typeof apiProfileSummarySchema>
export type ApiProfile = z.infer<typeof apiProfileSchema>
export type ProfilePage = z.infer<typeof profilePageSchema>
export type Relationship = z.infer<typeof relationshipSchema>
export type ImageUploadTarget = z.infer<typeof imageUploadSchema>
export type ProfileFormValues = z.infer<typeof profileFormSchema>
