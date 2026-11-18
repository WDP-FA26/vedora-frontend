import type { Page } from "@playwright/test"
import { mockApi } from "../helpers/api"
import { test, expect } from "../helpers/test"

const answer = "Câu trả lời thử nghiệm dành cho khách."
const question = "Ăn chay bổ sung đạm thế nào?"
let replyId = 0

function replyStream(text: string) {
  return (
    [
    { type: "start", messageId: `assistant-fixture-${++replyId}` },
      { type: "text-start", id: "text-fixture" },
      { type: "text-delta", id: "text-fixture", delta: text },
      { type: "text-end", id: "text-fixture" },
      { type: "finish", finishReason: "stop" },
    ]
      .map((event) => `data: ${JSON.stringify(event)}\n\n`)
      .join("") + "data: [DONE]\n\n"
  )
}

async function setup(page: Page, text = answer) {
  await mockApi(
    page,
    "/nutrition-chat/guest-session",
    { body: { token: "guest-chat-fixture", expiresIn: 3600, remaining: 5 } },
    "POST"
  )
  const requests: { messages: { role: string; text: string }[] }[] = []
  await page.route("**/api/v1/nutrition-chat", async (route) => {
    if (route.request().method() === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "authorization,content-type",
        },
      })
    requests.push(route.request().postDataJSON())
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "x-vercel-ai-ui-message-stream": "v1",
        "access-control-allow-origin": "*",
      },
      body: replyStream(text),
    })
  })
  return requests
}

async function openChat(page: Page) {
  await page.getByRole("button", { name: "Mở Trợ lý Vedora (kéo để di chuyển)" }).click()
  return page.getByRole("dialog", { name: "Trợ lý Vedora" })
}

async function ask(page: Page, text = question) {
  const dialog = page.getByRole("dialog", { name: "Trợ lý Vedora" })
  await expect(dialog.getByRole("button", { name: "Gửi", exact: true })).toBeEnabled()
  await dialog.getByRole("textbox", { name: "Câu hỏi về dinh dưỡng" }).fill(text)
  await dialog.getByRole("button", { name: "Gửi", exact: true }).click()
}

test("keeps guest replies and conversation context after closing and reopening", async ({
  page,
}) => {
  const requests = await setup(page)
  await page.goto("/")
  const dialog = await openChat(page)
  await ask(page)
  await expect(dialog.getByText(answer, { exact: true })).toBeVisible()
  await dialog.getByRole("button", { name: "Đóng", exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await openChat(page)
  await expect(dialog.getByText(answer, { exact: true })).toBeVisible({ timeout: 3000 })
  await ask(page, "Còn chất sắt thì sao?")
  await expect.poll(() => requests.length).toBe(2)
  expect(requests[1].messages).toEqual([
    { role: "user", text: question },
    { role: "assistant", text: answer },
    { role: "user", text: "Còn chất sắt thì sao?" },
  ])
})

test("scrolls a long reply both ways without scrolling the landing page", async ({ page }) => {
  const long = Array.from(
    { length: 35 },
    (_, i) =>
      `Đoạn ${i + 1}: Đậu hũ, đậu lăng và hạt là nguồn đạm thực vật để bổ sung trong bữa ăn.`
  ).join("\n\n")
  await setup(page, long)
  await page.goto("/")
  await expect(page.locator("html")).toHaveClass(/lenis/)
  const dialog = await openChat(page)
  await ask(page)
  await expect(dialog.getByRole("button", { name: "Gửi", exact: true })).toBeEnabled()
  const viewport = dialog.getByLabel("Cuộc trò chuyện", { exact: true })
  await expect
    .poll(() => viewport.evaluate((el) => el.scrollHeight - el.clientHeight))
    .toBeGreaterThan(500)
  await expect.poll(() => viewport.evaluate((el) => el.scrollTop)).toBeGreaterThan(500)
  const before = await viewport.evaluate((el) => el.scrollTop)
  const pageY = await page.evaluate(() => window.scrollY)
  await viewport.hover()
  await page.mouse.wheel(0, -600)
  await expect
    .poll(() => viewport.evaluate((el) => el.scrollTop), { timeout: 3000 })
    .toBeLessThan(before - 100)
  const higher = await viewport.evaluate((el) => el.scrollTop)
  await page.mouse.wheel(0, 400)
  await expect.poll(() => viewport.evaluate((el) => el.scrollTop)).toBeGreaterThan(higher + 100)
  await viewport.evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  await page.mouse.wheel(0, 600)
  await page.waitForTimeout(300)
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - pageY)).toBeLessThan(3)
  await page.screenshot({ path: "test-results/guest-chat-desktop.png", fullPage: false })
})

