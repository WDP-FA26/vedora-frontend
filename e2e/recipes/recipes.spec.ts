import { RECIPE_ID, recipeSummary } from "../fixtures/data-extra.mjs"
import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect, appAlerts } from "../helpers/test"

test.describe("recipes (member views)", () => {
  test.beforeEach(async ({ context }) => {
    await signInAs(context, "member")
  })

  test("the feed's recipes tab lists the public catalog", async ({ page }) => {
    await page.goto("/home")
    await page.getByRole("tab", { name: "Công thức" }).click()
    const card = page.getByRole("button", { name: /Đậu hũ sốt cà chua/ }).first()
    await expect(card).toBeVisible()
    await expect(card).toContainText("30 phút")
    await expect(card).toContainText("2 khẩu phần")
    await expect(card).toContainText("2 nguyên liệu")
  })

  test("opening a recipe shows its ingredients, steps and rating", async ({ page }) => {
    await page.goto("/home")
    await page.getByRole("tab", { name: "Công thức" }).click()
    await page.getByRole("button", { name: /Đậu hũ sốt cà chua/ }).first().click()
    const dialog = page.getByRole("dialog")
    await expect(dialog.getByRole("heading", { name: "Đậu hũ sốt cà chua" })).toBeVisible()
    await expect(dialog.getByRole("region", { name: "Nguyên liệu" })).toContainText("Cà chua")
    await expect(dialog.getByRole("region", { name: "Nguyên liệu" })).toContainText("cắt múi cau")
    await expect(dialog.getByRole("region", { name: "Cách làm" })).toContainText("Chiên đậu hũ.")
    await expect(dialog.getByRole("button", { name: "Lưu công thức" })).toBeVisible()
  })

  test("shows the empty catalog state", async ({ page }) => {
    await mockApi(page, "/recipes", { body: { items: [], meta: { hasNextPage: false } } }, "GET")
    await page.goto("/home")
    await page.getByRole("tab", { name: "Công thức" }).click()
    await expect(page.getByText("Chưa có công thức")).toBeVisible()
  })

  test("shows a retryable error when the catalog fails", async ({ page }) => {
    await mockApi(page, "/recipes", { status: 500, body: { statusCode: 500, message: "boom" } }, "GET")
    await page.goto("/home")
    await page.getByRole("tab", { name: "Công thức" }).click()
    await expect(page.getByText("Không tải được công thức. Kiểm tra kết nối rồi thử lại.")).toBeVisible()
  })

  test("saving a recipe sends PUT /favorite", async ({ page }) => {
    const calls = await mockApi(
      page,
      `/recipes/${RECIPE_ID}/favorite`,
      { body: { recipeId: RECIPE_ID, isFavorite: true } },
      "PUT"
    )
    await page.goto("/home")
    await page.getByRole("tab", { name: "Công thức" }).click()
    await page.getByRole("button", { name: /^Lưu công thức Đậu hũ sốt cà chua/ }).click()
    await expect(page.getByRole("button", { name: /^Bỏ lưu công thức/ })).toBeVisible()
    expect(calls).toHaveLength(1)
  })

  test("the saved-recipes tab shows its empty state", async ({ page }) => {
    await page.goto("/home/bookmarks?tab=recipes")
    await expect(page.getByText("Chưa lưu công thức nào")).toBeVisible()
  })

  test("the saved-recipes tab lists saved recipes", async ({ page }) => {
    await mockApi(page, "/recipes/favorites", {
      body: {
        items: [{ ...recipeSummary, isFavorite: true, savedAt: new Date().toISOString() }],
        meta: { page: 1, totalItems: 1, totalPages: 1 },
      },
    })
    await page.goto("/home/bookmarks?tab=recipes")
    await expect(page.getByRole("button", { name: /Đậu hũ sốt cà chua/ }).first()).toBeVisible()
  })
})

