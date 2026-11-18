import { ApiError } from "@/features/shared/lib/api-client"
import { uploadToCloudinary, type UploadTask } from "@/features/posts/lib/cloudinary-upload"
import { fetchPost } from "@/features/posts/lib/posts-api"
import { postKey } from "@/features/posts/posts-cache"
import { MAX_POST_MEDIA, MAX_VIDEO_DURATION_SEC, type ApiPost } from "@/features/posts/schemas"
import * as api from "./api"
import type { DraftKind, PostDraft } from "./schemas"
import { videoDuration } from "./video-file"
import {
  fingerprint,
  forgetLocalDraft,
  localDraftKey,
  readDraftFile,
  readLocalDrafts,
  writeLocalDraft,
  type DraftFile,
  type LocalPostDraft,
} from "./storage"

export type Snapshot = {
  drafts: LocalPostDraft[]
  loaded: boolean
  storageError: string | null
  saving: number
  progress: Record<string, number>
  previews: Record<string, string>
  notice: string | null
  published: ApiPost | null
}
export const EMPTY: Snapshot = {
  drafts: [],
  loaded: false,
  storageError: null,
  saving: 0,
  progress: {},
  previews: {},
  notice: null,
  published: null,
}

function errorText(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 404)
      return "Nháp không còn trên máy chủ. Bạn có thể xóa bản nháp trên thiết bị này."
    if (error.status === 401)
      return "Phiên đăng nhập đã hết hạn. Đăng nhập lại để tiếp tục; nháp trên máy vẫn được giữ."
    if (error.status === 409)
      return "Nháp đã đổi ở phiên khác. Dùng bản trên máy chủ trước khi sửa tiếp."
    if (error.code === "UPLOAD_LIMIT_REACHED")
      return "Đã đạt giới hạn nháp. Xóa hoặc đăng bớt nháp để tiếp tục."
    if (error.code === "MEDIA_UNAVAILABLE")
      return "Video chưa tải xong hoặc xử lý thất bại. Hãy thử tải lại hoặc chọn video khác."
  }
  return "Chưa đồng bộ được nháp. Nội dung và tệp đã lưu trên máy vẫn được giữ để thử lại."
}

/** Owns files and requests independently of editors/routes. IndexedDB is the durable source on this device. */
export class PostDraftManager {
  private snapshot: Snapshot = EMPTY
  private listeners = new Set<() => void>()
  private token: string | undefined
  private active = false
  private timer: ReturnType<typeof setTimeout> | undefined
  private writes: Promise<void> = Promise.resolve()
  private jobs = new Map<string, Promise<void>>()
  private tasks = new Map<string, UploadTask>()
  private files = new Map<string, File>()
  private started = false
  constructor(readonly ownerId: string) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  getSnapshot = () => this.snapshot
  getServerSnapshot = () => EMPTY
  private emit(patch: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    this.listeners.forEach((listener) => listener())
  }
  find = (id: string) => this.snapshot.drafts.find((draft) => draft.id === id)

  async start(token: string) {
    this.active = true
    this.token = token
    if (!this.started) {
      this.started = true
      try {
        const drafts = await readLocalDrafts(this.ownerId)
        if (!this.active) return
        this.emit({
          drafts: drafts.map((draft) => ({
            ...draft,
            error: draft.conflict ? draft.error : undefined,
            files: draft.files.map((file) => ({
              ...file,
              state:
                file.state === "uploading" ||
                (file.state === "failed" && !file.media?.failureReason)
                  ? "queued"
                  : file.state,
            })),
          })),
          loaded: true,
        })
        for (const draft of drafts)
          for (const item of draft.files) {
            const file = await readDraftFile(draft, item.key)
            if (file && this.active) this.cacheFile(item.key, file)
          }
      } catch {
        this.emit({
          loaded: true,
          storageError:
            "Không lưu được nháp trên thiết bị. Hãy cho phép bộ nhớ trình duyệt hoặc giải phóng dung lượng trước khi tải video.",
        })
        return
      }
    }
    void this.refreshRemote()
    this.kick()
  }

  setToken(token: string | undefined) {
    this.token = token
    if (token && this.active) this.kick()
  }
  stop() {
    this.active = false
    clearTimeout(this.timer)
    for (const task of this.tasks.values()) task.abort()
    this.tasks.clear()
    for (const url of Object.values(this.snapshot.previews)) URL.revokeObjectURL(url)
    this.files.clear()
    this.emit({ previews: {} })
  }

