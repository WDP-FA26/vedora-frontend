"use client"

import { useState } from "react"
import { Controller, useForm, type UseFormReturn } from "react-hook-form"
import { useDropzone, type Accept } from "react-dropzone"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeftIcon, CameraIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Cropper, CropperCropArea, CropperDescription, CropperImage } from "@/components/ui/cropper"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { FieldError } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { Slider } from "@/components/ui/slider"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { ProfileAvatar } from "@/features/profiles/components/profile-avatar"
import { ProfileCover } from "@/features/profiles/components/profile-cover"
import { useSetMyProfile } from "@/features/profiles/hooks/use-profile"
import { useProfileImage } from "@/features/profiles/hooks/use-profile-image"
import { cropImage, type CropArea } from "@/features/profiles/lib/crop-image"
import { updateMyProfile } from "@/features/profiles/lib/profiles-api"
import {
  IMAGE_CONTENT_TYPES,
  MAX_BIO_LENGTH,
  MAX_FULL_NAME_LENGTH,
  profileFormSchema,
  type ApiProfile,
  type ImageKind,
  type ProfileFormValues,
} from "@/features/profiles/schemas"

const FORM_ID = "edit-profile-form"
const IMAGE_ACCEPT: Accept = Object.fromEntries(IMAGE_CONTENT_TYPES.map((type) => [type, []]))

const IMAGES: Record<
  ImageKind,
  { aspectRatio: number; maxWidth: number; shape: "circle" | "rect"; label: string }
> = {
  AVATAR: { aspectRatio: 1, maxWidth: 400, shape: "circle", label: "ảnh đại diện" },
  COVER: { aspectRatio: 3, maxWidth: 1500, shape: "rect", label: "ảnh bìa" },
}

type Cropping = { kind: ImageKind; file: File; src: string }

export function EditProfileDialog({
  profile,
  trigger,
}: {
  profile: ApiProfile
  trigger: React.ReactElement
}) {
  const [open, setOpen] = useState(false)
  const [cropping, setCropping] = useState<Cropping | null>(null)
  const images = useProfileImage()
  // Lives here so edits survive a trip through the crop step.
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    // Follows the profile, so reopening shows what was last saved.
    values: { fullName: profile.fullName, bio: profile.bio ?? "" },
  })

  // Created on pick and revoked on close, not in an effect, so Strict Mode can't revoke it early.
  function startCrop(kind: ImageKind, file: File) {
    setCropping({ kind, file, src: URL.createObjectURL(file) })
  }

  function closeCrop() {
    if (cropping) URL.revokeObjectURL(cropping.src)
    setCropping(null)
  }

  function renderStep() {
    if (cropping) {
      return (
        <ImageCropStep
          {...cropping}
          onCancel={closeCrop}
          onApply={(file) => {
            closeCrop()
            void images.upload(cropping.kind, file)
          }}
        />
      )
    }
    return (
      <ProfileEditForm
        profile={profile}
        form={form}
        images={images}
        onPick={startCrop}
        onSaved={() => setOpen(false)}
      />
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          form.reset()
          closeCrop()
        }
        setOpen(next)
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent
        showCloseButton={false}
        flush
        className="flex max-h-[min(90dvh,42rem)] flex-col overflow-hidden sm:max-w-[36rem]"
      >
        {renderStep()}
      </DialogContent>
    </Dialog>
  )
}

function ProfileEditForm({
  profile,
  form,
  images,
  onPick,
  onSaved,
}: {
  profile: ApiProfile
  form: UseFormReturn<ProfileFormValues>
  images: ReturnType<typeof useProfileImage>
  onPick: (kind: ImageKind, file: File) => void
  onSaved: () => void
}) {
  const { accessToken } = useAuth()
  const setMyProfile = useSetMyProfile()
  const { isSubmitting, errors } = form.formState

  async function onSubmit(values: ProfileFormValues) {
    if (!accessToken) return
    try {
      await setMyProfile(await updateMyProfile(accessToken, values))
      onSaved()
    } catch {
      form.setError("root", { message: "Không lưu được hồ sơ. Thử lại nhé." })
    }
  }

  return (
    <>
      <header className="flex h-[3.3125rem] items-center gap-4 px-3">
        <DialogClose render={<Button variant="ghost" size="icon" shape="pill" aria-label="Đóng" />}>
          <XIcon />
        </DialogClose>
        <DialogTitle size="lg" className="flex-1">
          Chỉnh sửa hồ sơ
        </DialogTitle>
        <Button type="submit" form={FORM_ID} shape="pill" size="pill" disabled={isSubmitting}>
          {isSubmitting && <Spinner aria-hidden />}
          Lưu
        </Button>
      </header>

      <div className="no-scrollbar overflow-y-auto">
        <ProfileImages
          profile={profile}
          pending={images.pending}
          onPick={onPick}
          onRemove={(kind) => void images.remove(kind)}
        />
        {images.error && (
          <p role="alert" className="px-4 pt-2 text-sm text-destructive">
            {images.error}
          </p>
        )}

        <form
          id={FORM_ID}
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-6 p-4"
        >
          <Controller
            name="fullName"
            control={form.control}
            render={({ field, fieldState }) => (
              <OutlinedField
                id={field.name}
                label="Tên hiển thị"
                count={`${field.value.length}/${MAX_FULL_NAME_LENGTH}`}
                error={fieldState.error}
              >
                <InputGroupInput
                  {...field}
                  id={field.name}
                  aria-invalid={fieldState.invalid}
                  autoComplete="name"
                />
              </OutlinedField>
            )}
          />
          <Controller
            name="bio"
            control={form.control}
            render={({ field, fieldState }) => (
              <OutlinedField
                id={field.name}
                label="Giới thiệu"
                count={`${field.value.length}/${MAX_BIO_LENGTH}`}
                error={fieldState.error}
              >
                <InputGroupTextarea
                  {...field}
                  id={field.name}
                  aria-invalid={fieldState.invalid}
                  rows={3}
                  placeholder="Bạn nấu gì, ăn chay từ bao giờ…"
                />
              </OutlinedField>
            )}
          />
          {errors.root && <FieldError errors={[errors.root]} />}
        </form>
      </div>
    </>
  )
}

