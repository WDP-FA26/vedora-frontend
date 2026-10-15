"use client"

import Link from "next/link"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { requestPasswordReset } from "@/features/auth/actions"
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/features/auth/schemas"

export function ForgotPasswordForm() {
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  })
  const { isSubmitting, errors } = form.formState

  async function onSubmit(values: ForgotPasswordValues) {
    // Resolves only on failure; on success the action redirects.
    const serverErrors = await requestPasswordReset(values)
    for (const [name, message] of Object.entries(serverErrors)) {
      form.setError(name as keyof typeof serverErrors, { message })
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Email</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="email"
                inputMode="email"
                aria-invalid={fieldState.invalid}
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {errors.root && <FieldError errors={[errors.root]} />}

        <Button type="submit" size="pill" shape="pill" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting && <Spinner aria-hidden />}
          Gửi mã đặt lại
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Nhớ ra mật khẩu rồi?{" "}
          <Link
            href="/login"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Đăng nhập
          </Link>
        </p>
      </FieldGroup>
    </form>
  )
}