  private cacheFile(key: string, file: File) {
    this.files.set(key, file)
    if (!this.snapshot.previews[key])
      this.emit({ previews: { ...this.snapshot.previews, [key]: URL.createObjectURL(file) } })
  }

  private async store(
    draft: LocalPostDraft,
    added: { key: string; file: File }[] = [],
    removedKeys: string[] = []
  ) {
    if (!this.active) return
    this.emit({
      drafts: [...this.snapshot.drafts.filter((item) => item.id !== draft.id), draft],
      saving: this.snapshot.saving + 1,
    })
    const queued = this.writes
      .catch(() => undefined)
      .then(() => writeLocalDraft(draft, added, removedKeys))
    this.writes = queued
    try {
      await queued
      for (const item of added) this.cacheFile(item.key, item.file)
      for (const key of removedKeys) {
        const url = this.snapshot.previews[key]
        if (url) URL.revokeObjectURL(url)
        this.files.delete(key)
      }
      const previews = { ...this.snapshot.previews }
      for (const key of removedKeys) delete previews[key]
      this.emit({ storageError: null, previews })
    } catch {
      this.emit({
        storageError:
          "Không đủ bộ nhớ hoặc không lưu được tệp trên máy. Nháp chưa an toàn để khôi phục; hãy giữ trang mở và giải phóng bộ nhớ.",
      })
      throw new Error("Local draft could not be persisted")
    } finally {
      this.emit({ saving: Math.max(0, this.snapshot.saving - 1) })
      this.kick()
    }
  }

  ensure = async (id: string, kind: DraftKind) => {
    if (!this.snapshot.loaded || this.find(id)) return
    await this.store({
      key: localDraftKey(this.ownerId, id),
      id,
      ownerId: this.ownerId,
      kind,
      body: "",
      title: "",
      description: "",
      version: null,
      synced: JSON.stringify(["", "", ""]),
      revision: 0,
      updatedAt: Date.now(),
      files: [],
      removed: [],
    })
  }

  update = (id: string, values: { body?: string; title?: string; description?: string }) => {
    const draft = this.find(id)
    if (!draft || draft.deleted || draft.publishing) return
    const next = {
      ...draft,
      ...values,
      updatedAt: Date.now(),
      revision: draft.revision + 1,
      error: undefined,
    }
    if (next.kind === "VIDEO" && values.body === undefined)
      next.body = [next.title.trim(), next.description.trim()].filter(Boolean).join("\n\n")
    void this.store(next).catch(() => undefined)
  }

  add = async (id: string, files: File[]) => {
    const draft = this.find(id)
    if (!draft || draft.publishing) return
    const chosen = files.filter((file) => file.type.startsWith("video/") && file.size > 0)
    if (!chosen.length) {
      await this.store({ ...draft, error: "Hãy chọn tệp video." })
      return
    }
    const max = draft.kind === "VIDEO" ? 1 : MAX_POST_MEDIA
    const replacing = draft.kind === "VIDEO" ? draft.files : []
    const keep = draft.kind === "VIDEO" ? [] : draft.files
    const added = chosen
      .slice(0, Math.max(0, max - keep.length))
      .map((file) => ({ key: crypto.randomUUID(), file }))
    if (!added.length) {
      await this.store({ ...draft, error: `Tối đa ${max} video trong nháp.` })
      return
    }
    await this.store(
      {
        ...draft,
        updatedAt: Date.now(),
        revision: draft.revision + 1,
        error: undefined,
        removed: [...draft.removed, ...replacing.map((item) => item.mediaId)],
        files: [
          ...keep,
          ...added.map(({ key, file }): DraftFile => ({
            key,
            mediaId: key,
            name: file.name,
            type: file.type,
            size: file.size,
            lastModified: file.lastModified,
            state: "queued",
            media: null,
          })),
        ],
      },
      added,
      replacing.map((item) => item.key)
    )
    for (const item of replacing) this.tasks.get(item.key)?.abort()
  }