test("clears only on a full page reload and can explicitly start over", async ({ page }) => {
  await setup(page)
  await page.goto("/")
  let dialog = await openChat(page)
  await ask(page)
  await expect(dialog.getByText(answer, { exact: true })).toBeVisible()
  await page.reload()
  dialog = await openChat(page)
  await expect(dialog.getByText(answer, { exact: true })).toHaveCount(0)
  await expect(dialog.getByText(question, { exact: true })).toHaveCount(0)
  await ask(page)
  await expect(dialog.getByText(answer, { exact: true })).toBeVisible()
  await dialog.getByRole("button", { name: "Bắt đầu lại", exact: true }).click()
  await expect(dialog.getByText(answer, { exact: true })).toHaveCount(0)
  await expect(dialog.getByText(/Chào bạn! Mình là Trợ lý Vedora/)).toBeVisible()
  const stored = await page.evaluate(() => ({
    local: Object.values(localStorage),
    session: Object.values(sessionStorage),
  }))
  expect(JSON.stringify(stored)).not.toContain(answer)
  expect(JSON.stringify(stored)).not.toContain(question)
})

test("continues receiving a reply while the chat is closed", async ({ page }) => {
  await setup(page)
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route("**/api/v1/nutrition-chat", async (route) => {
    if (route.request().method() === "OPTIONS") return route.fallback()
    await pending
    await route.fulfill({
      headers: {
        "content-type": "text/event-stream",
        "x-vercel-ai-ui-message-stream": "v1",
        "access-control-allow-origin": "*",
      },
      body: replyStream(answer),
    })
  })
  await page.goto("/")
  const dialog = await openChat(page)
  await ask(page)
  await expect(dialog.getByRole("button", { name: "Gửi", exact: true })).toBeDisabled()
  await dialog.getByRole("button", { name: "Đóng", exact: true }).click()
  release()
  await openChat(page)
  await expect(dialog.getByText(answer, { exact: true })).toBeVisible()
})

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  test("keeps chat within the screen and allows native touch scrolling", async ({ page }) => {
    await setup(
      page,
      Array.from(
        { length: 30 },
        (_, i) => `Phần ${i + 1}: Nội dung dinh dưỡng cho khách đọc trên điện thoại.`
      ).join("\n\n")
    )
    await page.goto("/")
    const dialog = await openChat(page)
    await ask(page)
    await expect(dialog.getByRole("button", { name: "Gửi", exact: true })).toBeEnabled()
    const viewport = dialog.getByLabel("Cuộc trò chuyện", { exact: true })
    await expect.poll(() => viewport.evaluate((el) => el.scrollTop)).toBeGreaterThan(500)
    const rect = await viewport.boundingBox()
    expect(rect).not.toBeNull()
    const before = await viewport.evaluate((el) => el.scrollTop)
    const pageY = await page.evaluate(() => window.scrollY)
    const session = await page.context().newCDPSession(page)
    const x = rect!.x + rect!.width / 2,
      y = rect!.y + 50
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] })
    for (let i = 1; i <= 5; i++)
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: y + i * 30 }],
      })
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
    await expect.poll(() => viewport.evaluate((el) => el.scrollTop)).toBeLessThan(before - 50)
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - pageY)).toBeLessThan(3)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true)
    await page.screenshot({ path: "test-results/guest-chat-mobile.png", fullPage: false })
  })
})
