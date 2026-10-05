"use client"

import { useRef, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { useSetMyProfile } from "@/features/profiles/hooks/use-profile"
import { useProfileImage } from "@/features/profiles/hooks/use-profile-image"
import { updateMyProfile } from "@/features/profiles/lib/profiles-api"
import {
  IMAGE_CONTENT_TYPES,
  MAX_BIO_LENGTH,
  profileFormSchema,
  type ApiProfile,
  type ImageKind,
  type ProfileFormValues,
} from "@/features/profiles/schemas"

const images: { kind: ImageKind; label: string; field: "avatarUrl" | "coverUrl" }[] = [
  { kind: "AVATAR", label: "Ảnh đại diện", field: "avatarUrl" },
  { kind: "COVER", label: "Ảnh bìa", field: "coverUrl" },
]

/** Wraps any trigger element so it opens the edit form for your own profile. */
export function EditProfileDialog({
  profile,
  trigger,
}: {
  profile: ApiProfile
  trigger: React.ReactElement
}) {
  const [open, setOpen] = useState(false)
  const { accessToken } = useAuth()
  const setMyProfile = useSetMyProfile()

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    // Follows the profile, so reopening shows what was last saved.
    values: { fullName: profile.fullName, bio: profile.bio ?? "" },
  })
  const { isSubmitting, errors } = form.formState
  const bio = useWatch({ control: form.control, name: "bio" })

  async function onSubmit(values: ProfileFormValues) {
    if (!accessToken) return
    try {
      await setMyProfile(await updateMyProfile(accessToken, values))
      setOpen(false)
    } catch {
      form.setError("root", { message: "Không lưu được hồ sơ. Thử lại nhé." })
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) form.reset()
        setOpen(next)
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-[32rem]">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa hồ sơ</DialogTitle>
          <DialogDescription>
            Tên, giới thiệu và ảnh của bạn hiển thị công khai trên Vedora.
          </DialogDescription>
        </DialogHeader>

        <ImageControls profile={profile} />

        <form noValidate onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Controller
              name="fullName"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Tên hiển thị</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    autoComplete="name"
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="bio"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Giới thiệu</FieldLabel>
                  <Textarea
                    {...field}
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    rows={3}
                    placeholder="Bạn nấu gì, ăn chay từ bao giờ…"
                  />
                  <FieldDescription>
                    {bio.length}/{MAX_BIO_LENGTH} ký tự
                  </FieldDescription>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            {errors.root && <FieldError errors={[errors.root]} />}
          </FieldGroup>

          <DialogFooter className="mt-5">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Spinner aria-hidden />}
              Lưu
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Change/remove buttons for the avatar and cover. They save at once, apart from the form. */
function ImageControls({ profile }: { profile: ApiProfile }) {
  const { pending, error, upload, remove } = useProfileImage()
  const fileInput = useRef<HTMLInputElement>(null)
  /** Which image the shared file input was opened for. */
  const picking = useRef<ImageKind>("AVATAR")

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={fileInput}
        type="file"
        accept={IMAGE_CONTENT_TYPES.join(",")}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          // Lets the same file be picked again after a failed upload.
          event.target.value = ""
          if (file) void upload(picking.current, file)
        }}
      />
      {images.map(({ kind, label, field }) => (
        <div key={kind} className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">{label}</span>
          <div className="flex items-center gap-2">
            {pending === kind && <Spinner aria-label={`Đang cập nhật ${label.toLowerCase()}`} />}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending !== null}
              onClick={() => {
                picking.current = kind
                fileInput.current?.click()
              }}
            >
              {profile[field] ? "Đổi ảnh" : "Thêm ảnh"}
            </Button>
            {profile[field] && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending !== null}
                onClick={() => void remove(kind)}
              >
                Gỡ
              </Button>
            )}
          </div>
        </div>
      ))}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
