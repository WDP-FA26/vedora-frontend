import type { BrowserContext, Page, Route } from "@playwright/test"
import { signInAs } from "../helpers/auth"
import { test, expect } from "../helpers/test"
import { users } from "../fixtures/data.mjs"
import type { ApiMedia, ApiPost } from "../../features/posts/schemas"
import type { PostDraft } from "../../features/post-drafts/schemas"

/** Stateful provider/API stand-in shared by all tabs of one isolated browser context. */
async function draftApi(context: BrowserContext) {
  await context.route(/^https:\/\//, (route) => route.abort())
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers":
      "authorization, content-type, content-range, x-unique-upload-id",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
  }
  const drafts = new Map<string, PostDraft>()
  const published = new Map<string, ApiPost>()
  const uploads: { route: Route; mediaId: string; bytes: Buffer }[] = []
  let publishCalls = 0
  let rejectPublish = false
  let losePublishResponse = false
  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, headers: cors, json: body })
  const fail = (route: Route, status: number) =>
    json(
      route,
      { statusCode: status, code: status === 409 ? "CONFLICT" : "NOT_FOUND", message: "fixture" },
      status
    )
  await context.route(/http:\/\/localhost:4010\/fixture-upload\/([^/?]+)$/, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors })
    const mediaId = new URL(route.request().url()).pathname.split("/").at(-1)!
    uploads.push({ route, mediaId, bytes: route.request().postDataBuffer()! })
    // Tests release these requests explicitly, so navigation/reload happens mid-upload.
  })
  await context.route(
    /http:\/\/localhost:4010\/api\/v1\/posts\/drafts(?:\/.*)?$/,
    async (route) => {
      const request = route.request()
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors })
      const [, id, operation, mediaId] = new URL(request.url()).pathname
        .split("/drafts")
        .at(-1)!
        .split("/")
      const method = request.method()
      const body = request.postDataJSON() ?? {}
      const payload = JSON.parse(
        Buffer.from(request.headers().authorization?.split(".")[1] ?? "", "base64url").toString()
      ) as { sub: string }
      if (payload.sub !== users.member.id)
        return !id && method === "GET" ? json(route, { items: [] }) : fail(route, 404)
      if (!id && method === "GET") return json(route, { items: [...drafts.values()] })
      if (!id && method === "POST") {
        if (published.has(body.id)) return fail(route, 404)
        if (!drafts.has(body.id))
          drafts.set(body.id, {
            id: body.id,
            kind: body.kind,
            body: "",
            title: "",
            description: "",
            version: 0,
            updatedAt: new Date().toISOString(),
            media: [],
          })
        return json(route, drafts.get(body.id), 201)
      }
      const draft = drafts.get(id)
      if (!draft) return fail(route, 404)
      if (!operation && method === "GET") return json(route, draft)
      if (!operation && method === "DELETE") {
        drafts.delete(id)
        return route.fulfill({ status: 204, headers: cors })
      }
      if (operation === "uploads") {
        let media = draft.media.find((item) => item.id === body.mediaId)
        if (!media) {
          media = {
            id: body.mediaId,
            type: "VIDEO",
            status: "WAITING_UPLOAD",
            failureReason: null,
            publicId: `fixture/${body.mediaId}`,
            playbackUrl: null,
            posterUrl: null,
            durationSec: null,
            aspectRatio: null,
            captions: [],
          }
          draft.media.push(media)
          draft.version++
        }
        return json(
          route,
          {
            draft,
            media,
            upload:
              media.status === "WAITING_UPLOAD"
                ? {
                    url: `http://localhost:4010/fixture-upload/${media.id}`,
                    fields: { public_id: media.publicId },
                    chunkSize: 1048576,
                  }
                : null,
          },
          201
        )
      }
      if (draft.version !== body.expectedVersion) return fail(route, 409)
      if (!operation && method === "PATCH") {
        Object.assign(draft, {
          body: body.body,
          title: body.title,
          description: body.description,
          version: draft.version + 1,
        })
        return json(route, draft)
      }
      if (operation === "media" && method === "DELETE") {
        draft.media = draft.media.filter((item) => item.id !== mediaId)
        draft.version++
        return json(route, draft)
      }
      if (operation === "publish") {
        publishCalls++
        if (rejectPublish) return fail(route, 400)
        const post: ApiPost = {
          id,
          type: "POST",
          body: draft.body,
          status: "PUBLISHED",
          createdAt: new Date().toISOString(),
          publishedAt: new Date().toISOString(),
          author: { ...users.member, isProfessional: false },
          media: draft.media,
          commentCount: 0,
          likeCount: 0,
          isLiked: false,
          repostCount: 0,
          isReposted: false,
          isBookmarked: false,
          viewCount: 0,
        }
        published.set(id, post)
        drafts.delete(id)
        if (losePublishResponse) {
          losePublishResponse = false
          return route.abort()
        }
        return json(route, post)
      }
      return fail(route, 404)
    }
  )
  await context.route(/http:\/\/localhost:4010\/api\/v1\/posts\/[^/?]+$/, async (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-1)!
    if (published.has(id)) return json(route, published.get(id))
    return route.fallback()
  })
  return {
    drafts,
    published,
    uploads,
    get publishCalls() {
      return publishCalls
    },
    rejectPublish(value: boolean) {
      rejectPublish = value
    },
    losePublishResponse() {
      losePublishResponse = true
    },
    async finish(index = uploads.length - 1) {
      const upload = uploads[index]
      for (const draft of drafts.values()) {
        const media = draft.media.find((item) => item.id === upload.mediaId)
        if (media)
          Object.assign(media, { status: "READY", durationSec: 10 }) satisfies Partial<ApiMedia>
      }
      await upload.route
        .fulfill({ status: 200, headers: cors, json: { done: true } })
        .catch(() => undefined)
    },
  }
}

