"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useSWRConfig } from "swr"
import {
  CircleAlertIcon,
  CopyIcon,
  MoreHorizontalIcon,
  ShieldCheckIcon,
  ShieldOffIcon,
  UserCheckIcon,
  UserRoundIcon,
  UserXIcon,
} from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { ADMIN_USERS_KEY } from "@/features/admin/admin-cache"
import { ROLE_LABELS, STATUS_LABELS } from "@/features/admin/components/users/user-columns"
import {
  updateUserRole,
  updateUserStatus,
  type AccountRoleChange,
  type AccountStatusChange,
} from "@/features/admin/lib/admin-api"
import type { AdminUser } from "@/features/admin/schemas"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { profilePath } from "@/features/profiles/profiles-cache"
import { ApiError } from "@/features/shared/lib/api-client"

/** The API's limit on `reason`. */
const MAX_REASON_LENGTH = 500

/** A change an admin confirms with a reason. */
type AccountAction =
  | { kind: "status"; status: AccountStatusChange["status"] }
  | { kind: "role"; role: AccountRoleChange["role"] }

/** The status an admin can move the account to, or null when no change applies. */
function nextStatus(status: AdminUser["status"]): AccountStatusChange["status"] | null {
  if (status === "ACTIVE") return "SUSPENDED"
  if (status === "SUSPENDED") return "ACTIVE"
  return null
}

/** False once the account already is where the action would take it, or can't go there. */
function stillApplies(action: AccountAction, user: AdminUser) {
  return action.kind === "status"
    ? nextStatus(user.status) === action.status
    : user.role !== action.role
}

/** Refusals the admin can't fix by retrying; shown in the dialog. */
const REFUSALS: Record<string, string> = {
  LAST_ACTIVE_ADMIN:
    "Phải còn ít nhất một quản trị viên đang hoạt động. Hãy cấp quyền quản trị cho tài khoản khác trước.",
  INVALID_ACCOUNT_TRANSITION:
    "Chỉ đình chỉ hoặc kích hoạt lại tài khoản đã xác minh email. Tài khoản chờ xác minh phải tự xác minh email.",
}

function copyFor(action: AccountAction, isSelf: boolean) {
  if (action.kind === "status") {
    return action.status === "SUSPENDED"
      ? {
          title: "Đình chỉ tài khoản này?",
          note: "Tài khoản sẽ không đăng nhập hay gọi API được nữa cho tới khi được kích hoạt lại.",
          done: "Đã đình chỉ tài khoản",
          destructive: true,
        }
      : {
          title: "Kích hoạt lại tài khoản này?",
          note: "Phiên đăng nhập cũ còn hạn của tài khoản có thể dùng lại ngay sau khi kích hoạt.",
          done: "Đã kích hoạt lại tài khoản",
          destructive: false,
        }
  }
  return action.role === "ADMIN"
    ? {
        title: "Cấp quyền quản trị cho tài khoản này?",
        note: "Tài khoản sẽ vào được trang quản trị và thao tác như mọi quản trị viên.",
        done: "Đã cấp quyền quản trị",
        destructive: false,
      }
    : {
        title: isSelf ? "Thu hồi quyền quản trị của chính bạn?" : "Thu hồi quyền quản trị của tài khoản này?",
        note: isSelf
          ? "Bạn sẽ mất quyền vào trang quản trị ngay sau khi xác nhận."
          : "Tài khoản sẽ trở thành thành viên thường.",
        done: "Đã thu hồi quyền quản trị",
        destructive: true,
      }
}