test.describe("admin recipes", () => {
  test.beforeEach(async ({ context }) => {
    await signInAs(context, "admin")
  })

  test("lists recipes with an add button", async ({ page }) => {
    await page.goto("/admin/recipes")
    await expect(page).toHaveTitle(/Công thức · Vedora Quản trị/)
    await expect(page.getByRole("tab", { name: "Công thức" })).toBeVisible()
    await expect(page.getByRole("tab", { name: "Nguyên liệu" })).toBeVisible()
    await expect(page.getByRole("tab", { name: "Kỵ nhau" })).toBeVisible()
    await expect(page.getByRole("row", { name: /Đậu hũ sốt cà chua/ })).toBeVisible()
    await expect(page.locator("a", { hasText: "Thêm công thức" })).toHaveAttribute("href", "/admin/recipes/new")
  })

  test("the ingredients and rules tabs list the catalog", async ({ page }) => {
    await page.goto("/admin/recipes")
    await page.getByRole("tab", { name: "Nguyên liệu" }).click()
    await expect(page.getByRole("row", { name: /Cà chua/ })).toBeVisible()
    await page.getByRole("tab", { name: "Kỵ nhau" }).click()
    await expect(page.getByText("Không nên ăn cùng nhau (ví dụ kiểm thử).")).toBeVisible()
  })

  test("?tab= opens the matching tab", async ({ page }) => {
    await page.goto("/admin/recipes?tab=ingredients")
    await expect(page.getByRole("tab", { name: "Nguyên liệu" })).toHaveAttribute("aria-selected", "true")
  })

  test("shows an error when the list cannot be loaded", async ({ page }) => {
    await mockApi(page, "/admin/recipes", { status: 500, body: { statusCode: 500, message: "boom" } }, "GET")
    await page.goto("/admin/recipes")
    await expect(page.getByText(/Không tải được danh sách công thức/)).toBeVisible()
  })

  test("a member is redirected away", async ({ browser }) => {
    const context = await browser.newContext()
    await signInAs(context, "member")
    const page = await context.newPage()
    await page.goto("http://localhost:3000/admin/recipes")
    await expect(page).toHaveURL(/\/home$/)
    await context.close()
  })
})

