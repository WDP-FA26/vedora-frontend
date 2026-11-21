"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  ArrowLeftRightIcon,
  CircleAlertIcon,
  ExternalLinkIcon,
  HourglassIcon,
  UndoIcon,
  UserMinusIcon,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { toAuthor } from "@/features/auth/lib/to-author"
import { profilePath } from "@/features/profiles/profiles-cache"
import { AuthorAvatar } from "@/features/shared/components/author-avatar"
import { ApiError } from "@/features/shared/lib/api-client"
import { formatPostDateLong } from "@/features/shared/lib/format"
import { LocationPicker } from "@/features/workspaces/components/location-picker"
import { PageHeader } from "@/features/workspaces/components/page-header"
import { WorkspaceStatusBadge } from "@/features/workspaces/components/status-badge"
import { useSwitchAccount } from "@/features/workspaces/hooks/use-switch-account"
import {
  useUpdateWorkspaceDetails,
  useWorkspace,
  useWorkspaceMembers,
} from "@/features/workspaces/hooks/use-workspaces"
import { workspaceAuthor } from "@/features/workspaces/lib/workspace-author"
import {
  addMemberFormSchema,
  MEMBER_ROLE_LABELS,
  restaurantDetailsFormSchema,
  type RestaurantDetailsFormInput,
  type RestaurantDetailsFormValues,
  type WorkspaceDetail,
  type WorkspaceMember,
} from "@/features/workspaces/schemas"
import { NEW_WORKSPACE_PATH, WORKSPACES_PATH } from "@/features/workspaces/workspaces-cache"

const MEMBER_ERRORS: Record<string, string> = {
  NOT_FOUND: "Không tìm thấy tài khoản cá nhân có tên đăng nhập này.",
  ALREADY_MEMBER: "Người này đã quản lý trang.",
  WORKSPACE_NOT_APPROVED: "Thêm người quản lý được sau khi trang được duyệt.",
  WORKSPACE_OWNER_REQUIRED: "Chỉ chủ trang mới làm được việc này.",
}

function memberErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.code && MEMBER_ERRORS[error.code]) {
    return MEMBER_ERRORS[error.code]
  }
  return "Không thực hiện được. Thử lại nhé."
}

/** One page you manage: its review status, switching into it, its address and its members. */
export function WorkspaceManageView({ id }: { id: string }) {
  const { workspace, error, isLoading } = useWorkspace(id)

  if (isLoading) {
    return (
      <section>
        <PageHeader title="Trang nhà hàng" backHref={WORKSPACES_PATH} />
        <div className="flex justify-center p-6">
          <Spinner aria-label="Đang tải" />
        </div>
      </section>
    )
  }
  if (error || !workspace) {
    return (
      <section>
        <PageHeader title="Trang nhà hàng" backHref={WORKSPACES_PATH} />
        <p role="alert" className="p-4 text-sm text-destructive sm:px-5">
          Không tìm thấy trang này, hoặc bạn không còn quản lý nó.
        </p>
      </section>
    )
  }
  return (
    <section aria-label={workspace.name}>
      <PageHeader title={workspace.name} backHref={WORKSPACES_PATH} />
      <div className="flex flex-col gap-8 p-4 sm:px-5">
        <Overview workspace={workspace} />
        <DetailsForm workspace={workspace} />
        <Members workspace={workspace} />
      </div>
    </section>
  )
}

function Overview({ workspace }: { workspace: WorkspaceDetail }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <AuthorAvatar author={workspaceAuthor(workspace)} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{workspace.name}</p>
          <p className="truncate text-sm text-muted-foreground">@{workspace.username}</p>
        </div>
        <WorkspaceStatusBadge status={workspace.status} />
      </div>
      <StatusPanel workspace={workspace} />
    </div>
  )
}

