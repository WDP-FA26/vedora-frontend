import type { Page, Route } from "@playwright/test"

import { API_URL } from "../fixtures/data.mjs"

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
}

type Mock = { status?: number; body?: unknown }

export async function mockApi(
  page: Page,
  path: string,
  response: Mock | ((route: Route) => Mock | Promise<Mock>),
  method?: string
) {
  const requests: { url: string; method: string; body: unknown }[] = []
  await page.route(
    (url) => url.href.startsWith(`${API_URL}${path}`) && url.pathname === `/api/v1${path}`,
    async (route) => {
      const request = route.request()
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS })
      if (method && request.method() !== method) return route.fallback()
      requests.push({
        url: request.url(),
        method: request.method(),
        body: request.postData() ? safeJson(request.postData()!) : undefined,
      })
      const { status = 200, body } = typeof response === "function" ? await response(route) : response
      await route.fulfill({
        status,
        headers: { ...CORS, "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    }
  )
  return requests
}

function safeJson(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
