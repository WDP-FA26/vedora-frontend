"use client"

import Link from "next/link"
import { PlusIcon, StoreIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { AuthorAvatar } from "@/features/shared/components/author-avatar"
import { workspaceAuthor } from "@/features/workspaces/lib/workspace-author"
import { PageHeader } from "@/features/workspaces/components/page-header"
import { WorkspaceStatusBadge } from "@/features/workspaces/components/status-badge"
import { useMyWorkspaces } from "@/features/workspaces/hooks/use-workspaces"
import { MEMBER_ROLE_LABELS, type Workspace } from "@/features/workspaces/schemas"
import { NEW_WORKSPACE_PATH, workspacePath } from "@/features/workspaces/workspaces-cache"

/** The restaurant pages you own or manage. */
export function WorkspacesView() {
  const { workspaces, error, isLoading } = useMyWorkspaces()

  return (
    <section aria-labelledby="workspaces-title">
      <PageHeader title="Trang nhà hàng">
        <Button
          size="sm"
          shape="pill"
          nativeButton={false}
          render={<Link href={NEW_WORKSPACE_PATH} />}
        >
          <PlusIcon aria-hidden />
          Mở trang
        </Button>
      </PageHeader>
      <span id="workspaces-title" className="sr-only">
        Trang nhà hàng của bạn
      </span>
      <WorkspaceList workspaces={workspaces} error={error} isLoading={isLoading} />
    </section>
  )
}

function WorkspaceList({
  workspaces,
  error,
  isLoading,
}: {
  workspaces: Workspace[]
  error: unknown
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className="flex justify-center p-6">
        <Spinner aria-label="Đang tải" />
      </div>
    )
  }
  if (error) {
    return (
      <p role="alert" className="p-4 text-sm text-destructive sm:px-5">
        Không tải được danh sách trang. Thử tải lại nhé.
      </p>
    )
  }
  if (workspaces.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <StoreIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Bạn chưa quản lý trang nào</EmptyTitle>
          <EmptyDescription>
            Nhà hàng chay có thể mở một trang riêng để Đăng thực đơn, trả lời tin nhắn và hiện
            trên bản đồ nhà hàng. Trang được quản trị viên duyệt dựa trên giấy tờ bạn gửi.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button shape="pill" nativeButton={false} render={<Link href={NEW_WORKSPACE_PATH} />}>
            Mở trang nhà hàng
          </Button>
        </EmptyContent>
      </Empty>
    )
  }
  return (
    <ul className="divide-y divide-border">
      {workspaces.map((workspace) => (
        <li key={workspace.id}>
          <Link
            href={workspacePath(workspace.id)}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none sm:px-5"
          >
            <AuthorAvatar author={workspaceAuthor(workspace)} size="lg" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{workspace.name}</span>
              <span className="block truncate text-sm text-muted-foreground">
                @{workspace.username} · {MEMBER_ROLE_LABELS[workspace.role]}
              </span>
            </span>
            <WorkspaceStatusBadge status={workspace.status} />
          </Link>
        </li>
      ))}
    </ul>
  )
}
