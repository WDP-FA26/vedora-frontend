"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { REGEXP_ONLY_DIGITS } from "input-otp"
import { useSWRConfig } from "swr"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Spinner } from "@/components/ui/spinner"
import { resendVerificationCode, verifyEmail } from "@/features/auth/actions"
import { verifyEmailSchema, type VerifyEmailValues } from "@/features/auth/schemas"

// Mirror the API's limits, which are what actually enforce them.
const RESEND_COOLDOWN_SECONDS = 120
const MAX_RESENDS = 3

export function VerifyEmailForm({ next }: { next?: string }) {
  const { mutate } = useSWRConfig()
  const form = useForm<VerifyEmailValues>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { code: "" },
  })
  const { isSubmitting, errors } = form.formState

  async function onSubmit(values: VerifyEmailValues) {
    // Drop any user cached from a previous session before signing in.
    await mutate(() => true, undefined, { revalidate: false })
    // Resolves only on failure; on success the action redirects.
    const serverErrors = await verifyEmail(values, next)
    for (const [name, message] of Object.entries(serverErrors)) {
      form.setError(name as keyof typeof serverErrors, { message })
    }
    form.resetField("code", { keepError: true })
  }
  const submit = form.handleSubmit(onSubmit)

  return (
    <form onSubmit={submit} noValidate>
      <FieldGroup>
        <Controller
          name="code"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Mã xác minh</FieldLabel>
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
                // Pasting or typing the last digit submits right away.
                onComplete={() => submit()}
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

        {errors.root && <FieldError errors={[errors.root]} />}

        <Button type="submit" size="pill" shape="pill" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting && <Spinner aria-hidden />}
          Xác minh
        </Button>

        <ResendCode />

        <p className="text-center text-sm text-muted-foreground">
          Nhầm email?{" "}
          <Link
            href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"}
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Đăng ký lại
          </Link>
        </p>
      </FieldGroup>
    </form>
  )
}

/**
 * A code was sent just before this page opened, so the cooldown starts right
 * away. The count is per page visit; if earlier visits used up the resends,
 * the API answers 429 and the button goes away then.
 */
function ResendCode() {
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SECONDS)
  const [resendsLeft, setResendsLeft] = useState(MAX_RESENDS)
  const [status, setStatus] = useState<{ error: boolean; message: string } | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (secondsLeft <= 0) return
    const timer = setTimeout(() => setSecondsLeft((seconds) => seconds - 1), 1000)
    return () => clearTimeout(timer)
  }, [secondsLeft])

  function resend() {
    startTransition(async () => {
      const result = await resendVerificationCode()
      if (!result.ok) {
        if (result.limitReached) setResendsLeft(0)
        setStatus({ error: true, message: result.message })
        return
      }
      const left = resendsLeft - 1
      setResendsLeft(left)
      setSecondsLeft(RESEND_COOLDOWN_SECONDS)
      setStatus({
        error: false,
        message: left > 0
          ? "Đã gửi mã mới. Hãy kiểm tra hộp thư, kể cả mục spam."
          : "Đã gửi mã mới. Đây là lần gửi lại cuối cùng trong 1 giờ.",
      })
    })
  }

  return (
    <div className="flex flex-col items-center gap-1 text-center text-sm">
      {resendsLeft > 0 && (
        <div className="flex items-center gap-1 text-muted-foreground">
          Chưa nhận được mã?
          <Button
            type="button"
            variant="link"
            size="sm"
            disabled={secondsLeft > 0 || pending}
            onClick={resend}
          >
            {pending && <Spinner aria-hidden />}
            {secondsLeft > 0
              ? `Gửi lại sau ${formatCountdown(secondsLeft)}`
              : `Gửi lại mã (còn ${resendsLeft} lần)`}
          </Button>
        </div>
      )}
      <p role="status" className={status?.error ? "text-destructive" : "text-muted-foreground"}>
        {status?.message}
      </p>
    </div>
  )
}

/** 95 → "1:35" */
function formatCountdown(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}
