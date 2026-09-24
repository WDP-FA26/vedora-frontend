import { z } from "zod"

// Mirrors the vedora-api DTOs (LoginDto / RegisterDto). The forms validate
// with these in the browser and the Server Actions parse them again.

const username = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Tên đăng nhập cần ít nhất 3 ký tự")
  .max(30, "Tên đăng nhập tối đa 30 ký tự")

export const loginSchema = z.object({
  username,
  password: z.string().min(1, "Nhập mật khẩu"),
})

export const registerSchema = z
  .object({
    lastName: z.string().trim().min(1, "Nhập họ").max(50, "Họ tối đa 50 ký tự"),
    firstName: z.string().trim().min(1, "Nhập tên").max(50, "Tên tối đa 50 ký tự"),
    username: username.regex(
      /^[a-z0-9._-]+$/,
      "Chỉ dùng chữ thường, số, dấu chấm, gạch dưới hoặc gạch ngang"
    ),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email("Email không hợp lệ").max(320, "Email quá dài")),
    password: z.string().min(8, "Mật khẩu cần ít nhất 8 ký tự").max(72, "Mật khẩu tối đa 72 ký tự"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Mật khẩu nhập lại không khớp",
  })
  .refine((data) => toFullName(data).length <= 100, {
    path: ["firstName"],
    message: "Họ và tên tối đa 100 ký tự",
  })

/**
 * vedora-api stores a single `fullName`. Vietnamese order: family name first,
 * so "Nguyễn" + "Văn An" becomes "Nguyễn Văn An".
 */
export function toFullName({ lastName, firstName }: { lastName: string; firstName: string }) {
  return `${lastName.trim()} ${firstName.trim()}`
}

export const verifyEmailSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Nhập đủ 6 chữ số"),
})

export type LoginValues = z.infer<typeof loginSchema>
export type RegisterValues = z.infer<typeof registerSchema>
export type VerifyEmailValues = z.infer<typeof verifyEmailSchema>

/** Server Action errors, keyed by field, or `root` for the whole form. */
export type FormErrors<Values> = Partial<Record<keyof Values | "root", string>>
