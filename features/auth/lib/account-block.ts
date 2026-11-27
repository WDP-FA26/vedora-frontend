import { apiErrorSchema } from "@/features/shared/lib/api-client"

export type AccountBlock = "suspended" | "inactive"

const BLOCK_CODES: Record<string, AccountBlock> = {
  ACCOUNT_SUSPENDED: "suspended",
  ACCOUNT_NOT_ACTIVE: "inactive",
}

export const ACCOUNT_BLOCK_MESSAGES: Record<AccountBlock, string> = {
  suspended:
    "Tài khoản của bạn đang bị đình chỉ nên không thể đăng nhập. Liên hệ quản trị viên Vedora nếu bạn cho rằng đây là nhầm lẫn.",
  inactive: "Tài khoản của bạn chưa được kích hoạt hoặc không còn hoạt động.",
}

export const ACCOUNT_BLOCK_PARAM = "account"

export function parseAccountBlock(value: unknown): AccountBlock | undefined {
  return value === "suspended" || value === "inactive" ? value : undefined
}

export async function accountBlockOf(response: Response): Promise<AccountBlock | null> {
  if (response.status !== 401) return null
  const body = apiErrorSchema.safeParse(await response.clone().json().catch(() => null))
  return (body.success && body.data.code && BLOCK_CODES[body.data.code]) || null
}
