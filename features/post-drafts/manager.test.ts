import { afterEach, describe, expect, it, vi } from "vitest"
import type { ApiPost } from "@/features/posts/schemas"
import { ApiError } from "@/features/shared/lib/api-client"
import type { PostDraft } from "./schemas"

const storage = vi.hoisted(() => ({
  readLocalDrafts: vi.fn(),
  readDraftFile: vi.fn(),
  writeLocalDraft: vi.fn(),
  forgetLocalDraft: vi.fn(),
}))

const api = vi.hoisted(() => ({
  listPostDrafts: vi.fn(),
  getPostDraft: vi.fn(),
  createPostDraft: vi.fn(),
  savePostDraft: vi.fn(),
  requestDraftUpload: vi.fn(),
  removeDraftMedia: vi.fn(),
  publishPostDraft: vi.fn(),
  deletePostDraft: vi.fn(),
}))

vi.mock("./storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./storage")>()
  return {
    ...actual,
    readLocalDrafts: storage.readLocalDrafts,
    readDraftFile: storage.readDraftFile,
    writeLocalDraft: storage.writeLocalDraft,
    forgetLocalDraft: storage.forgetLocalDraft,
  }
})

vi.mock("./api", () => api)

import { PostDraftManager } from "./manager"

const DRAFT_ID = "11111111-1111-4111-8111-111111111111"
const OWNER_ID = "user-1"

const remoteDraft: PostDraft = {
  id: DRAFT_ID,
  kind: "POST",
  body: "Món chay mới",
  title: "",
  description: "",
  version: 1,
  updatedAt: "2026-11-27T00:00:00.000Z",
  media: [],
}

const publishedPost: ApiPost = {
  id: DRAFT_ID,
  type: "POST",
  status: "PROCESSING",
  body: "Món chay mới",
  publishedAt: null,
  createdAt: "2026-11-27T00:00:00.000Z",
  author: {
    id: OWNER_ID,
    username: "chef",
    fullName: "Chef",
    avatarUrl: null,
    isProfessional: false,
  },
  media: [],
  commentCount: 0,
  likeCount: 0,
  isLiked: false,
  repostCount: 0,
  isReposted: false,
  isBookmarked: false,
  viewCount: 0,
}

afterEach(() => {
  vi.clearAllMocks()
})

describe("PostDraftManager.publish", () => {
  it("resolves and does not recreate the draft when a listener calls ensure after forget", async () => {
    storage.readLocalDrafts.mockResolvedValue([
      {
        key: `${OWNER_ID}:${DRAFT_ID}`,
        id: DRAFT_ID,
        ownerId: OWNER_ID,
        kind: "POST",
        body: "Món chay mới",
        title: "",
        description: "",
        version: 1,
        synced: JSON.stringify(["Món chay mới", "", ""]),
        revision: 1,
        updatedAt: Date.now(),
        files: [],
        removed: [],
      },
    ])
    storage.writeLocalDraft.mockResolvedValue(undefined)
    storage.forgetLocalDraft.mockResolvedValue(undefined)
    api.listPostDrafts.mockResolvedValue({ items: [] })
    api.getPostDraft.mockResolvedValue(remoteDraft)
    api.publishPostDraft.mockResolvedValue(publishedPost)

    const manager = new PostDraftManager(OWNER_ID)
    await manager.start("token")

    const unsubscribe = manager.subscribe(() => {
      if (!manager.find(DRAFT_ID)) {
        void manager.ensure(DRAFT_ID, "POST")
      }
    })

    try {
      const result = await manager.publish(DRAFT_ID)
      expect(result).toEqual(publishedPost)
      expect(manager.find(DRAFT_ID)).toBeUndefined()
    } finally {
      unsubscribe()
      manager.stop()
    }
  })

  it("rethrows ApiError from publishPostDraft so composers show specific error messages", async () => {
    storage.readLocalDrafts.mockResolvedValue([
      {
        key: `${OWNER_ID}:${DRAFT_ID}`,
        id: DRAFT_ID,
        ownerId: OWNER_ID,
        kind: "POST",
        body: "Món chay mới",
        title: "",
        description: "",
        version: 1,
        synced: JSON.stringify(["Món chay mới", "", ""]),
        revision: 1,
        updatedAt: Date.now(),
        files: [],
        removed: [],
      },
    ])
    storage.writeLocalDraft.mockResolvedValue(undefined)
    api.listPostDrafts.mockResolvedValue({ items: [] })
    api.getPostDraft.mockResolvedValue(remoteDraft)
    api.publishPostDraft.mockRejectedValue(
      new ApiError(400, "MEDIA_UNAVAILABLE", "Video unavailable", undefined)
    )

    const manager = new PostDraftManager(OWNER_ID)
    await manager.start("token")

    try {
      await expect(manager.publish(DRAFT_ID)).rejects.toMatchObject({
        name: "ApiError",
        status: 400,
        code: "MEDIA_UNAVAILABLE",
      })
      expect(manager.find(DRAFT_ID)?.publishing).toBe(false)
    } finally {
      manager.stop()
    }
  })
})
