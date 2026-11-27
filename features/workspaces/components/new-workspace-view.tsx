"use client"

import { useRouter } from "next/navigation"
import { CircleAlertIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { PageHeader } from "@/features/workspaces/components/page-header"
import { WorkspaceForm } from "@/features/workspaces/components/workspace-form"
import { useWorkspace } from "@/features/workspaces/hooks/use-workspaces"
import { REJECT_REASON_LABELS } from "@/features/workspaces/onboarding"
import { WORKSPACES_PATH, workspacePath } from "@/features/workspaces/workspaces-cache"

export function NewWorkspaceView({ resubmitId }: { resubmitId: string | null }) {
  const { user } = useAuth()
  const backHref = resubmitId ? workspacePath(resubmitId) : WORKSPACES_PATH
  const title = resubmitId ? "Gửi lại đơn mở trang" : "Mở trang nhà hàng"

  if (user?.actor) {
    return (
      <section>
        <PageHeader title={title} backHref={backHref} />
        <p className="p-4 text-sm text-muted-foreground sm:px-5">
          Bạn đang dùng Vedora với tư cách một trang. Chuyển về tài khoản @{user.actor.username}{" "}
          trong menu tài khoản để mở trang mới.
        </p>
      </section>
    )
  }

  return (
    <section>
      <PageHeader title={title} backHref={backHref} />
      <div className="flex flex-col gap-6 p-4 sm:px-5">
        {resubmitId ? (
          <ResubmitForm id={resubmitId} />
        ) : (
          <>
            <p className="text-[0.9375rem] leading-6 text-muted-foreground">
              Trang nhà hàng là một tài khoản riêng: có hồ sơ, người theo dõi, bài Đăng và tin nhắn
              riêng, và hiện trên bản đồ nhà hàng chay. Đơn gồm 3 bước: hồ sơ quán, thông tin pháp
              lý và giấy tờ. Quản trị viên kiểm tra giấy tờ và gọi điện xác minh trước khi duyệt.
            </p>
            <SubmitForm />
          </>
        )}
      </div>
    </section>
  )
}

function SubmitForm() {
  const router = useRouter()
  return (
    <WorkspaceForm
      rejected={null}
      onSubmitted={(workspace) => router.push(workspacePath(workspace.id))}
    />
  )
}

function ResubmitForm({ id }: { id: string }) {
  const router = useRouter()
  const { workspace, error, isLoading } = useWorkspace(id)

  if (isLoading) {
    return (
      <div className="flex justify-center p-6">
        <Spinner aria-label="Đang tải" />
      </div>
    )
  }
  if (error || !workspace) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Không tải được trang này. Thử tải lại nhé.
      </p>
    )
  }
  if (workspace.status !== "REJECTED" || workspace.role !== "OWNER") {
    return (
      <p className="text-sm text-muted-foreground">
        Chỉ chủ trang mới gửi lại được, và chỉ khi đơn bị từ chối.
      </p>
    )
  }
  return (
    <>
      <Alert variant="destructive">
        <CircleAlertIcon aria-hidden />
        <AlertTitle>Đơn trước chưa được duyệt</AlertTitle>
        <AlertDescription>
          {workspace.rejectReason && `${REJECT_REASON_LABELS[workspace.rejectReason]}. `}
          {workspace.reviewNote && `${workspace.reviewNote} `}
          Sửa lại thông tin, chụp lại giấy tờ rồi gửi lại nhé.
        </AlertDescription>
      </Alert>
      <WorkspaceForm
        rejected={workspace}
        onSubmitted={(updated) => router.push(workspacePath(updated.id))}
      />
    </>
  )
}
