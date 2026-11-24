"use client"

import { useRef, useState } from "react"
import { ImagePlusIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  MAX_ATTACHMENT_MB,
  MAX_ATTACHMENTS_PER_MESSAGE,
  SUPPORT_ATTACHMENT_TYPES,
} from "@/features/support/schemas"

function isAllowedType(type: string): boolean {
  return SUPPORT_ATTACHMENT_TYPES.some((allowed) => allowed === type)
}

/** A chosen image and its local object-URL preview. */
export type PickedImage = { file: File; preview: string }

/** Frees the previews once the images are sent or discarded. */
export function releasePickedImages(images: readonly PickedImage[]) {
  for (const image of images) URL.revokeObjectURL(image.preview)
}

/**
 * Compact image attach control for ticket forms: an "Đính kèm ảnh" button and
 * a row of removable thumbnails. Rejects files over the size or count limit.
 */
export function TicketImagePicker({
  images,
  onChange,
  disabled,
  maxImages = MAX_ATTACHMENTS_PER_MESSAGE,
  maxMb = MAX_ATTACHMENT_MB,
}: {
  images: PickedImage[]
  onChange: (images: PickedImage[]) => void
  disabled?: boolean
  maxImages?: number
  maxMb?: number
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const full = images.length >= maxImages

  function handlePick(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? [])
    event.target.value = ""
    setError(null)
    const accepted: File[] = []
    for (const file of picked) {
      if (!isAllowedType(file.type)) {
        setError("Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.")
        continue
      }
      if (file.size > maxMb * 1024 * 1024) {
        setError(`Mỗi ảnh tối đa ${maxMb} MB.`)
        continue
      }
      accepted.push(file)
    }
    const room = maxImages - images.length
    if (accepted.length > room) {
      setError(`Tối đa ${maxImages} ảnh mỗi lần gửi.`)
    }
    const added = accepted
      .slice(0, room)
      .map((file) => ({ file, preview: URL.createObjectURL(file) }))
    onChange([...images, ...added])
  }

  function remove(target: PickedImage) {
    setError(null)
    URL.revokeObjectURL(target.preview)
    onChange(images.filter((image) => image !== target))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={SUPPORT_ATTACHMENT_TYPES.join(",")}
          multiple
          hidden
          onChange={handlePick}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || full}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlusIcon aria-hidden />
          Đính kèm ảnh
        </Button>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {images.length}/{maxImages} ảnh · tối đa {maxMb} MB/ảnh
        </span>
      </div>
      {images.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {images.map((image) => (
            <li
              key={image.preview}
              className="relative size-16 overflow-hidden rounded-sm border border-border bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
              <img src={image.preview} alt={image.file.name} className="size-full object-cover" />
              <button
                type="button"
                aria-label={`Bỏ ảnh ${image.file.name}`}
                disabled={disabled}
                onClick={() => remove(image)}
                className="absolute top-0.5 right-0.5 flex size-5 items-center justify-center rounded-sm bg-black/60 text-white hover:bg-black/80"
              >
                <XIcon aria-hidden className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