function OutlinedField({
  id,
  label,
  count,
  error,
  children,
}: {
  id: string
  label: string
  count: string
  error?: { message?: string }
  children: React.ReactNode
}) {
  return (
    <div>
      <InputGroup>
        <InputGroupAddon align="block-start" className="justify-between">
          <label htmlFor={id}>{label}</label>
          <span aria-live="polite">{count}</span>
        </InputGroupAddon>
        {children}
      </InputGroup>
      {error && <FieldError className="mt-1" errors={[error]} />}
    </div>
  )
}

function ProfileImages({
  profile,
  pending,
  onPick,
  onRemove,
}: {
  profile: ApiProfile
  pending: ImageKind | null
  onPick: (kind: ImageKind, file: File) => void
  onRemove: (kind: ImageKind) => void
}) {
  return (
    <div>
      <ProfileCover profile={profile}>
        <ImagePicker kind="COVER" pending={pending} onPick={onPick}>
          {profile.coverUrl && (
            <Button
              type="button"
              variant="overlay"
              shape="pill"
              size="icon-xl"
              aria-label={`Gỡ ${IMAGES.COVER.label}`}
              disabled={pending !== null}
              onClick={() => onRemove("COVER")}
            >
              <XIcon />
            </Button>
          )}
        </ImagePicker>
      </ProfileCover>

      <div className="-mt-12 ml-4 flex items-end gap-2">
        <div className="relative size-28 rounded-full border-4 border-popover bg-popover">
          <ProfileAvatar profile={profile} size="fill" />
          <ImagePicker kind="AVATAR" pending={pending} onPick={onPick} />
        </div>
        {profile.avatarUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            shape="pill"
            disabled={pending !== null}
            onClick={() => onRemove("AVATAR")}
          >
            Gỡ {IMAGES.AVATAR.label}
          </Button>
        )}
      </div>
    </div>
  )
}

function ImagePicker({
  kind,
  pending,
  onPick,
  children,
}: {
  kind: ImageKind
  pending: ImageKind | null
  onPick: (kind: ImageKind, file: File) => void
  children?: React.ReactNode
}) {
  const { getRootProps, getInputProps, open } = useDropzone({
    accept: IMAGE_ACCEPT,
    multiple: false,
    noClick: true,
    noKeyboard: true,
    disabled: pending !== null,
    onDropAccepted: ([file]) => onPick(kind, file),
  })

  return (
    <div
      {...getRootProps()}
      className="absolute inset-0 flex items-center justify-center gap-4 rounded-[inherit] bg-black/20"
    >
      <input {...getInputProps({ className: "absolute" })} />
      <Button
        type="button"
        variant="overlay"
        shape="pill"
        size="icon-xl"
        aria-label={`Đổi ${IMAGES[kind].label}`}
        disabled={pending !== null}
        onClick={open}
      >
        {pending === kind ? <Spinner aria-hidden /> : <CameraIcon />}
      </Button>
      {children}
    </div>
  )
}

function ImageCropStep({
  kind,
  file,
  src,
  onCancel,
  onApply,
}: Cropping & {
  onCancel: () => void
  onApply: (file: File) => void
}) {
  const { aspectRatio, maxWidth, shape, label } = IMAGES[kind]
  const [area, setArea] = useState<CropArea | null>(null)
  const [zoom, setZoom] = useState(1)
  const [applying, setApplying] = useState(false)

  async function apply() {
    if (!area) return
    setApplying(true)
    try {
      onApply(await cropImage(file, area, maxWidth))
    } catch {
      setApplying(false)
    }
  }

  return (
    <>
      <header className="flex h-[3.3125rem] items-center gap-4 px-3">
        <Button variant="ghost" size="icon" shape="pill" aria-label="Quay lại" onClick={onCancel}>
          <ArrowLeftIcon />
        </Button>
        <DialogTitle size="lg" className="flex-1">
          Chỉnh sửa {label}
        </DialogTitle>
        <Button shape="pill" size="pill" disabled={!area || applying} onClick={() => void apply()}>
          {applying && <Spinner aria-hidden />}
          Áp dụng
        </Button>
      </header>
      <Cropper
        image={src}
        aspectRatio={aspectRatio}
        zoom={zoom}
        onZoomChange={setZoom}
        onCropChange={setArea}
        className="h-80"
      >
        <CropperDescription>
          Kéo để di chuyển ảnh, cuộn hoặc dùng thanh trượt để phóng to.
        </CropperDescription>
        <CropperImage />
        <CropperCropArea shape={shape} />
      </Cropper>
      <div className="flex items-center gap-3 px-6 py-4">
        <span className="text-xs text-muted-foreground">Thu nhỏ</span>
        <Slider
          aria-label="Phóng to"
          min={1}
          max={3}
          step={0.1}
          value={[zoom]}
          onValueChange={(value) => setZoom(Array.isArray(value) ? value[0] : value)}
        />
        <span className="text-xs text-muted-foreground">Phóng to</span>
      </div>
    </>
  )
}