/** Row actions for one account: profile, email, suspend or reactivate, and admin rights. */
export function UserRowMenu({ user }: { user: AdminUser }) {
  const { accessToken, user: me } = useAuth()
  const router = useRouter()
  const { mutate } = useSWRConfig()
  const [action, setAction] = useState<AccountAction | null>(null)
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  /** Set when the API refused a stale version and the row was read again. */
  const [reloaded, setReloaded] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)

  const isSelf = me?.id === user.id
  const next = nextStatus(user.status)
  // Once the row reloads with the change already made, there is nothing left to confirm.
  const pending = action && stillApplies(action, user) ? action : null
  const copy = pending ? copyFor(pending, isSelf) : null

  /** Reads every loaded user list again; resolves with the fresh copy of this account. */
  async function reloadUsers() {
    const lists = await mutate<AdminUser[]>(
      (key) => Array.isArray(key) && String(key[0]).startsWith(ADMIN_USERS_KEY)
    )
    return lists.flat().find((account) => account?.id === user.id)
  }

  function open(nextAction: AccountAction) {
    setAction(nextAction)
    setReason("")
    setReloaded(false)
    setRefusal(null)
  }

  async function save() {
    const action = pending
    if (!accessToken || !action || !copy || saving) return
    setSaving(true)
    setRefusal(null)
    const operation = { reason: reason.trim(), expectedVersion: user.accountVersion }
    try {
      if (action.kind === "status") {
        await updateUserStatus(accessToken, user.id, { ...operation, status: action.status })
      } else {
        await updateUserRole(accessToken, user.id, { ...operation, role: action.role })
      }
      toast.add({ title: copy.done, description: `@${user.username}` })
      setAction(null)
      void reloadUsers()
      // Demoting yourself takes the admin pages away: let the server re-check.
      if (isSelf && action.kind === "role") router.refresh()
    } catch (error) {
      if (!(error instanceof ApiError)) {
        setRefusal("Không kết nối được máy chủ. Thử lại sau nhé.")
      } else if (error.code === "ACCOUNT_VERSION_CONFLICT") {
        // Never resend the old version: read the account again and ask again.
        const fresh = await reloadUsers()
        if (fresh && !stillApplies(action, fresh)) {
          setAction(null)
          toast.add({
            title: "Tài khoản đã được cập nhật",
            description: `@${user.username} đã ở trạng thái này, không cần thao tác nữa.`,
          })
        } else {
          setReloaded(true)
        }
      } else if (error.code && REFUSALS[error.code]) {
        setRefusal(REFUSALS[error.code])
      } else if (error.status === 404) {
        setAction(null)
        toast.add({ title: "Tài khoản không còn tồn tại", description: `@${user.username}` })
        void reloadUsers()
      } else if (error.status === 401 || error.status === 403) {
        // Signed out, suspended or no longer an admin: the server decides where to go.
        setAction(null)
        router.refresh()
      } else {
        setRefusal(error.message)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="action" size="icon-sm" />}>
          <span className="sr-only">Thao tác với {user.fullName}</span>
          <MoreHorizontalIcon aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem render={<Link href={profilePath(user.id)} />}>
            <UserRoundIcon aria-hidden />
            Xem hồ sơ
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigator.clipboard.writeText(user.email)}>
            <CopyIcon aria-hidden />
            Sao chép email
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {user.role === "ADMIN" ? (
            <DropdownMenuItem variant="destructive" onClick={() => open({ kind: "role", role: "USER" })}>
              <ShieldOffIcon aria-hidden />
              Thu hồi quyền quản trị
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => open({ kind: "role", role: "ADMIN" })}>
              <ShieldCheckIcon aria-hidden />
              Cấp quyền quản trị
            </DropdownMenuItem>
          )}
          {next && (
            <DropdownMenuItem
              variant={next === "SUSPENDED" ? "destructive" : undefined}
              onClick={() => open({ kind: "status", status: next })}
            >
              {next === "SUSPENDED" ? <UserXIcon aria-hidden /> : <UserCheckIcon aria-hidden />}
              {next === "SUSPENDED" ? "Đình chỉ tài khoản" : "Kích hoạt lại"}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog
        open={pending !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen && !saving) setAction(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              @{user.username} · {ROLE_LABELS[user.role]} · {STATUS_LABELS[user.status]} · phiên bản v
              {user.accountVersion}. {copy?.note} Lý do được lưu trong nhật ký quản trị.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {reloaded && (
            <Alert>
              <CircleAlertIcon aria-hidden />
              <AlertDescription>
                Tài khoản vừa được thay đổi ở nơi khác. Thông tin ở trên đã được tải lại; kiểm tra
                rồi bấm Xác nhận lần nữa.
              </AlertDescription>
            </Alert>
          )}
          {refusal && (
            <Alert variant="destructive">
              <CircleAlertIcon aria-hidden />
              <AlertDescription>{refusal}</AlertDescription>
            </Alert>
          )}
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={MAX_REASON_LENGTH}
            placeholder="Lý do (bắt buộc)"
            aria-label="Lý do"
            disabled={saving}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              variant={copy?.destructive ? "destructive" : "default"}
              disabled={saving || reason.trim() === ""}
              onClick={() => void save()}
            >
              {saving ? "Đang lưu…" : "Xác nhận"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
