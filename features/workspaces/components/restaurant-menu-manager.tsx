"use client"

import { useRef, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  ImagePlusIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UtensilsIcon,
  XIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { ApiError } from "@/features/shared/lib/api-client"
import { useWorkspaceMenu } from "@/features/workspaces/hooks/use-restaurant-menu"
import { formatPriceVnd } from "@/features/workspaces/lib/format"
import type { RestaurantMenuItemInput } from "@/features/workspaces/lib/workspaces-api"
import {
  MAX_MENU_IMAGE_MB,
  MAX_MENU_ITEM_DESCRIPTION_LENGTH,
  MAX_MENU_ITEM_NAME_LENGTH,
  MAX_MENU_ITEM_PRICE_VND,
  MENU_CATEGORIES,
  MENU_IMAGE_TYPES,
  menuItemFormSchema,
  type MenuItemFormInput,
  type MenuItemFormValues,
  type RestaurantMenuItem,
  type WorkspaceDetail,
} from "@/features/workspaces/schemas"

const MAX_IMAGE_BYTES = MAX_MENU_IMAGE_MB * 1024 * 1024

function saveErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 503) return "Chưa thể tải ảnh lúc này. Thử lại sau nhé."
    return error.message
  }
  return "Không lưu được món ăn. Thử lại nhé."
}

function defaultFormValues(item: RestaurantMenuItem | null): MenuItemFormInput {
  if (!item) {
    return {
      name: "",
      category: "",
      priceText: "",
      description: "",
      imageUrl: null,
      isAvailable: true,
    }
  }
  return {
    name: item.name,
    category: item.category ?? "",
    priceText: item.priceVnd !== null ? String(item.priceVnd) : "",
    description: item.description ?? "",
    imageUrl: item.imageUrl,
    isAvailable: item.isAvailable,
  }
}

