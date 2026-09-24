"use client"

import Link from "next/link"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useSWRConfig } from "swr"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { register } from "@/features/auth/actions"
import { registerSchema, type RegisterValues } from "@/features/auth/schemas"

const fields: {
  name: keyof RegisterValues
  label: string
  description?: string
  input: React.ComponentProps<"input">
}[] = [
  { name: "fullName", label: "Họ và tên", input: { autoComplete: "name", autoFocus: true } },
  {
    name: "username",
    label: "Tên đăng nhập",
    description: "Chữ thường, số và . _ -, từ 3 đến 30 ký tự.",
    input: { autoComplete: "username", autoCapitalize: "none", spellCheck: false },
  },
  { name: "email", label: "Email", input: { type: "email", autoComplete: "email", spellCheck: false } },
  {
    name: "password",
    label: "Mật khẩu",
    description: "Ít nhất 8 ký tự.",
    input: { type: "password", autoComplete: "new-password" },
  },
  {
    name: "confirmPassword",
    label: "Nhập lại mật khẩu",
    input: { type: "password", autoComplete: "new-password" },
  },
]

export function RegisterForm({ next }: { next?: string }) {
  const { mutate } = useSWRConfig()
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  })
  const { isSubmitting, errors } = form.formState

  async function onSubmit(values: RegisterValues) {
    await mutate(() => true, undefined, { revalidate: false })
    // Resolves only on failure; on success the action redirects.
    const serverErrors = await register(values, next)
    for (const [name, message] of Object.entries(serverErrors)) {
      form.setError(name as keyof typeof serverErrors, { message }, { shouldFocus: true })
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {fields.map(({ name, label, description, input }) => (
          <Controller
            key={name}
            name={name}
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
                <Input
                  {...input}
                  {...field}
                  id={field.name}
                  aria-invalid={fieldState.invalid}
                />
                {description && <FieldDescription>{description}</FieldDescription>}
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        ))}

        {errors.root && <FieldError errors={[errors.root]} />}

        <Button type="submit" size="pill" shape="pill" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting && <Spinner aria-hidden />}
          Tạo tài khoản
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Đã có tài khoản?{" "}
          <Link
            href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Đăng nhập
          </Link>
        </p>
      </FieldGroup>
    </form>
  )
}