  removeFile = (id: string, key: string) => {
    const draft = this.find(id),
      file = draft?.files.find((item) => item.key === key)
    if (!draft || !file || draft.publishing) return
    this.tasks.get(key)?.abort()
    void this.store(
      {
        ...draft,
        files: draft.files.filter((item) => item.key !== key),
        removed: [...draft.removed, file.mediaId],
        revision: draft.revision + 1,
        updatedAt: Date.now(),
        error: undefined,
      },
      [],
      [key]
    ).catch(() => undefined)
  }

  retry = (id: string, key?: string) => {
    const draft = this.find(id)
    if (!draft) return
    void this.store({
      ...draft,
      error: undefined,
      files: draft.files.map((file) =>
        (!key || file.key === key) && file.state === "failed"
          ? { ...file, state: "queued", error: undefined }
          : file
      ),
    }).catch(() => undefined)
  }

  remove = async (id: string) => {
    const draft = this.find(id)
    if (!draft) return
    for (const file of draft.files) this.tasks.get(file.key)?.abort()
    await this.store({ ...draft, deleted: true, error: undefined })
    await this.run(id)
  }

  private candidate(draft: LocalPostDraft) {
    if (draft.conflict) return false
    if (
      draft.kind === "POST" &&
      draft.version === null &&
      draft.files.length === 0 &&
      !draft.deleted &&
      !draft.publishing
    )
      return false
    return (
      draft.deleted ||
      draft.publishing ||
      (Boolean(draft.version !== null || draft.body || draft.files.length) &&
        (draft.version === null ||
          draft.synced !== fingerprint(draft) ||
          draft.removed.length ||
          draft.files.some((file) => ["queued", "uploading", "uploaded"].includes(file.state))))
    )
  }

  private kick() {
    clearTimeout(this.timer)
    if (!this.active || !this.token || !this.snapshot.loaded || this.snapshot.storageError) return
    this.timer = setTimeout(() => {
      if (!this.active) return
      // One uploading draft at a time; small metadata/status requests use the same durable queue.
      const draft = this.snapshot.drafts.find(
        (item) => this.candidate(item) && !this.jobs.has(item.id)
      )
      if (draft && this.jobs.size === 0) void this.run(draft.id).catch(() => undefined)
      this.kickLater()
    }, 300)
  }
  private kickLater() {
    clearTimeout(this.timer)
    if (this.active) this.timer = setTimeout(() => this.kick(), 5000)
  }

  private run(id: string): Promise<void> {
    const existing = this.jobs.get(id)
    if (existing) return existing
    const job = (async () => {
      await this.writes
      if (!this.active || !this.token || this.snapshot.storageError) return
      const execute = async () => {
        if (this.active) await this.process(id)
      }
      try {
        if (navigator.locks)
          await navigator.locks.request(
            `vedora-post-draft:${this.ownerId}:${id}`,
            { ifAvailable: true },
            async (lock) => {
              if (lock) await execute()
            }
          )
        else await execute()
      } catch (error) {
        const draft = this.find(id)
        if (draft && this.active)
          await this.store({
            ...draft,
            error: errorText(error),
            conflict: error instanceof ApiError && [404, 409].includes(error.status),
            publishing: error instanceof ApiError && error.status < 500 ? false : draft.publishing,
          }).catch(() => undefined)
      }
    })().finally(() => {
      this.jobs.delete(id)
      this.kickLater()
    })
    this.jobs.set(id, job)
    return job
  }

  private mergeRemote(local: LocalPostDraft, remote: PostDraft, ownWrite = false) {
    const remoteFingerprint = fingerprint(remote)
    if (
      !ownWrite &&
      remoteFingerprint !== local.synced &&
      remoteFingerprint !== fingerprint(local) &&
      local.version !== remote.version
    )
      throw new ApiError(409, "CONFLICT", "Draft changed", undefined)
    return {
      ...local,
      version: remote.version,
      synced: remoteFingerprint,
      error: undefined,
      files: local.files.map((file) => {
        const media = remote.media.find((item) => item.id === file.mediaId)
        if (!media) return file
        return {
          ...file,
          media,
          state:
            media.status === "READY"
              ? ("ready" as const)
              : media.status === "PROCESSING"
                ? ("uploaded" as const)
                : media.status === "FAILED"
                  ? media.failureReason === "UPLOAD_TIMED_OUT"
                    ? ("queued" as const)
                    : ("failed" as const)
                  : file.state,
        }
      }),
    }
  }