/** Owner/manager menu CRUD section inside `/home/pages/[id]`. */
export function RestaurantMenuManager({ workspace }: { workspace: WorkspaceDetail }) {
  const menu = useWorkspaceMenu(workspace.id, workspace.pageUserId)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<RestaurantMenuItem | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(item: RestaurantMenuItem) {
    setEditing(item)
    setDialogOpen(true)
  }

  async function toggleAvailability(item: RestaurantMenuItem, next: boolean) {
    setTogglingId(item.id)
    try {
      await menu.update(item.id, { isAvailable: next })
      toast.add({ title: next ? `Đã mở bán “${item.name}”` : `Đã tạm ẩn “${item.name}”` })
    } catch {
      toast.add({ title: "Không cập nhật được trạng thái món ăn.", type: "error" })
    } finally {
      setTogglingId(null)
    }
  }

  async function handleDelete(item: RestaurantMenuItem) {
    setDeletingId(item.id)
    try {
      await menu.remove(item.id)
      toast.add({ title: `Đã xóa “${item.name}” khỏi thực đơn` })
    } catch {
      toast.add({ title: "Không xóa được món ăn. Thử lại nhé.", type: "error" })
    } finally {
      setDeletingId(null)
    }
  }

  async function handleSave(values: MenuItemFormValues) {
    const payload: RestaurantMenuItemInput = {
      name: values.name,
      category: values.category,
      description: values.description,
      priceVnd: values.priceText === "" ? null : Number(values.priceText),
      imageUrl: values.imageUrl,
      isAvailable: values.isAvailable,
    }
    if (editing) {
      await menu.update(editing.id, payload)
      toast.add({ title: `Đã cập nhật “${values.name}”` })
    } else {
      await menu.create(payload)
      toast.add({ title: `Đã thêm “${values.name}” vào thực đơn` })
    }
    setDialogOpen(false)
  }

  return (
    <div className="flex flex-col gap-4 border-t border-border pt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">Thực đơn</h2>
          <p className="text-sm text-muted-foreground">
            {workspace.status === "APPROVED"
              ? "Các món đang bán sẽ hiển thị trên trang nhà hàng, trong tìm kiếm và gợi ý của trợ lý."
              : "Bạn có thể chuẩn bị sẵn thực đơn; các món sẽ hiển thị công khai sau khi trang được duyệt."}
          </p>
        </div>
        <Button type="button" shape="pill" size="sm" onClick={openCreate}>
          <PlusIcon aria-hidden />
          Thêm món
        </Button>
      </div>

      {menu.isLoading ? (
        <div className="flex justify-center py-6">
          <Spinner aria-label="Đang tải thực đơn" />
        </div>
      ) : menu.error ? (
        <p role="alert" className="text-sm text-destructive">
          Chưa tải được thực đơn lúc này.
        </p>
      ) : menu.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center">
          <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <UtensilsIcon aria-hidden className="size-5" />
          </div>
          <p className="text-sm font-medium">Chưa có món nào trong thực đơn</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Thêm món chay để thực khách xem thực đơn và tìm thấy nhà hàng qua tìm kiếm.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {menu.items.map((item) => {
            const priceLabel = formatPriceVnd(item.priceVnd)
            const busy = togglingId === item.id || deletingId === item.id
            return (
              <li key={item.id} className="flex items-start gap-3 p-3.5">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- external R2/S3 dish photo
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    referrerPolicy="no-referrer"
                    className="size-16 shrink-0 rounded-xl border border-border object-cover"
                  />
                ) : (
                  <div className="flex size-16 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
                    <UtensilsIcon aria-hidden className="size-5" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{item.name}</span>
                    {item.category && <Badge variant="secondary">{item.category}</Badge>}
                    {!item.isAvailable && <Badge variant="outline">Tạm hết</Badge>}
                  </div>
                  <p className="mt-0.5 text-sm font-medium text-primary">
                    {priceLabel ?? "Giá liên hệ"}
                  </p>
                  {item.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  )}
                  <div className="mt-2.5 flex flex-wrap items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                      <Switch
                        size="sm"
                        checked={item.isAvailable}
                        disabled={busy}
                        onCheckedChange={(checked) => void toggleAvailability(item, checked)}
                      />
                      <span>{item.isAvailable ? "Đang bán" : "Tạm hết"}</span>
                    </label>
                    <div className="ml-auto flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        disabled={busy}
                        onClick={() => openEdit(item)}
                      >
                        <PencilIcon aria-hidden />
                        Sửa
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        disabled={busy}
                        onClick={() => void handleDelete(item)}
                      >
                        {deletingId === item.id ? (
                          <Spinner aria-hidden />
                        ) : (
                          <Trash2Icon aria-hidden />
                        )}
                        Xóa
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          {dialogOpen && (
            <MenuItemFormInner
              key={editing ? `${editing.id}:${editing.updatedAt}` : "new"}
              editing={editing}
              uploadImage={menu.uploadImage}
              onSave={handleSave}
              onCancel={() => setDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MenuItemFormInner({
  editing,
  uploadImage,
  onSave,
  onCancel,
}: {
  editing: RestaurantMenuItem | null
  uploadImage: (file: File) => Promise<string>
  onSave: (values: MenuItemFormValues) => Promise<void>
  onCancel: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)

  const form = useForm<MenuItemFormInput, unknown, MenuItemFormValues>({
    resolver: zodResolver(menuItemFormSchema),
    defaultValues: defaultFormValues(editing),
  })

  const { isSubmitting, errors } = form.formState
  const imageUrl = useWatch({ control: form.control, name: "imageUrl" })

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    if (!MENU_IMAGE_TYPES.includes(file.type as (typeof MENU_IMAGE_TYPES)[number])) {
      setImageError("Chọn ảnh JPG, PNG hoặc WebP.")
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError(`Ảnh tối đa ${MAX_MENU_IMAGE_MB} MB.`)
      return
    }

    setImageError(null)
    setUploadingImage(true)
    try {
      const url = await uploadImage(file)
      form.setValue("imageUrl", url, { shouldDirty: true })
    } catch (error) {
      setImageError(saveErrorMessage(error))
    } finally {
      setUploadingImage(false)
    }
  }

  async function onSubmit(values: MenuItemFormValues) {
    try {
      await onSave(values)
    } catch (error) {
      form.setError("root", { message: saveErrorMessage(error) })
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <DialogHeader>
        <DialogTitle size="lg">{editing ? "Chỉnh sửa món ăn" : "Thêm món mới"}</DialogTitle>
        <DialogDescription>
          Nhập thông tin món chay để hiển thị trong thực đơn và tìm kiếm trên Vedora.
        </DialogDescription>
      </DialogHeader>

      <div className="mt-4 max-h-[65dvh] overflow-y-auto pr-1">
        <FieldGroup>
          <Field data-invalid={Boolean(errors.name) || undefined}>
            <FieldLabel htmlFor="menu-item-name">Tên món *</FieldLabel>
            <Input
              id="menu-item-name"
              maxLength={MAX_MENU_ITEM_NAME_LENGTH}
              placeholder="Ví dụ: Bún riêu chay nấm"
              aria-invalid={Boolean(errors.name)}
              {...form.register("name")}
            />
            {errors.name && <FieldError errors={[errors.name]} />}
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field data-invalid={Boolean(errors.category) || undefined}>
              <FieldLabel htmlFor="menu-item-category">Danh mục</FieldLabel>
              <Input
                id="menu-item-category"
                list="menu-category-suggestions"
                placeholder="Món chính, Món nước…"
                aria-invalid={Boolean(errors.category)}
                {...form.register("category")}
              />
              <datalist id="menu-category-suggestions">
                {MENU_CATEGORIES.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
              {errors.category && <FieldError errors={[errors.category]} />}
            </Field>

            <Field data-invalid={Boolean(errors.priceText) || undefined}>
              <FieldLabel htmlFor="menu-item-price">Giá (VNĐ)</FieldLabel>
              <Input
                id="menu-item-price"
                inputMode="numeric"
                placeholder="55000 (để trống nếu liên hệ)"
                aria-invalid={Boolean(errors.priceText)}
                max={MAX_MENU_ITEM_PRICE_VND}
                {...form.register("priceText")}
              />
              {errors.priceText && <FieldError errors={[errors.priceText]} />}
            </Field>
          </div>

          <Field data-invalid={Boolean(errors.description) || undefined}>
            <FieldLabel htmlFor="menu-item-description">Mô tả món</FieldLabel>
            <Textarea
              id="menu-item-description"
              rows={3}
              maxLength={MAX_MENU_ITEM_DESCRIPTION_LENGTH}
              placeholder="Thành phần chính, hương vị, cách chế biến…"
              aria-invalid={Boolean(errors.description)}
              {...form.register("description")}
            />
            {errors.description && <FieldError errors={[errors.description]} />}
          </Field>

          <Field data-invalid={Boolean(imageError) || undefined}>
            <FieldLabel>Ảnh món ăn (tùy chọn)</FieldLabel>
            <input
              ref={fileInputRef}
              type="file"
              accept={MENU_IMAGE_TYPES.join(",")}
              onChange={(event) => void handleFileChange(event)}
              className="sr-only"
            />
            {imageUrl ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- external R2/S3 dish photo */}
                <img
                  src={imageUrl}
                  alt="Ảnh xem trước món ăn"
                  referrerPolicy="no-referrer"
                  className="size-20 rounded-xl border border-border object-cover"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingImage}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Đổi ảnh
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={uploadingImage}
                    onClick={() => form.setValue("imageUrl", null, { shouldDirty: true })}
                  >
                    <XIcon aria-hidden />
                    Gỡ ảnh
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingImage}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadingImage ? <Spinner aria-hidden /> : <ImagePlusIcon aria-hidden />}
                  {uploadingImage ? "Đang tải ảnh…" : "Chọn ảnh món ăn"}
                </Button>
              </div>
            )}
            <FieldDescription>JPG, PNG hoặc WebP, tối đa {MAX_MENU_IMAGE_MB} MB.</FieldDescription>
            {imageError && <p className="text-xs text-destructive">{imageError}</p>}
          </Field>

          <Controller
            control={form.control}
            name="isAvailable"
            render={({ field }) => (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">Đang phục vụ món này</p>
                  <p className="text-xs text-muted-foreground">
                    Tắt nếu món đang tạm hết mà chưa muốn xóa khỏi thực đơn.
                  </p>
                </div>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  aria-label="Đang phục vụ món này"
                />
              </div>
            )}
          />

          {errors.root && <FieldError errors={[errors.root]} />}
        </FieldGroup>
      </div>

      <div className="mt-5">
        <DialogFooter>
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>
            Hủy
          </Button>
          <Button type="submit" disabled={isSubmitting || uploadingImage}>
            {isSubmitting && <Spinner aria-hidden />}
            {editing ? "Lưu thay đổi" : "Thêm món"}
          </Button>
        </DialogFooter>
      </div>
    </form>
  )
}
