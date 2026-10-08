"use client"

import { useRef, useState } from "react"
import { Controller, useForm, type UseFormReturn } from "react-hook-form"
import { useDropzone, type Accept } from "react-dropzone"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeftIcon, CameraIcon, RotateCcwIcon, XIcon } from "lucide-react"

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
import { useProfile, useSetMyProfile } from "@/features/profiles/hooks/use-profile"
import { useProfileImage } from "@/features/profiles/hooks/use-profile-image"
import { cropImage, type CropArea } from "@/features/profiles/lib/crop-image"
import { updateMyProfile, updateMyUsername } from "@/features/profiles/lib/profiles-api"
import { ApiError } from "@/features/shared/lib/api-client"
import {
  IMAGE_CONTENT_TYPES,
  MAX_BIO_LENGTH,
  MAX_FULL_NAME_LENGTH,
  MAX_IMAGE_MB,
  MAX_USERNAME_LENGTH,
  profileFormSchema,
  type ApiProfileSummary,
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
type StagedImage = { action: "upload"; file: File; previewUrl: string } | { action: "remove" }
type StagedImages = Record<ImageKind, StagedImage | null>

const EMPTY_STAGED_IMAGES: StagedImages = { AVATAR: null, COVER: null }

function imageUrl(profile: ApiProfileSummary, staged: StagedImages, kind: ImageKind) {
  const change = staged[kind]
  if (change?.action === "upload") return change.previewUrl
  if (change?.action === "remove") return null
  return kind === "AVATAR" ? profile.avatarUrl : profile.coverUrl
}

function readImagePreview(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") resolve(reader.result)
      else reject(new Error("Không thể xem trước ảnh."))
    })
    reader.addEventListener("error", () => reject(new Error("Không thể đọc ảnh này.")))
    reader.readAsDataURL(file)
  })
}

