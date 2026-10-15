"use client"

import Link from "next/link"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { REGEXP_ONLY_DIGITS } from "input-otp"
import { useSWRConfig } from "swr"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Spinner } from "@/components/ui/spinner"
import { resendPasswordResetCode, resetPassword } from "@/features/auth/actions"
import { ResendCode } from "@/features/auth/components/verify-email-form"
import { resetPasswordSchema, type ResetPasswordValues } from "@/features/auth/schemas"

const PASSWORD_FIELDS = [
  { name: "password", label: "Mật khẩu mới" },
  { name: "confirmPassword", label: "Nhập lại mật khẩu mới" },
] as const

export function ResetPasswordForm() {
  const { mutate } = useSWRConfig()
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { code: "", password: "", confirmPassword: "" },
  })
  const { isSubmitting, errors } = form.formState

  async function onSubmit(values: ResetPasswordValues) {
    // Every session ends with the reset; drop anything cached from one.
    await mutate(() => true, undefined, { revalidate: false })
    // Resolves only on failure; on success the action redirects.
    const serverErrors = await resetPassword(values)
    for (const [name, message] of Object.entries(serverErrors)) {
      form.setError(name as keyof typeof serverErrors, { message })
    }
    if (serverErrors.code) form.resetField("code", { keepError: true })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Controller
          name="code"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Mã đặt lại</FieldLabel>
              <InputOTP
                {...field}
                id={field.name}
                maxLength={6}
                pattern={REGEXP_ONLY_DIGITS}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                disabled={isSubmitting}
                aria-invalid={fieldState.invalid}
                // The new password comes next, so move on instead of submitting.
                onComplete={() => form.setFocus("password")}
              >
                <InputOTPGroup className="w-full">
                  {Array.from({ length: 6 }, (_, index) => (
                    <InputOTPSlot
                      key={index}
                      index={index}
                      aria-invalid={fieldState.invalid}
                      className="h-12 flex-1"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {PASSWORD_FIELDS.map(({ name, label }) => (
          <Controller
            key={name}
            name={name}
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  type="password"
                  aria-invalid={fieldState.invalid}
                  autoComplete="new-password"
                  disabled={isSubmitting}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        ))}

        {errors.root && <FieldError errors={[errors.root]} />}

        <Button type="submit" size="pill" shape="pill" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting && <Spinner aria-hidden />}
          Đặt lại mật khẩu
        </Button>

        <ResendCode resend={resendPasswordResetCode} />

        <p className="text-center text-sm text-muted-foreground">
          Nhầm email?{" "}
          <Link
            href="/forgot-password"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Nhập lại email
          </Link>
        </p>
      </FieldGroup>
    </form>
  )
}