async function composeVideo(page: Page) {
  await page.goto("/home")
  await page.getByRole("button", { name: "Đăng bài", exact: true }).first().click()
  await page.getByRole("button", { name: /Bài ngắn/ }).click()
  await page.getByRole("textbox", { name: "Nội dung bài viết" }).fill("Món chay lưu trong nháp")
  await page.getByLabel("Chọn video cho bài viết", { exact: true }).setInputFiles({
    name: "soup.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("fixture-video-bytes-retained-on-device"),
  })
}

test.beforeEach(async ({ context }) => {
  await signInAs(context, "member")
})

test("closing the composer and navigating keeps the request alive; completed upload stays private until publish", async ({
  page,
  context,
}) => {
  const api = await draftApi(context)
  await composeVideo(page)
  await expect.poll(() => api.uploads.length).toBe(1)
  await page.getByRole("button", { name: "Đóng dialog tạo bài viết", exact: true }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.getByRole("link", { name: "Xem bản nháp", exact: true }).click()
  await expect(page).toHaveURL(/\/home\/drafts$/)
  expect(api.publishCalls).toBe(0)
  await api.finish()
  const draft = [...api.drafts.values()][0]
  await page.getByRole("link", { name: "Mở nháp", exact: true }).click()
  await expect(page.getByRole("textbox", { name: "Nội dung bài viết" })).toHaveValue(
    "Món chay lưu trong nháp"
  )
  const submit = page.getByRole("button", { name: "Đăng", exact: true })
  await expect(submit).toBeEnabled({ timeout: 20000 })
  expect(api.publishCalls).toBe(0)
  await submit.click()
  await expect.poll(() => api.published.size).toBe(1)
  expect(api.published.get(draft.id)?.body).toBe("Món chay lưu trong nháp")
  expect(api.publishCalls).toBe(1)
})

for (const reopen of ["reload", "new tab"] as const) {
  test(`${reopen} restores the stored File and retries the same attachment without auto-publishing`, async ({
    page,
    context,
  }) => {
    const api = await draftApi(context)
    await composeVideo(page)
    await expect.poll(() => api.uploads.length).toBe(1)
    const draft = [...api.drafts.values()][0]
    const mediaId = draft.media[0].id
    let resumed = page
    if (reopen === "reload") await page.reload()
    else {
      await page.close()
      resumed = await context.newPage()
      await resumed.goto("/")
    }
    await expect.poll(() => api.uploads.length, { timeout: 20000 }).toBe(2)
    expect(api.uploads[1].mediaId).toBe(mediaId)
    expect(api.uploads[1].bytes.toString()).toContain("fixture-video-bytes-retained-on-device")
    expect(draft.media).toHaveLength(1)
    expect(api.publishCalls).toBe(0)
    await api.finish()
    await resumed.goto(`/home/drafts/${draft.id}`)
    await expect(resumed.getByRole("textbox", { name: "Nội dung bài viết" })).toHaveValue(
      "Món chay lưu trong nháp"
    )
    await expect(resumed.getByRole("button", { name: "Đăng", exact: true })).toBeEnabled({
      timeout: 20000,
    })
    expect(api.publishCalls).toBe(0)
  })
}

test("removing a draft while its upload is pending aborts it and never recreates it", async ({
  page,
  context,
}) => {
  const api = await draftApi(context)
  await composeVideo(page)
  await expect.poll(() => api.uploads.length).toBe(1)
  await page.getByRole("button", { name: "Đóng dialog tạo bài viết", exact: true }).click()
  await page.getByRole("link", { name: "Xem bản nháp", exact: true }).click()
  await page.getByRole("button", { name: /Xóa nháp/ }).click()
  await page.getByRole("button", { name: "Xác nhận xóa", exact: true }).click()
  await expect.poll(() => api.drafts.size, { timeout: 20000 }).toBe(0)
  await page.reload()
  await expect(page.getByText("Chưa có bản nháp.", { exact: false })).toBeVisible()
  expect(api.publishCalls).toBe(0)
})

test("a rejected publish releases the editor so the saved draft can be corrected", async ({
  page,
  context,
}) => {
  const api = await draftApi(context)
  await composeVideo(page)
  await expect.poll(() => api.uploads.length).toBe(1)
  await api.finish()
  const submit = page.getByRole("button", { name: "Đăng", exact: true })
  await expect(submit).toBeEnabled({ timeout: 20000 })
  api.rejectPublish(true)
  await submit.click()
  await expect.poll(() => api.publishCalls).toBe(1)
  await expect(submit).toBeEnabled()
  await page.getByRole("textbox", { name: "Nội dung bài viết" }).fill("Nội dung đã sửa")
  api.rejectPublish(false)
  await submit.click()
  await expect.poll(() => api.published.size).toBe(1)
  expect([...api.published.values()][0].body).toBe("Nội dung đã sửa")
})

test("edits made during upload survive closing the composer and are used by explicit publish", async ({
  page,
  context,
}) => {
  const api = await draftApi(context)
  await composeVideo(page)
  await expect.poll(() => api.uploads.length).toBe(1)
  await page
    .getByRole("textbox", { name: "Nội dung bài viết" })
    .fill("Nội dung sửa trong lúc tải video")
  await page.getByRole("button", { name: "Đóng dialog tạo bài viết", exact: true }).click()
  await api.finish()
  const draft = [...api.drafts.values()][0]
  await page.goto(`/home/drafts/${draft.id}`)
  await expect(page.getByRole("textbox", { name: "Nội dung bài viết" })).toHaveValue(
    "Nội dung sửa trong lúc tải video"
  )
  const submit = page.getByRole("button", { name: "Đăng", exact: true })
  await expect(submit).toBeEnabled({ timeout: 20000 })
  await submit.click()
  await expect.poll(() => api.published.size).toBe(1)
  expect([...api.published.values()][0].body).toBe("Nội dung sửa trong lúc tải video")
})

test("changing accounts keeps local files private and resumes them only for their owner", async ({
  page,
  context,
}) => {
  const api = await draftApi(context)
  await composeVideo(page)
  await expect.poll(() => api.uploads.length).toBe(1)
  await signInAs(context, "chef")
  await page.goto("/home/drafts")
  await expect(page.getByText("Chưa có bản nháp.", { exact: false })).toBeVisible()
  expect(api.uploads).toHaveLength(1)
  await signInAs(context, "member")
  await page.reload()
  await expect.poll(() => api.uploads.length, { timeout: 20000 }).toBe(2)
  expect(api.uploads[1].bytes.toString()).toContain("fixture-video-bytes-retained-on-device")
  expect(api.publishCalls).toBe(0)
})

test("unavailable device storage prevents uploads and shows that restoration is not yet safe", async ({
  page,
  context,
}) => {
  const api = await draftApi(context)
  await page.addInitScript(() => {
    const transaction = IDBDatabase.prototype.transaction
    IDBDatabase.prototype.transaction = function (...args: Parameters<typeof transaction>) {
      if (this.name === "vedora-post-drafts")
        throw new DOMException("fixture quota", "QuotaExceededError")
      return transaction.apply(this, args)
    }
  })
  await composeVideo(page)
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: /Không đủ bộ nhớ|Không lưu được nháp/ })
      .first()
  ).toBeVisible()
  expect(api.uploads).toHaveLength(0)
  expect(api.drafts.size).toBe(0)
  expect(api.publishCalls).toBe(0)
})

