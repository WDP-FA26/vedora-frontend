"use client"

import { useState } from "react"
import {
  CalendarDaysIcon,
  CheckIcon,
  ClapperboardIcon,
  EllipsisIcon,
  EyeOffIcon,
  PencilIcon,
  ShieldAlertIcon,
  Trash2Icon,
} from "lucide-react"

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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

type PreviewStatus = "draft" | "pending" | "approved" | "revision" | "hidden"
type PreviewVideo = {
  id: number
  title: string
  description: string
  status: PreviewStatus
  date: string
  reason?: string
}

const STATUS: Record<PreviewStatus, { label: string; icon: typeof ClapperboardIcon; tone: string }> = {
  draft: { label: "Bản nháp", icon: PencilIcon, tone: "bg-secondary text-primary" },
  pending: { label: "Chờ duyệt", icon: CalendarDaysIcon, tone: "bg-brand-cream/60 text-amber-900" },
  approved: { label: "Đã duyệt", icon: CheckIcon, tone: "bg-primary/10 text-primary" },
  revision: { label: "Cần chỉnh sửa", icon: ShieldAlertIcon, tone: "bg-brand-cream/60 text-amber-900" },
  hidden: { label: "Bị ẩn", icon: EyeOffIcon, tone: "bg-muted text-muted-foreground" },
}

const INITIAL_VIDEOS: PreviewVideo[] = [
  { id: 1, title: "Bún riêu chay tại nhà", description: "Tên món: Bún riêu chay\nNguyên liệu: Đậu hũ, cà chua\nCác bước thực hiện: Chuẩn bị và nấu nước dùng.", status: "approved", date: "09/10/2026" },
  { id: 2, title: "Mẹo sơ chế nấm", description: "Mẹo muốn chia sẻ: Giữ nấm ráo trước khi xào.", status: "pending", date: "08/10/2026" },
  { id: 3, title: "Đậu hũ sốt nấm", description: "Tên món: Đậu hũ sốt nấm\nCách làm: Viết hướng dẫn tại đây.", status: "draft", date: "07/10/2026" },
  { id: 4, title: "Cơm chiên rau củ", description: "Giới thiệu: Một bữa cơm đơn giản.", status: "revision", date: "06/10/2026", reason: "Cần bổ sung các bước thực hiện rõ ràng hơn." },
  { id: 5, title: "Canh rau mùa mưa", description: "Câu chuyện món: Bữa cơm gia đình.", status: "hidden", date: "05/10/2026", reason: "Video cần được kiểm tra lại trước khi hiển thị." },
]

