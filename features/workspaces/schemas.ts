import { z } from "zod"

import { presignedUploadSchema } from "@/features/shared/lib/storage-upload"
import { newUsernameSchema } from "@/features/auth/schemas"
import {
  MAX_PROOF_MB,
  MAX_PROOFS,
  MAX_REVIEW_NOTE_LENGTH,
  MAX_STATEMENT_LENGTH,
  MIN_STATEMENT_LENGTH,
  VERIFICATION_STATUSES,
} from "@/features/verification/schemas"

// Mirrors vedora-api's `/workspaces` DTOs (docs-for-FE/workspaces.md).
// Proof limits are shared with the verified-chef badge.

export { MAX_PROOF_MB, MAX_PROOFS, MAX_REVIEW_NOTE_LENGTH, MAX_STATEMENT_LENGTH }

export const MAX_NAME_LENGTH = 100
export const MAX_BIO_LENGTH = 500
export const MAX_ADDRESS_LENGTH = 300
export const MAX_PHONE_LENGTH = 30
export const MAX_WEBSITE_LENGTH = 300

export const MEMBER_ROLES = ["OWNER", "MANAGER"] as const

export const MEMBER_ROLE_LABELS: Record<(typeof MEMBER_ROLES)[number], string> = {
  OWNER: "Chủ trang",
  MANAGER: "Quản lý",
}

export const WORKSPACE_STATUS_LABELS: Record<(typeof VERIFICATION_STATUSES)[number], string> = {
  PENDING: "Đang chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Bị từ chối",
}

const restaurantLocationSchema = z.object({
  address: z.string(),
  longitude: z.number(),
  latitude: z.number(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
})

export const workspaceSchema = restaurantLocationSchema.extend({
  id: z.string(),
  pageUserId: z.string().nullable(),
  username: z.string(),
  name: z.string(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  statement: z.string(),
  status: z.enum(VERIFICATION_STATUSES),
  reviewNote: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  createdAt: z.string(),
  proofCount: z.number(),
  role: z.enum(MEMBER_ROLES),
})

export const workspaceMemberSchema = z.object({
  userId: z.string(),
  username: z.string(),
  fullName: z.string(),
  avatarUrl: z.string().nullable(),
  role: z.enum(MEMBER_ROLES),
  createdAt: z.string(),
})

export const workspaceDetailSchema = workspaceSchema.extend({
  members: z.array(workspaceMemberSchema),
})

export const workspaceListSchema = z.array(workspaceSchema)

export const workspaceProofUploadSchema = z.object({
  id: z.string(),
  upload: presignedUploadSchema,
})

export const adminWorkspaceSchema = restaurantLocationSchema.extend({
  id: z.string(),
  pageUserId: z.string().nullable(),
  username: z.string(),
  name: z.string(),
  bio: z.string().nullable(),
  statement: z.string(),
  status: z.enum(VERIFICATION_STATUSES),
  reviewNote: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  createdAt: z.string(),
  proofCount: z.number(),
  owner: z
    .object({
      id: z.string(),
      username: z.string(),
      fullName: z.string(),
      email: z.string(),
      avatarUrl: z.string().nullable(),
    })
    .nullable(),
})

export const adminWorkspacePageSchema = z.object({
  items: z.array(adminWorkspaceSchema),
  meta: z.object({ hasNextPage: z.boolean() }),
})

export const adminWorkspaceDetailSchema = adminWorkspaceSchema.extend({
  proofs: z.array(z.object({ id: z.string(), url: z.string() })),
})

export const restaurantPinSchema = z.object({
  pageUserId: z.string(),
  username: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  address: z.string(),
  longitude: z.number(),
  latitude: z.number(),
})

export const restaurantPinListSchema = z.object({
  items: z.array(restaurantPinSchema),
  truncated: z.boolean(),
})

/** Blank optional text is sent as null. */
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => (value === "" ? null : value))

const locationFields = {
  address: z
    .string()
    .trim()
    .min(1, "Nhập địa chỉ nhà hàng")
    .max(MAX_ADDRESS_LENGTH, `Tối đa ${MAX_ADDRESS_LENGTH} ký tự`),
  location: z.object(
    { longitude: z.number().min(-180).max(180), latitude: z.number().min(-90).max(90) },
    { error: "Ghim vị trí nhà hàng trên bản đồ" }
  ),
  phone: optionalText(MAX_PHONE_LENGTH, `Tối đa ${MAX_PHONE_LENGTH} ký tự`).refine(
    (value) => value === null || /^[0-9+().\s-]+$/.test(value),
    "Số điện thoại chỉ gồm chữ số, dấu cách và + ( ) - ."
  ),
  website: optionalText(MAX_WEBSITE_LENGTH, `Tối đa ${MAX_WEBSITE_LENGTH} ký tự`).refine(
    (value) => value === null || /^https?:\/\/\S+$/.test(value),
    "Địa chỉ web cần bắt đầu bằng http:// hoặc https://"
  ),
}

export const restaurantDetailsFormSchema = z.object(locationFields)

export const workspaceFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nhập tên nhà hàng")
    .max(MAX_NAME_LENGTH, `Tối đa ${MAX_NAME_LENGTH} ký tự`),
  username: newUsernameSchema,
  bio: optionalText(MAX_BIO_LENGTH, `Tối đa ${MAX_BIO_LENGTH} ký tự`),
  ...locationFields,
  statement: z
    .string()
    .trim()
    .min(MIN_STATEMENT_LENGTH, `Viết ít nhất ${MIN_STATEMENT_LENGTH} ký tự`)
    .max(MAX_STATEMENT_LENGTH, `Tối đa ${MAX_STATEMENT_LENGTH} ký tự`),
  proofs: z
    .array(z.object({ file: z.instanceof(File), preview: z.string() }))
    .min(1, "Thêm ít nhất một ảnh minh chứng")
    .max(MAX_PROOFS, `Tối đa ${MAX_PROOFS} ảnh`),
})

export const addMemberFormSchema = z.object({
  username: z.string().trim().toLowerCase().min(1, "Nhập tên đăng nhập"),
})

export type Workspace = z.infer<typeof workspaceSchema>
export type WorkspaceDetail = z.infer<typeof workspaceDetailSchema>
export type WorkspaceMember = z.infer<typeof workspaceMemberSchema>
export type AdminWorkspace = z.infer<typeof adminWorkspaceSchema>
export type AdminWorkspaceDetail = z.infer<typeof adminWorkspaceDetailSchema>
export type RestaurantPin = z.infer<typeof restaurantPinSchema>
export type LngLat = { longitude: number; latitude: number }
export type WorkspaceFormInput = z.input<typeof workspaceFormSchema>
export type WorkspaceFormValues = z.output<typeof workspaceFormSchema>
export type RestaurantDetailsFormInput = z.input<typeof restaurantDetailsFormSchema>
export type RestaurantDetailsFormValues = z.output<typeof restaurantDetailsFormSchema>