export function EditProfileDialog({
  profile,
  trigger,
}: {
  profile: ApiProfileSummary
  trigger: React.ReactElement
}) {
  const [open, setOpen] = useState(false)
  const [cropping, setCropping] = useState<Cropping | null>(null)
  const [stagedImages, setStagedImages] = useState<StagedImages>(EMPTY_STAGED_IMAGES)
  const [previewImageError, setPreviewImageError] = useState<string | null>(null)
  const savedUsernameRef = useRef(profile.username)
  const pendingProfileSyncRef = useRef(false)
  const hasAppliedChangesRef = useRef(false)
  const images = useProfileImage()
  // Lives here so edits survive a trip through the crop step.
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { username: profile.username, fullName: profile.fullName, bio: profile.bio ?? "" },
  })

  const hasUnsavedChanges = form.formState.isDirty ||
    stagedImages.AVATAR !== null || stagedImages.COVER !== null

  // Created on pick and revoked on close, not in an effect, so Strict Mode can't revoke it early.
  function startCrop(kind: ImageKind, file: File) {
    images.clearError()
    if (!IMAGE_CONTENT_TYPES.includes(file.type)) {
      setPreviewImageError("Ảnh phải là JPEG, PNG hoặc WebP.")
      return
    }
    if (file.size > MAX_IMAGE_MB[kind] * 1024 * 1024) {
      setPreviewImageError(`Ảnh lớn hơn ${MAX_IMAGE_MB[kind]} MB. Chọn ảnh nhỏ hơn nhé.`)
      return
    }
    setPreviewImageError(null)
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
          onApply={async (file) => {
            try {
              const previewUrl = await readImagePreview(file)
              setStagedImages((current) => ({
                ...current,
                [cropping.kind]: { action: "upload", file, previewUrl },
              }))
              setPreviewImageError(null)
            } catch {
              setPreviewImageError("Không thể xem trước ảnh này. Hãy thử ảnh khác.")
            }
            closeCrop()
          }}
        />
      )
    }
    return (
      <ProfileEditForm
        profile={profile}
        form={form}
        images={images}
        stagedImages={stagedImages}
        previewImageError={previewImageError}
        onPreviewImageError={setPreviewImageError}
        onStagedImagesChange={setStagedImages}
        savedUsernameRef={savedUsernameRef}
        pendingProfileSyncRef={pendingProfileSyncRef}
        hasAppliedChangesRef={hasAppliedChangesRef}
        onPick={startCrop}
        onSaved={() => {
          setStagedImages(EMPTY_STAGED_IMAGES)
          setPreviewImageError(null)
          images.clearError()
          hasAppliedChangesRef.current = false
          setOpen(false)
        }}
      />
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (form.formState.isSubmitting || images.pending) return
        if (!next) {
          if (hasUnsavedChanges && !window.confirm("Bạn có thay đổi chưa lưu. Huỷ các thay đổi này?")) {
            return
          }
          form.reset()
          closeCrop()
          setStagedImages(EMPTY_STAGED_IMAGES)
          setPreviewImageError(null)
          images.clearError()
          hasAppliedChangesRef.current = pendingProfileSyncRef.current
        } else {
          form.reset({
            username: pendingProfileSyncRef.current ? savedUsernameRef.current : profile.username,
            fullName: profile.fullName,
            bio: profile.bio ?? "",
          })
          if (!pendingProfileSyncRef.current) savedUsernameRef.current = profile.username
          setStagedImages(EMPTY_STAGED_IMAGES)
          setPreviewImageError(null)
          images.clearError()
          hasAppliedChangesRef.current = pendingProfileSyncRef.current
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
  stagedImages,
  previewImageError,
  onPreviewImageError,
  onStagedImagesChange,
  savedUsernameRef,
  pendingProfileSyncRef,
  hasAppliedChangesRef,
  onPick,
  onSaved,
}: {
  profile: ApiProfileSummary
  form: UseFormReturn<ProfileFormValues>
  images: ReturnType<typeof useProfileImage>
  stagedImages: StagedImages
  previewImageError: string | null
  onPreviewImageError: React.Dispatch<React.SetStateAction<string | null>>
  onStagedImagesChange: React.Dispatch<React.SetStateAction<StagedImages>>
  savedUsernameRef: React.RefObject<string>
  pendingProfileSyncRef: React.RefObject<boolean>
  hasAppliedChangesRef: React.RefObject<boolean>
  onPick: (kind: ImageKind, file: File) => void
  onSaved: () => void
}) {
  const { accessToken, mutate: refreshAuth } = useAuth()
  const { retry: refreshProfile } = useProfile(profile.id)
  const setMyProfile = useSetMyProfile()
  const { isSubmitting, errors } = form.formState

  async function onSubmit(values: ProfileFormValues) {
    form.clearErrors("root")
    if (!accessToken) {
      form.setError("root", { message: "Phiên đăng nhập đã hết hạn. Đăng nhập lại để lưu hồ sơ." })
      return
    }

    const { username, ...profileValues } = values
    const textChanged =
      profileValues.fullName !== profile.fullName || profileValues.bio !== (profile.bio ?? "")
    let savedSomething = false
    let stage: "username" | "details" | "image" = "username"
    try {
      if (username !== savedUsernameRef.current) {
        await updateMyUsername(accessToken, profile.id, username)
        savedUsernameRef.current = username
        pendingProfileSyncRef.current = true
        savedSomething = true
        hasAppliedChangesRef.current = true
      }
      stage = "details"
      // The profile PATCH also returns the current username after its account update.
      if (textChanged || pendingProfileSyncRef.current) {
        const updatedProfile = await updateMyProfile(accessToken, profileValues)
        savedSomething = true
        hasAppliedChangesRef.current = true
        await setMyProfile(updatedProfile)
        pendingProfileSyncRef.current = false
        form.reset(values)
      }
      stage = "image"
      for (const kind of ["AVATAR", "COVER"] as const) {
        const change = stagedImages[kind]
        if (!change) continue
        if (change.action === "upload") {
          await images.upload(kind, change.file)
        } else {
          await images.remove(kind)
        }
        savedSomething = true
        hasAppliedChangesRef.current = true
        onStagedImagesChange((current) => ({ ...current, [kind]: null }))
      }
      onSaved()
    } catch (error) {
      if (pendingProfileSyncRef.current) {
        await Promise.allSettled([refreshAuth(), refreshProfile()])
      }
      if (stage === "username" && error instanceof ApiError && error.status === 409) {
        form.setError("username", { message: "Tên đăng nhập này đã có người dùng" })
        return
      }
      const incomplete = savedSomething || hasAppliedChangesRef.current
        ? "Một phần thay đổi đã được lưu. "
        : ""
      const detail = stage === "image"
        ? "Không cập nhật được ảnh. Hãy thử lưu lại ảnh còn lại."
        : "Không lưu được thông tin hồ sơ. Hãy thử lại."
      form.setError("root", { message: `${incomplete}${detail}` })
    }
  }

  const shownProfile = {
    ...profile,
    avatarUrl: imageUrl(profile, stagedImages, "AVATAR"),
    coverUrl: imageUrl(profile, stagedImages, "COVER"),
  }

  return (
    <>
      <header className="flex items-center gap-4 px-3 py-3">
        <DialogClose render={<Button variant="ghost" size="icon" shape="pill" aria-label="Đóng" />}>
          <XIcon />
        </DialogClose>
        <DialogTitle size="lg" className="flex-1">
          Chỉnh sửa hồ sơ
        </DialogTitle>
        <Button type="submit" form={FORM_ID} shape="pill" size="pill" disabled={isSubmitting || images.pending !== null}>
          {isSubmitting && <Spinner aria-hidden />}
          Lưu thay đổi
        </Button>
      </header>

      <div className="no-scrollbar overflow-y-auto">
        <ProfileImages
          profile={shownProfile}
          stagedImages={stagedImages}
          pending={images.pending}
          disabled={isSubmitting}
          onPick={(kind, file) => {
            form.clearErrors("root")
            onPreviewImageError(null)
            onPick(kind, file)
          }}
          onRemove={(kind) => {
            images.clearError()
            form.clearErrors("root")
            onPreviewImageError(null)
            const hasOriginalImage = kind === "AVATAR" ? profile.avatarUrl : profile.coverUrl
            onStagedImagesChange((current) => ({
              ...current,
              [kind]: hasOriginalImage ? { action: "remove" } : null,
            }))
          }}
          onInvalidFile={onPreviewImageError}
          onUndo={(kind) => {
            onStagedImagesChange((current) => ({ ...current, [kind]: null }))
            images.clearError()
            onPreviewImageError(null)
          }}
        />
        <p className="px-4 pt-3 text-xs leading-5 text-muted-foreground">
          Bạn có thể xem trước ảnh đại diện và ảnh bìa. Thay đổi chỉ được gửi đi khi bấm Lưu thay đổi.
        </p>
        {(previewImageError || images.error) && (
          <p role="alert" className="px-4 pt-2 text-sm text-destructive">
            {previewImageError || images.error}
          </p>
        )}

        <form
          id={FORM_ID}
          noValidate
          onSubmit={(event) => {
            void form.handleSubmit(onSubmit)(event)
          }}
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
            name="username"
            control={form.control}
            render={({ field, fieldState }) => (
              <OutlinedField
                id={field.name}
                label="Tên đăng nhập"
                count={`${field.value.length}/${MAX_USERNAME_LENGTH}`}
                error={fieldState.error}
                description="Hiển thị dạng @tên trên hồ sơ và là tên bạn dùng để đăng nhập."
              >
                <InputGroupInput
                  {...field}
                  id={field.name}
                  aria-invalid={fieldState.invalid}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
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
          <div className="flex justify-end">
            <DialogClose render={<Button type="button" variant="outline" shape="pill">Huỷ</Button>} />
          </div>
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
  description,
  children,
}: {
  id: string
  label: string
  count: string
  error?: { message?: string }
  description?: string
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
      {description && !error && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      {error && <FieldError className="mt-1" errors={[error]} />}
    </div>
  )
}

function ProfileImages({
  profile,
  stagedImages,
  pending,
  disabled,
  onPick,
  onRemove,
  onInvalidFile,
  onUndo,
}: {
  profile: ApiProfileSummary
  stagedImages: StagedImages
  pending: ImageKind | null
  disabled: boolean
  onPick: (kind: ImageKind, file: File) => void
  onRemove: (kind: ImageKind) => void
  onInvalidFile: (message: string) => void
  onUndo: (kind: ImageKind) => void
}) {
  return (
    <div>
      <ProfileCover profile={profile}>
        <ImagePicker kind="COVER" pending={pending} disabled={disabled} onPick={onPick} onInvalidFile={onInvalidFile}>
          {profile.coverUrl && (
            <Button
              type="button"
              variant="overlay"
              shape="pill"
              size="icon-xl"
              aria-label={`Gỡ ${IMAGES.COVER.label}`}
              disabled={disabled || pending !== null}
              onClick={() => onRemove("COVER")}
            >
              <XIcon />
            </Button>
          )}
          {stagedImages.COVER && (
            <Button
              type="button"
              variant="overlay"
              shape="pill"
              size="icon-xl"
              aria-label="Hoàn tác thay đổi ảnh bìa"
              disabled={disabled || pending !== null}
              onClick={() => onUndo("COVER")}
            >
              <RotateCcwIcon />
            </Button>
          )}
        </ImagePicker>
      </ProfileCover>

      <div className="-mt-12 ml-4 flex items-end gap-2">
        <div className="relative size-28 rounded-full border-4 border-popover bg-popover">
          <ProfileAvatar profile={profile} size="fill" />
          <ImagePicker kind="AVATAR" pending={pending} disabled={disabled} onPick={onPick} onInvalidFile={onInvalidFile} />
        </div>
        {profile.avatarUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            shape="pill"
            disabled={disabled || pending !== null}
            onClick={() => onRemove("AVATAR")}
          >
            Gỡ {IMAGES.AVATAR.label}
          </Button>
        )}
        {stagedImages.AVATAR && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            shape="pill"
            disabled={disabled || pending !== null}
            onClick={() => onUndo("AVATAR")}
          >
            Hoàn tác
          </Button>
        )}
      </div>
    </div>
  )
}

function ImagePicker({
  kind,
  pending,
  disabled,
  onPick,
  onInvalidFile,
  children,
}: {
  kind: ImageKind
  pending: ImageKind | null
  disabled: boolean
  onPick: (kind: ImageKind, file: File) => void
  onInvalidFile: (message: string) => void
  children?: React.ReactNode
}) {
  const { getRootProps, getInputProps, open } = useDropzone({
    accept: IMAGE_ACCEPT,
    maxSize: MAX_IMAGE_MB[kind] * 1024 * 1024,
    multiple: false,
    noClick: true,
    noKeyboard: true,
    disabled: disabled || pending !== null,
    onDropAccepted: ([file]) => onPick(kind, file),
    onDropRejected: ([rejection]) => {
      if (rejection?.errors.some((error) => error.code === "file-too-large")) {
        onInvalidFile(`Ảnh lớn hơn ${MAX_IMAGE_MB[kind]} MB. Chọn ảnh nhỏ hơn nhé.`)
      } else {
        onInvalidFile("Ảnh phải là JPEG, PNG hoặc WebP.")
      }
    },
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
        disabled={disabled || pending !== null}
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
  onApply: (file: File) => void | Promise<void>
}) {
  const { aspectRatio, maxWidth, shape, label } = IMAGES[kind]
  const [area, setArea] = useState<CropArea | null>(null)
  const [zoom, setZoom] = useState(1)
  const [applying, setApplying] = useState(false)
  const [cropError, setCropError] = useState<string | null>(null)

  async function apply() {
    if (!area) return
    setCropError(null)
    setApplying(true)
    try {
      await onApply(await cropImage(file, area, maxWidth))
    } catch {
      setCropError("Không cắt được ảnh này. Hãy thử ảnh khác.")
    } finally {
      setApplying(false)
    }
  }

  return (
    <>
      <header className="flex items-center gap-4 px-3 py-3">
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
      {cropError && <p role="alert" className="px-6 pb-4 text-sm text-destructive">{cropError}</p>}
    </>
  )
}
