"use client"

import Link from "next/link"
import { useRef } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile"
import { useSWRConfig } from "swr"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { login } from "@/features/auth/actions"
import { GoogleButton } from "@/features/auth/components/google-button"
import { loginSchema, type LoginValues } from "@/features/auth/schemas"
import { LOGIN_TURNSTILE_SITE_KEY } from "@/features/auth/lib/turnstile"

export function LoginForm({ next }: { next?: string }) {
  const { mutate } = useSWRConfig()
  const turnstile = useRef<TurnstileInstance>(null)
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "", turnstileToken: "" },
  })
  const { isSubmitting, errors } = form.formState
  const turnstileToken = useWatch({ control: form.control, name: "turnstileToken" })

  function invalidateChallenge(message: string) {
    form.setValue("turnstileToken", "")
    form.setError("turnstileToken", { message })
  }

  async function onSubmit(values: LoginValues) {
    try {
      // Drop any user cached from a previous session before switching accounts.
      await mutate(() => true, undefined, { revalidate: false })
      // Resolves only on failure; on success the action redirects.
      const serverErrors = await login(values, next)
      for (const [name, message] of Object.entries(serverErrors)) {
        form.setError(name as keyof typeof serverErrors, { message })
      }
    } finally {
      form.resetField("password", { keepError: true })
      // Siteverify consumes tokens even when the credentials are incorrect.
      form.setValue("turnstileToken", "")
      turnstile.current?.reset()
    }
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
              <div className="flex items-center justify-between gap-2">
                <FieldLabel htmlFor={field.name}>Mật khẩu</FieldLabel>
                <Link
                  href="/forgot-password"
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Quên mật khẩu?
                </Link>
              </div>
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

        <Field data-invalid={!!errors.turnstileToken}>
          <FieldLabel>Xác minh bảo mật</FieldLabel>
          {LOGIN_TURNSTILE_SITE_KEY ? (
            <Turnstile
              ref={turnstile}
              siteKey={LOGIN_TURNSTILE_SITE_KEY}
              options={{ size: "flexible", language: "vi" }}
              scriptOptions={{ onError: () => invalidateChallenge("Không tải được xác minh bảo mật. Vui lòng tải lại trang.") }}
              onSuccess={(token) => {
                form.setValue("turnstileToken", token, { shouldValidate: true })
                form.clearErrors("turnstileToken")
              }}
              onExpire={() => invalidateChallenge("Xác minh đã hết hạn. Vui lòng xác minh lại.")}
              onError={() => invalidateChallenge("Không tải được xác minh bảo mật. Vui lòng thử lại.")}
              onTimeout={() => invalidateChallenge("Xác minh quá thời gian. Vui lòng thử lại.")}
              onUnsupported={() => invalidateChallenge("Trình duyệt không hỗ trợ xác minh. Vui lòng dùng trình duyệt khác.")}
            />
          ) : (
            <p role="alert" className="text-sm text-destructive">
              Đăng nhập tạm thời chưa khả dụng. Vui lòng thử lại sau.
            </p>
          )}
          {errors.turnstileToken && <FieldError errors={[errors.turnstileToken]} />}
          {errors.turnstileToken && LOGIN_TURNSTILE_SITE_KEY && (
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => turnstile.current?.reset()}>
              Xác minh lại
            </Button>
          )}
        </Field>

        {errors.root && <FieldError errors={[errors.root]} />}

        <Button type="submit" size="pill" shape="pill" className="h-11 w-full" disabled={isSubmitting || !turnstileToken}>
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