/** A separate visual sandbox. It never imports auth, the uploader, or post APIs. */
export function VideoManagementPreview() {
  const [videos, setVideos] = useState(INITIAL_VIDEOS)
  const [filter, setFilter] = useState<PreviewStatus | "all">("all")
  const [editing, setEditing] = useState<PreviewVideo | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [deleting, setDeleting] = useState<PreviewVideo | null>(null)
  const [notice, setNotice] = useState("")
  const visible = filter === "all" ? videos : videos.filter((video) => video.status === filter)

  function openEdit(video: PreviewVideo) {
    setEditing(video)
    setEditTitle(video.title)
    setEditDescription(video.description)
  }

  function saveEdit() {
    if (!editing || !editTitle.trim()) return
    setVideos((current) => current.map((video) => video.id === editing.id ? { ...video, title: editTitle.trim(), description: editDescription } : video))
    setEditing(null)
    setNotice("Đã cập nhật trong bản xem thử.")
  }

  function deleteVideo() {
    if (!deleting) return
    setVideos((current) => current.filter((video) => video.id !== deleting.id))
    setDeleting(null)
    setNotice("Đã xóa khỏi bản xem thử.")
  }

  return <section className="min-h-dvh bg-background pb-10">
    <header className="border-b border-border bg-card px-4 py-5 sm:px-6">
      <Badge variant="secondary">Bản xem thử</Badge>
      <h1 className="mt-3 font-heading text-2xl font-bold">Quản lý video của tôi</h1>
      <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">Xem giao diện các trạng thái, chỉnh sửa và xóa video. Nội dung ở trang này chỉ nằm trong bộ nhớ của trình duyệt.</p>
    </header>

    <div className="px-4 pt-5 sm:px-6">
      <div role="group" aria-label="Lọc video theo trạng thái" className="flex gap-2 overflow-x-auto pb-3">
        {([{ key: "all", label: "Tất cả" }, ...Object.entries(STATUS).map(([key, value]) => ({ key, label: value.label }))] as { key: PreviewStatus | "all"; label: string }[]).map(({ key, label }) => (
          <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)} className={cn("shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-ring", filter === key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary/35")}>{label}</button>
        ))}
      </div>
      {notice && <p role="status" className="mb-3 rounded-xl bg-secondary px-3 py-2 text-xs text-primary">{notice}</p>}
      {visible.length === 0 ? <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-6 text-center"><ClapperboardIcon aria-hidden className="size-8 text-primary" /><p className="mt-2 text-sm font-semibold">Chưa có video ở trạng thái này</p></div> : (
        <div className="grid gap-4 sm:grid-cols-2">{visible.map((video, index) => {
          const state = STATUS[video.status]
          const Icon = state.icon
          return <article key={video.id} className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className={cn("flex aspect-video items-center justify-center", index % 2 ? "bg-gradient-to-br from-brand-cream/45 to-secondary" : "bg-gradient-to-br from-secondary to-primary/10")}><ClapperboardIcon aria-hidden className="size-12 text-primary/70" /></div>
            <div className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="line-clamp-2 font-heading text-base font-bold">{video.title}</h2><p className="mt-1 text-xs text-muted-foreground">{video.status === "approved" ? "Ngày đăng" : "Ngày cập nhật"}: {video.date}</p></div><DropdownMenu><DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label={`Tùy chọn cho ${video.title}`} />}><EllipsisIcon aria-hidden /></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => openEdit(video)}><PencilIcon aria-hidden /> Chỉnh sửa</DropdownMenuItem><DropdownMenuItem onClick={() => setDeleting(video)}><Trash2Icon aria-hidden /> Xóa bài viết</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
              <div className="flex flex-wrap items-center gap-2"><span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", state.tone)}><Icon aria-hidden className="size-3.5" /> {state.label}</span><span className="text-xs text-muted-foreground">Công khai</span></div>
              {video.reason && <p className="rounded-xl bg-secondary/50 px-3 py-2 text-xs leading-5 text-muted-foreground">{video.reason}</p>}
            </div>
          </article>
        })}</div>
      )}
    </div>

    <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null) }}>
      <DialogContent className="max-h-[90dvh] max-w-[min(44rem,calc(100vw-2rem))] overflow-y-auto">
        <DialogTitle>Chỉnh sửa video</DialogTitle>
        <DialogDescription>Thay đổi ở bản xem thử này được giữ trong trình duyệt cho tới khi tải lại trang.</DialogDescription>
        <div className="space-y-4">
          <label className="block text-sm font-semibold">Tiêu đề video<input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
          <label className="block text-sm font-semibold">Mô tả và hướng dẫn<textarea value={editDescription} onChange={(event) => setEditDescription(event.target.value)} rows={6} className="mt-1.5 min-h-32 w-full resize-y rounded-xl border border-input bg-background p-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
          <p className="text-xs text-muted-foreground">Video và ảnh bìa cũ được giữ trong bản xem thử. Chức năng thay video cần API cập nhật bài.</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEditing(null)}>Hủy</Button><Button type="button" disabled={!editTitle.trim()} onClick={saveEdit}>Lưu bản xem thử</Button></div>
      </DialogContent>
    </Dialog>

    <AlertDialog open={deleting !== null} onOpenChange={(open) => { if (!open) setDeleting(null) }}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Xóa bài viết này?</AlertDialogTitle><AlertDialogDescription>{deleting?.title} sẽ được gỡ khỏi danh sách bản xem thử.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={deleteVideo}>Xóa bài viết</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>
}