function StatusPanel({ workspace }: { workspace: WorkspaceDetail }) {
  if (workspace.status === "PENDING") {
    return (
      <Alert>
        <HourglassIcon aria-hidden />
        <AlertTitle>Đang chờ quản trị viên duyệt</AlertTitle>
        <AlertDescription>
          Gửi ngày {formatPostDateLong(workspace.createdAt)}, kèm {workspace.proofCount} ảnh minh
          chứng. Trang sẽ hiện với mọi người sau khi được duyệt.
        </AlertDescription>
      </Alert>
    )
  }
  if (workspace.status === "REJECTED") {
    return (
      <Alert variant="destructive">
        <CircleAlertIcon aria-hidden />
        <AlertTitle>Đơn chưa được duyệt</AlertTitle>
        <AlertDescription>
          <p>{workspace.reviewNote ?? "Quản trị viên không để lại lý do."}</p>
          {workspace.role === "OWNER" && (
            <Link
              href={`${NEW_WORKSPACE_PATH}?resubmit=${workspace.id}`}
              className="mt-2 inline-block font-medium underline underline-offset-4"
            >
              Sửa và gửi lại
            </Link>
          )}
        </AlertDescription>
      </Alert>
    )
  }
  if (!workspace.pageUserId) return null
  return <ApprovedActions pageUserId={workspace.pageUserId} />
}

function ApprovedActions({ pageUserId }: { pageUserId: string }) {
  const { user } = useAuth()
  const { switchTo, pending } = useSwitchAccount()
  const actingAsPage = user?.id === pageUserId

  return (
    <div className="flex flex-wrap gap-2">
      {actingAsPage && user.actor ? (
        <Button
          variant="outline"
          shape="pill"
          disabled={pending}
          onClick={() => switchTo(null, WORKSPACES_PATH)}
        >
          {pending ? <Spinner aria-hidden /> : <UndoIcon aria-hidden />}
          Về tài khoản @{user.actor.username}
        </Button>
      ) : (
        <Button
          shape="pill"
          disabled={pending}
          onClick={() => switchTo(pageUserId, profilePath(pageUserId))}
        >
          {pending ? <Spinner aria-hidden /> : <ArrowLeftRightIcon aria-hidden />}
          Chuyển sang trang
        </Button>
      )}
      <Button
        variant="outline"
        shape="pill"
        nativeButton={false}
        render={<Link href={profilePath(pageUserId)} />}
      >
        <ExternalLinkIcon aria-hidden />
        Xem trang
      </Button>
    </div>
  )
}

