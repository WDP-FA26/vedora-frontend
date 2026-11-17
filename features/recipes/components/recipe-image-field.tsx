"use client"

import { useRef, useState } from "react"
import { ImageIcon, XIcon } from "lucide-react"
import type { FieldError as FieldErrorValue } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { requestRecipeImageUpload } from "@/features/recipes/lib/recipes-api"
import { MAX_RECIPE_IMAGE_MB, RECIPE_IMAGE_TYPES } from "@/features/recipes/schemas"
import { uploadToCloudinary } from "@/features/posts/lib/cloudinary-upload"

const IMAGE_INPUT_ID = "recipe-image"

/** Lets an admin pick a dish photo, sends it to Cloudinary and reports its public URL. */
export function RecipeImageField({
  value,
  onChange,
  error,
}: {
  value: string
  onChange: (url: string) => void
  error: FieldErrorValue | undefined
}) {
  const { accessToken } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [percent, setPercent] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)

  async function upload(file: File) {
    if (!accessToken) return
    if (!(RECIPE_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      setUploadError("Chỉ nhận ảnh JPG, PNG hoặc WebP.")
      return
    }
    if (file.size > MAX_RECIPE_IMAGE_MB * 1024 * 1024) {
      setUploadError(`Ảnh tối đa ${MAX_RECIPE_IMAGE_MB} MB.`)
      return
    }

    setUploadError(null)
    setPercent(0)
    setUploading(true)
    try {
      const { upload, url } = await requestRecipeImageUpload(accessToken)
      await uploadToCloudinary(upload, file, setPercent).done
      onChange(url)
    } catch {
      setUploadError("Không tải được ảnh lên. Thử lại nhé.")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={IMAGE_INPUT_ID}>Ảnh món (không bắt buộc)</FieldLabel>
      {value ? (
        // Cloudinary serves the file as is, so the Next image optimizer is not used.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt="Ảnh món"
          className="aspect-[16/9] w-full max-w-sm rounded-2xl object-cover"
        />
      ) : null}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          id={IMAGE_INPUT_ID}
          type="file"
          accept={RECIPE_IMAGE_TYPES.join(",")}
          className="sr-only"
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void upload(file)
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Spinner data-icon="inline-start" /> : <ImageIcon data-icon="inline-start" />}
          {uploading ? `Đang tải ${Math.round(percent)}%` : value ? "Đổi ảnh" : "Chọn ảnh"}
        </Button>
        {value && !uploading ? (
          <Button type="button" variant="ghost" onClick={() => onChange("")}>
            <XIcon data-icon="inline-start" />
            Bỏ ảnh
          </Button>
        ) : null}
      </div>
      <FieldDescription>
        Ảnh JPG, PNG hoặc WebP, tối đa {MAX_RECIPE_IMAGE_MB} MB, được lưu trên Cloudinary.
      </FieldDescription>
      {uploadError ? <FieldError>{uploadError}</FieldError> : null}
      {error ? <FieldError errors={[error]} /> : null}
    </Field>
  )
}