  private async process(id: string) {
    const token = this.token!
    let draft = this.find(id)
    if (!draft) return
    if (draft.deleted) {
      try {
        await api.deletePostDraft(token, id)
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 404)) throw error
      }
      await this.forget(id)
      return
    }
    let remote: PostDraft
    try {
      remote =
        draft.version === null
          ? await api.createPostDraft(token, id, draft.kind)
          : await api.getPostDraft(token, id)
    } catch (error) {
      if (draft.publishing && error instanceof ApiError && error.status === 404) {
        const post = await fetchPost([postKey(id), token])
        if (post.author.id === this.ownerId && post.status !== "DRAFT") {
          await this.published(id, post)
          return
        }
      }
      throw error
    }
    if (!this.active) return
    draft = this.find(id)!
    await this.store(this.mergeRemote(draft, remote))
    for (const mediaId of [...draft.removed]) {
      remote = await api.removeDraftMedia(token, id, mediaId, this.find(id)!.version!)
      const current = this.find(id)!
      await this.store({
        ...this.mergeRemote(current, remote),
        removed: current.removed.filter((item) => item !== mediaId),
      })
    }
    draft = this.find(id)!
    if (draft.synced !== fingerprint(draft)) {
      remote = await api.savePostDraft(token, id, draft.version!, {
        body: draft.body,
        title: draft.title,
        description: draft.description,
      })
      await this.store(this.mergeRemote(this.find(id)!, remote, true))
    }
    for (const original of [...this.find(id)!.files]) {
      if (!this.active || this.find(id)?.deleted) return
      let item = this.find(id)?.files.find((file) => file.key === original.key)
      if (!item || item.state === "ready" || item.state === "failed") continue
      if (item.state === "uploaded") {
        remote = await api.getPostDraft(token, id)
        await this.store(this.mergeRemote(this.find(id)!, remote))
        continue
      }
      let file = this.files.get(item.key)
      file ??= await readDraftFile(this.find(id)!, item.key)
      if (!file) {
        await this.setFile(id, item.key, {
          state: "failed",
          error: "Tệp tải dở nằm trên thiết bị khác hoặc đã bị xóa. Hãy chọn lại video.",
        })
        continue
      }
      this.cacheFile(item.key, file)
      const duration = await videoDuration(file)
      if (!this.active || this.find(id)?.deleted) return
      if (duration !== null && duration > MAX_VIDEO_DURATION_SEC) {
        await this.setFile(id, item.key, {
          state: "failed",
          error: `Video tối đa ${MAX_VIDEO_DURATION_SEC / 60} phút. Hãy chọn video ngắn hơn.`,
        })
        continue
      }
      if (item.media?.status === "FAILED") {
        if (item.media.failureReason !== "UPLOAD_TIMED_OUT") {
          await this.setFile(id, item.key, {
            state: "failed",
            error: "Video xử lý thất bại. Hãy chọn video khác.",
          })
          continue
        }
        remote = await api.removeDraftMedia(token, id, item.mediaId, this.find(id)!.version!)
        await this.store(this.mergeRemote(this.find(id)!, remote))
        await this.setFile(id, item.key, { mediaId: crypto.randomUUID(), media: null })
        item = this.find(id)!.files.find((current) => current.key === item!.key)!
      }
      const target = await api.requestDraftUpload(token, id, item.mediaId)
      if (
        !this.active ||
        this.find(id)?.deleted ||
        !this.find(id)?.files.some((current) => current.key === item!.key)
      )
        return
      await this.store(this.mergeRemote(this.find(id)!, target.draft))
      if (!target.upload) {
        await this.setFile(id, item.key, {
          media: target.media,
          state: target.media.status === "READY" ? "ready" : "uploaded",
        })
        continue
      }
      await this.setFile(id, item.key, {
        state: "uploading",
        media: target.media,
        error: undefined,
      })
      const task = uploadToCloudinary(target.upload, file, (percent) => {
        if (this.active)
          this.emit({ progress: { ...this.snapshot.progress, [original.key]: percent } })
      })
      this.tasks.set(item.key, task)
      try {
        await task.done
        if (this.active) await this.setFile(id, item.key, { state: "uploaded", error: undefined })
      } catch {
        if (this.active && this.find(id)?.files.some((current) => current.key === original.key))
          await this.setFile(id, item.key, {
            state: "failed",
            error: "Tải video thất bại. Tệp trên máy vẫn còn để thử lại.",
          })
        return
      } finally {
        this.tasks.delete(item.key)
      }
    }
    draft = this.find(id)
    if (this.active && draft?.publishing && !draft.deleted) {
      if (draft.files.some((file) => file.state !== "ready" && file.state !== "uploaded"))
        throw new Error("Videos are not uploaded")
      if (draft.synced !== fingerprint(draft)) {
        remote = await api.savePostDraft(token, id, draft.version!, {
          body: draft.body,
          title: draft.title,
          description: draft.description,
        })
        await this.store(this.mergeRemote(this.find(id)!, remote, true))
        draft = this.find(id)!
      }
      remote = await api.getPostDraft(token, id)
      await this.store(this.mergeRemote(draft, remote))
      const post = await api.publishPostDraft(token, id, remote.version)
      await this.published(id, post)
    }
  }

  private setFile(id: string, key: string, patch: Partial<DraftFile>) {
    const draft = this.find(id)
    return draft
      ? this.store({
          ...draft,
          files: draft.files.map((file) => (file.key === key ? { ...file, ...patch } : file)),
        })
      : Promise.resolve()
  }

  publish = async (id: string): Promise<ApiPost> => {
    const draft = this.find(id)
    if (!draft || draft.conflict) throw new Error("Draft is unavailable")
    await this.store({ ...draft, publishing: true, error: undefined })
    await this.jobs.get(id)
    if (this.find(id)) await this.run(id)
    const post = this.snapshot.published
    if (!this.find(id) && post?.id === id) return post
    throw new Error(this.find(id)?.error ?? "Chưa đăng được. Nháp vẫn được giữ.")
  }

  private async published(id: string, post: ApiPost) {
    await this.forget(id)
    this.emit({
      published: post,
      notice:
        post.status === "PUBLISHED"
          ? "Bài viết đã đăng."
          : "Đã gửi bài viết để xử lý và kiểm duyệt.",
    })
  }

  private async forget(id: string) {
    const draft = this.find(id)
    if (!draft) return
    await this.writes
    await forgetLocalDraft(draft)
    for (const file of draft.files) {
      const url = this.snapshot.previews[file.key]
      if (url) URL.revokeObjectURL(url)
      this.files.delete(file.key)
    }
    const previews = { ...this.snapshot.previews }
    const progress = { ...this.snapshot.progress }
    for (const file of draft.files) {
      delete previews[file.key]
      delete progress[file.key]
    }
    this.emit({ drafts: this.snapshot.drafts.filter((item) => item.id !== id), previews, progress })
  }

  dismissNotice = () => this.emit({ notice: null })

  reload = async (id: string) => {
    if (!this.token) return
    const remote = await api.getPostDraft(this.token, id)
    const local = this.find(id)
    if (!local) return
    await this.store({
      ...local,
      body: remote.body,
      title: remote.title,
      description: remote.description,
      synced: fingerprint(remote),
      version: remote.version,
      conflict: false,
      error: undefined,
      publishing: false,
    })
  }

  refreshRemote = async () => {
    if (!this.token || !this.active || !this.snapshot.loaded) return
    try {
      const { items } = await api.listPostDrafts(this.token)
      for (const remote of items) {
        if (!this.active || this.find(remote.id)) continue
        await this.store({
          key: localDraftKey(this.ownerId, remote.id),
          id: remote.id,
          ownerId: this.ownerId,
          kind: remote.kind,
          body: remote.body,
          title: remote.title,
          description: remote.description,
          version: remote.version,
          synced: fingerprint(remote),
          revision: 0,
          updatedAt: new Date(remote.updatedAt).getTime(),
          removed: [],
          files: remote.media.map((media) => ({
            key: media.id,
            mediaId: media.id,
            name: `Video ${media.id.slice(0, 8)}`,
            type: "video/mp4",
            size: 0,
            lastModified: 0,
            state:
              media.status === "READY"
                ? "ready"
                : media.status === "PROCESSING"
                  ? "uploaded"
                  : "failed",
            media,
            error:
              media.status === "WAITING_UPLOAD"
                ? "Tệp tải dở nằm trên thiết bị ban đầu. Mở lại thiết bị đó hoặc chọn lại tệp."
                : undefined,
          })),
        })
      }
    } catch {
      /* Local files and text remain usable offline; individual jobs show sync failures. */
    }
  }
}