function DetailsForm({ workspace }: { workspace: WorkspaceDetail }) {
  const update = useUpdateWorkspaceDetails(workspace.id)
  const form = useForm<RestaurantDetailsFormInput, unknown, RestaurantDetailsFormValues>({
    resolver: zodResolver(restaurantDetailsFormSchema),
    defaultValues: {
      address: workspace.address,
      location: { longitude: workspace.longitude, latitude: workspace.latitude },
      phone: workspace.phone ?? "",
      website: workspace.website ?? "",
    },
  })
  const { isSubmitting, isDirty, errors } = form.formState
  const address = useWatch({ control: form.control, name: "address" }) ?? ""

  async function onSubmit(values: RestaurantDetailsFormValues) {
    try {
      await update(values)
      form.reset(form.getValues())
      toast.add({ title: "Đã lưu thông tin nhà hàng" })
    } catch {
      form.setError("root", { message: "Không lưu được. Thử lại nhé." })
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate aria-labelledby="details-title">
      <h2 id="details-title" className="mb-4 text-base font-bold">
        Địa chỉ và liên hệ
      </h2>
      <FieldGroup>
        <Controller
          name="address"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Địa chỉ</FieldLabel>
              <Input {...field} id={field.name} aria-invalid={fieldState.invalid} />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="location"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldTitle>Vị trí trên bản đồ</FieldTitle>
              <LocationPicker
                address={address}
                location={field.value ?? null}
                invalid={fieldState.invalid}
                disabled={isSubmitting}
                onAddressChange={(address) =>
                  form.setValue("address", address, { shouldDirty: true, shouldValidate: true })
                }
                onLocationChange={field.onChange}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            name="phone"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Số điện thoại</FieldLabel>
                <Input {...field} id={field.name} type="tel" aria-invalid={fieldState.invalid} />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="website"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Website</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  type="url"
                  placeholder="https://"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </div>
        {errors.root && <FieldError errors={[errors.root]} />}
        <div>
          <Button type="submit" shape="pill" disabled={isSubmitting || !isDirty}>
            {isSubmitting && <Spinner aria-hidden />}
            Lưu thay đổi
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}

function Members({ workspace }: { workspace: WorkspaceDetail }) {
  const { user } = useAuth()
  const router = useRouter()
  const members = useWorkspaceMembers(workspace.id)
  const [removing, setRemoving] = useState<string | null>(null)
  const personId = user?.actor?.id ?? user?.id
  const isOwner = workspace.role === "OWNER"

  async function remove(member: WorkspaceMember) {
    const leaving = member.userId === personId
    setRemoving(member.userId)
    try {
      await members.remove(member.userId)
      if (leaving) router.push(WORKSPACES_PATH)
    } catch (error) {
      toast.add({ title: "Chưa xóa được", description: memberErrorMessage(error) })
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div aria-labelledby="members-title" className="flex flex-col gap-4">
      <div>
        <h2 id="members-title" className="text-base font-bold">
          Người quản lý
        </h2>
        <p className="text-sm text-muted-foreground">
          Mọi người trong danh sách đều có thể chuyển sang trang và Đăng, trả lời tin nhắn với tư
          cách nhà hàng.
        </p>
      </div>
      <ul className="divide-y divide-border rounded-2xl border border-border">
        {workspace.members.map((member) => {
          const isSelf = member.userId === personId
          // Leaving while acting as this page would end the only session left.
          const leavingOwnPageSession = isSelf && user?.id === workspace.pageUserId
          const canRemove =
            member.role !== "OWNER" && (isOwner || isSelf) && !leavingOwnPageSession
          return (
            <li key={member.userId} className="flex items-center gap-3 px-3 py-2">
              <AuthorAvatar
                author={toAuthor({
                  id: member.userId,
                  username: member.username,
                  fullName: member.fullName,
                  avatarUrl: member.avatarUrl,
                })}
              />
              <Link href={profilePath(member.userId)} className="min-w-0 flex-1 hover:underline">
                <span className="block truncate text-sm font-bold">{member.fullName}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  @{member.username} · {MEMBER_ROLE_LABELS[member.role]}
                </span>
              </Link>
              {canRemove && (
                <Button
                  variant="ghost"
                  size="sm"
                  shape="pill"
                  disabled={removing !== null}
                  onClick={() => void remove(member)}
                >
                  {removing === member.userId ? (
                    <Spinner aria-hidden />
                  ) : (
                    <UserMinusIcon aria-hidden />
                  )}
                  {isSelf ? "Rời trang" : "Xóa"}
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      {user?.id === workspace.pageUserId && !isOwner && (
        <p className="text-sm text-muted-foreground">
          Muốn rời trang, hãy về tài khoản cá nhân trước.
        </p>
      )}
      {isOwner && workspace.status === "APPROVED" && (
        <AddMemberForm onAdd={members.add} />
      )}
    </div>
  )
}

function AddMemberForm({ onAdd }: { onAdd: (username: string) => Promise<void> }) {
  const form = useForm({
    resolver: zodResolver(addMemberFormSchema),
    defaultValues: { username: "" },
  })
  const { isSubmitting, errors } = form.formState

  async function onSubmit({ username }: { username: string }) {
    try {
      await onAdd(username)
      form.reset()
    } catch (error) {
      form.setError("username", { message: memberErrorMessage(error) })
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-2">
      <label htmlFor="member-username" className="text-sm font-medium">
        Thêm người quản lý
      </label>
      <div className="flex gap-2">
        <Input
          id="member-username"
          {...form.register("username")}
          aria-invalid={Boolean(errors.username)}
          autoCapitalize="none"
          spellCheck={false}
          placeholder="Tên đăng nhập, ví dụ an.nguyen"
        />
        <Button type="submit" shape="pill" disabled={isSubmitting}>
          {isSubmitting && <Spinner aria-hidden />}
          Thêm
        </Button>
      </div>
      {errors.username && <FieldError errors={[errors.username]} />}
    </form>
  )
}
