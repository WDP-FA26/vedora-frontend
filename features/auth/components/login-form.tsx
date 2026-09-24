"use client"

import Link from "next/link"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useSWRConfig } from "swr"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { login } from "@/features/auth/actions"
import { GoogleButton } from "@/features/auth/components/google-button"
import { loginSchema, type LoginValues } from "@/features/auth/schemas"

export function LoginForm({ next }: { next?: string }) {
  const { mutate } = useSWRConfig()
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  })
  const { isSubmitting, errors } = form.formState

  async function onSubmit(values: LoginValues) {
    // Drop any user cached from a previous session before switching accounts.
    await mutate(() => true, undefined, { revalidate: false })
    // Resolves only on failure; on success the action redirects.
    const serverErrors = await login(values, next)
    for (const [name, message] of Object.entries(serverErrors)) {
      form.setError(name as keyof typeof serverErrors, { message })
    }
    form.resetField("password", { keepError: true })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <GoogleButton next={next} />
        <FieldSeparator>hoặc</FieldSeparator>

        <Controller
          name="username"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Tên đăng nhập</FieldLabel>
              <Input
                {...field}
                id={field.name}
                aria-invalid={fieldState.invalid}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Mật khẩu</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="password"
                aria-invalid={fieldState.invalid}
                autoComplete="current-password"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {errors.root && <FieldError errors={[errors.root]} />}

        <Button type="submit" size="pill" shape="pill" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting && <Spinner aria-hidden />}
          Đăng nhập
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Chưa có tài khoản?{" "}
          <Link
            href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"}
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Tạo tài khoản
          </Link>
        </p>
      </FieldGroup>
    </form>
  )
}