test.describe("admin recipe editor", () => {
  test.beforeEach(async ({ context }) => {
    await signInAs(context, "admin")
  })

  test("the new-recipe form validates every required field", async ({ page }) => {
    await page.goto("/admin/recipes/new")
    await expect(page).toHaveTitle(/Thêm công thức · Vedora Quản trị/)
    await page.getByRole("button", { name: "Lưu công thức" }).click()
    await expect(page.getByText("Nhập tên món.")).toBeVisible()
    await expect(page.getByText("Chọn nguyên liệu.")).toBeVisible()
    await expect(page.getByText("Nhập nội dung bước.")).toBeVisible()
  })

  test("validates servings and minutes", async ({ page }) => {
    await page.goto("/admin/recipes/new")
    await page.getByLabel("Khẩu phần").fill("0")
    await page.getByLabel("Sơ chế (phút)").fill("abc")
    await page.getByRole("button", { name: "Lưu công thức" }).click()
    await expect(page.getByText("Nhập số khẩu phần từ 1 đến 100.")).toBeVisible()
    await expect(page.getByText("Nhập số phút, tối đa 1440.")).toBeVisible()
  })

  test("saves a valid recipe and returns to the list", async ({ page }) => {
    const saved = await mockApi(
      page,
      "/admin/recipes",
      (route) => ({
        status: 201,
        body: { ...JSON.parse(route.request().postData() ?? "{}"), id: "new", ingredients: [], conflicts: [], post: null, imageUrl: null, description: null, prepMinutes: null, cookMinutes: null, ingredientCount: 1, updatedAt: new Date().toISOString() },
      }),
      "POST"
    )
    await page.goto("/admin/recipes/new")
    await page.getByLabel("Tên món").fill("Canh nấm thanh đạm")
    await page.getByLabel("Khẩu phần").fill("3")
    await page.getByPlaceholder("Tìm nguyên liệu", { exact: true }).click()
    await page.getByRole("option", { name: "Cà chua" }).click()
    await page.getByLabel("Lượng dòng 1").or(page.getByLabel("Lượng của Cà chua")).fill("2")
    await page.getByRole("textbox", { name: "Bước 1" }).fill("Nấu nước dùng rồi thả nấm vào.")
    await page.getByRole("button", { name: "Lưu công thức" }).click()
    await expect(page).toHaveURL(/\/admin\/recipes$/)
    expect(saved).toHaveLength(1)
    expect(saved[0].body).toMatchObject({
      title: "Canh nấm thanh đạm",
      servings: 3,
      ingredients: [{ ingredientId: "i-3", quantity: 2 }],
      steps: ["Nấu nước dùng rồi thả nấm vào."],
    })
  })

  test("rejects a duplicated ingredient row", async ({ page }) => {
    await page.goto("/admin/recipes/new")
    await page.getByPlaceholder("Tìm nguyên liệu", { exact: true }).click()
    await page.getByRole("option", { name: "Cà chua" }).click()
    await page.getByRole("button", { name: "Thêm dòng" }).click()
    await page.getByPlaceholder("Tìm nguyên liệu", { exact: true }).last().click()
    await page.getByRole("option", { name: "Cà chua" }).click()
    await page.getByRole("button", { name: "Lưu công thức" }).click()
    await expect(page.getByText("Nguyên liệu này đã có ở trên.")).toBeVisible()
  })

  test("the edit form loads the existing recipe", async ({ page }) => {
    await page.goto(`/admin/recipes/${RECIPE_ID}`)
    await expect(page).toHaveTitle(/Sửa công thức · Vedora Quản trị/)
    await expect(page.getByLabel("Tên món")).toHaveValue("Đậu hũ sốt cà chua")
    await expect(page.getByRole("button", { name: "Lưu thay đổi" })).toBeVisible()
    await expect(page.getByRole("textbox", { name: "Bước 1" })).toHaveValue("Chiên đậu hũ.")
  })

  test("editing sends PUT with the changed title", async ({ page }) => {
    const calls = await mockApi(
      page,
      `/admin/recipes/${RECIPE_ID}`,
      (route) => ({
        body: {
          ...JSON.parse(route.request().postData() ?? "{}"),
          id: RECIPE_ID,
          ingredientCount: 2,
          conflicts: [],
          post: null,
          imageUrl: null,
          description: null,
          prepMinutes: 10,
          cookMinutes: 20,
          servings: 2,
          steps: ["a"],
          ingredients: [],
          updatedAt: new Date().toISOString(),
        },
      }),
      "PUT"
    )
    await page.goto(`/admin/recipes/${RECIPE_ID}`)
    await expect(page.getByLabel("Tên món")).toHaveValue("Đậu hũ sốt cà chua")
    await page.getByLabel("Tên món").fill("Đậu hũ sốt cà chua kiểu mới")
    await page.getByRole("button", { name: "Lưu thay đổi" }).click()
    await expect(page).toHaveURL(/\/admin\/recipes$/)
    expect(calls).toHaveLength(1)
    expect(calls[0].body).toMatchObject({ title: "Đậu hũ sốt cà chua kiểu mới", servings: 2 })
  })

  test("shows an error when saving fails", async ({ page }) => {
    await mockApi(page, `/admin/recipes/${RECIPE_ID}`, { status: 500, body: { statusCode: 500, message: "boom" } }, "PUT")
    await page.goto(`/admin/recipes/${RECIPE_ID}`)
    await expect(page.getByLabel("Tên món")).toHaveValue("Đậu hũ sốt cà chua")
    await page.getByRole("button", { name: "Lưu thay đổi" }).click()
    await expect(appAlerts(page)).toContainText("Không lưu được công thức. Thử lại nhé.")
  })

  test("an unknown recipe shows an error state", async ({ page }) => {
    await page.goto("/admin/recipes/does-not-exist")
    await expect(page.getByText("Công thức này đã bị xoá.")).toBeVisible()
  })
})