test("an uploaded video guide opens from server drafts on a different device and publishes on mobile", async ({
  page,
  context,
}) => {
  const api = await draftApi(context)
  const id = "3c8568a2-089e-46e4-8420-55f77917e685"
  api.drafts.set(id, {
    id,
    kind: "VIDEO",
    title: "Canh nấm chay",
    description: "Đun rau củ rồi thêm nấm.",
    body: "Canh nấm chay\n\nĐun rau củ rồi thêm nấm.",
    version: 2,
    updatedAt: new Date().toISOString(),
    media: [
      {
        id: "b30480c6-3aa0-4a02-8ea4-10b8e121050a",
        type: "VIDEO",
        status: "READY",
        publicId: "fixture/soup",
        failureReason: null,
        playbackUrl: null,
        posterUrl: null,
        durationSec: 10,
        aspectRatio: "16:9",
        captions: [],
      },
    ],
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/home/drafts/${id}`)
  await expect(page.getByRole("textbox", { name: "Tiêu đề video" })).toHaveValue("Canh nấm chay")
  await expect(page.getByRole("textbox", { name: "Mô tả và các bước hướng dẫn" })).toHaveValue(
    "Đun rau củ rồi thêm nấm."
  )
  expect(api.publishCalls).toBe(0)
  await page.getByRole("button", { name: "Đăng video", exact: true }).click()
  await expect.poll(() => api.published.size).toBe(1)
  expect(api.uploads).toHaveLength(0)
})

test("a lost publish response is reconciled after reload without a duplicate post", async ({
  page,
  context,
}) => {
  const api = await draftApi(context)
  await composeVideo(page)
  await expect.poll(() => api.uploads.length).toBe(1)
  await api.finish()
  const submit = page.getByRole("button", { name: "Đăng", exact: true })
  await expect(submit).toBeEnabled({ timeout: 20000 })
  api.losePublishResponse()
  await submit.click()
  await expect.poll(() => api.published.size).toBe(1)
  await page.goto("/home/drafts")
  await expect(page.getByText("Chưa có bản nháp.", { exact: false })).toBeVisible({
    timeout: 20000,
  })
  expect(api.publishCalls).toBe(1)
  expect(api.published.size).toBe(1)
})

test("a draft deleted in another session is not recreated by a restored local queue", async ({
  page,
  context,
}) => {
  const api = await draftApi(context)
  await composeVideo(page)
  await expect.poll(() => api.uploads.length).toBe(1)
  api.drafts.clear()
  await page.goto("/home/drafts")
  await expect(
    page.getByRole("alert").filter({ hasText: "Nháp không còn trên máy chủ" })
  ).toBeVisible({ timeout: 20000 })
  expect(api.drafts.size).toBe(0)
  expect(api.uploads).toHaveLength(1)
  expect(api.publishCalls).toBe(0)
})
