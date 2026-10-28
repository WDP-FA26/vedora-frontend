"use client"

import Link from "next/link"
import { useState } from "react"
import { useSWRConfig } from "swr"
import { CopyIcon, MoreHorizontalIcon, UserCheckIcon, UserRoundIcon, UserXIcon } from "lucide-react"

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
import { updateUserStatus, type AccountStatusChange } from "@/features/admin/lib/admin-api"
import type { AdminUser } from "@/features/admin/schemas"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { profilePath } from "@/features/profiles/profiles-cache"
import { ApiError } from "@/features/shared/lib/api-client"

/** The status an admin can move the account to, or null when no change applies. */
function nextStatus(status: AdminUser["status"]): AccountStatusChange["status"] | null {
  if (status === "ACTIVE") return "SUSPENDED"
  if (status === "SUSPENDED") return "ACTIVE"
  return null
}

/** Shown for the API codes a status change can return. */
const STATUS_ERRORS: Record<string, string> = {
  ACCOUNT_VERSION_CONFLICT: "Tài khoản vừa thay đổi. Tải lại trang rồi thử lại.",
  LAST_ACTIVE_ADMIN: "Phải còn ít nhất một quản trị viên đang hoạt động.",
  INVALID_ACCOUNT_TRANSITION: "Chỉ đình chỉ hoặc kích hoạt lại tài khoản đã xác minh.",
}

/** Row actions for one account: profile, email, and suspend or reactivate. */
export function UserRowMenu({ user }: { user: AdminUser }) {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()
  const [target, setTarget] = useState<AccountStatusChange["status"] | null>(null)
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const next = nextStatus(user.status)

  async function save() {
    if (!accessToken || !target) return
    setSaving(true)
    try {
      await updateUserStatus(accessToken, user.id, {
        status: target,
        reason: reason.trim(),
        expectedVersion: user.accountVersion,
      })
      toast.add({
        title: target === "SUSPENDED" ? "Đã đình chỉ tài khoản" : "Đã kích hoạt lại tài khoản",
        description: `@${user.username}`,
      })
      setTarget(null)
      setReason("")
      void mutate((key) => Array.isArray(key) && String(key[0]).startsWith(ADMIN_USERS_KEY))
    } catch (error) {
      const message =
        error instanceof ApiError && error.code !== undefined
          ? (STATUS_ERRORS[error.code] ?? error.message)
          : "Thử lại sau nhé."
      toast.add({ title: "Không cập nhật được tài khoản", description: message })
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
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem render={<Link href={profilePath(user.id)} />}>
            <UserRoundIcon aria-hidden />
            Xem hồ sơ
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigator.clipboard.writeText(user.email)}>
            <CopyIcon aria-hidden />
            Sao chép email
          </DropdownMenuItem>
          {next && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant={next === "SUSPENDED" ? "destructive" : undefined}
                onClick={() => setTarget(next)}
              >
                {next === "SUSPENDED" ? <UserXIcon aria-hidden /> : <UserCheckIcon aria-hidden />}
                {next === "SUSPENDED" ? "Đình chỉ tài khoản" : "Kích hoạt lại"}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {target === "SUSPENDED" ? "Đình chỉ tài khoản này?" : "Kích hoạt lại tài khoản này?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              @{user.username}. Ghi rõ lý do; lý do được lưu trong nhật ký quản trị.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            placeholder="Lý do (bắt buộc)"
            aria-label="Lý do"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              variant={target === "SUSPENDED" ? "destructive" : "default"}
              disabled={saving || reason.trim() === ""}
              onClick={() => void save()}
            >
              Xác nhận
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
