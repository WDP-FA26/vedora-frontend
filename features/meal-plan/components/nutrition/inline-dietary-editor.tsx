"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { useAuth } from "@/features/auth/hooks/use-auth"
import {
  DIETARY_PATH,
  MAX_MEMORY_ITEM_LENGTH,
  MAX_MEMORY_ITEMS,
  memoryLines,
  saveMyDietary,
  type DietaryMemory,
} from "@/features/dietary/dietary"
import { ApiError } from "@/features/shared/lib/api-client"

export function InlineDietaryEditor({
  dietary,
  onSaved,
}: {
  dietary?: DietaryMemory
  onSaved?: (next: DietaryMemory) => Promise<void> | void
}) {
  const { accessToken } = useAuth()
  const [allergiesText, setAllergiesText] = useState(dietary?.allergies.join("\n") ?? "")
  const [preferencesText, setPreferencesText] = useState(dietary?.preferences.join("\n") ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!dietary) {
    return <p className="text-sm text-muted-foreground">Đang tải hồ sơ ăn uống…</p>
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!accessToken || saving) return
    const allergies = memoryLines(allergiesText)
    const preferences = memoryLines(preferencesText)
    if (
      allergies.length > MAX_MEMORY_ITEMS ||
      allergies.some((line) => line.length > MAX_MEMORY_ITEM_LENGTH)
    ) {
      setError(`Dị ứng tối đa ${MAX_MEMORY_ITEMS} dòng, mỗi dòng tối đa ${MAX_MEMORY_ITEM_LENGTH} ký tự.`)
      return
    }
    if (
      preferences.length > MAX_MEMORY_ITEMS ||
      preferences.some((line) => line.length > MAX_MEMORY_ITEM_LENGTH)
    ) {
      setError(`Sở thích tối đa ${MAX_MEMORY_ITEMS} dòng, mỗi dòng tối đa ${MAX_MEMORY_ITEM_LENGTH} ký tự.`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const saved = await saveMyDietary(accessToken, { allergies, preferences })
      await onSaved?.(saved)
      toast.add({ title: "Đã lưu hồ sơ ăn uống" })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Chưa lưu được hồ sơ ăn uống.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <div>
        <h3 className="text-sm font-bold">Dị ứng &amp; Sở thích ăn uống</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Chỉnh trực tiếp tại đây mà không rời trang Lên thực đơn. Mỗi dòng một ý.
        </p>
      </div>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="inline-allergies">Dị ứng &amp; không ăn</FieldLabel>
          <Textarea
            id="inline-allergies"
            rows={4}
            value={allergiesText}
            onChange={(event) => {
              setAllergiesText(event.target.value)
              setError(null)
            }}
            placeholder={"Ví dụ:\nDị ứng đậu phộng\nKhông ăn ngũ vị tân"}
          />
          <FieldDescription>Trợ lý tuyệt đối không xếp món có các thành phần này.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="inline-preferences">Sở thích &amp; thói quen</FieldLabel>
          <Textarea
            id="inline-preferences"
            rows={4}
            value={preferencesText}
            onChange={(event) => {
              setPreferencesText(event.target.value)
              setError(null)
            }}
            placeholder={"Ví dụ:\nKhông thích nấm\nNhà 3 người, chỉ nấu bữa tối\nMỗi món tối đa 30 phút"}
          />
        </Field>
      </FieldGroup>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving && <Spinner aria-hidden />}
          Lưu hồ sơ
        </Button>
        <Link
          href={DIETARY_PATH}
          className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
        >
          Mở trang hồ sơ đầy đủ
        </Link>
      </div>
    </form>
  )
}
