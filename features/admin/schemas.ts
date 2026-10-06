import { z } from "zod"

// Mirrors vedora-api's `GET /users` (admin only): `PublicUser` rows in a
// page-based `PaginatedResponseDto`.

const adminUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  fullName: z.string(),
  email: z.string(),
  role: z.enum(["USER", "ADMIN"]),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const adminUserPageSchema = z.object({
  items: z.array(adminUserSchema),
  meta: z.object({ hasNextPage: z.boolean() }),
})

export type AdminUser = z.infer<typeof adminUserSchema>
