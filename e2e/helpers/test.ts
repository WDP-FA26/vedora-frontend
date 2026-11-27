import { test as base, expect } from "@playwright/test"

const TURNSTILE_STUB = `
(function () {
  var widgets = 0;
  window.turnstile = {
    render: function (_el, options) {
      var id = "e2e-widget-" + ++widgets;
      setTimeout(function () { options.callback && options.callback("e2e-turnstile-token"); }, 20);
      return id;
    },
    reset: function (id) { },
    remove: function () {},
    execute: function () {},
    getResponse: function () { return "e2e-turnstile-token"; },
    isExpired: function () { return false; },
  };
  var src = document.currentScript && document.currentScript.src;
  var onload = src && new URL(src).searchParams.get("onload");
  if (onload && typeof window[onload] === "function") window[onload]();
})();
`

export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.route("https://challenges.cloudflare.com/**", (route) =>
      route.fulfill({ contentType: "application/javascript", body: TURNSTILE_STUB })
    )
    await page.route(/^https:\/\/(res|api)\.cloudinary\.com\/|^https:\/\/unpkg\.com\//, (route) =>
      route.abort()
    )
    await provide(page)
  },
})

export { expect }

export const appAlerts = (page: import("@playwright/test").Page) =>
  page.locator('[role="alert"]:not(#__next-route-announcer__)')

export async function gotoReady(page: import("@playwright/test").Page, path: string) {
  await page.goto(path)
  await page.waitForLoadState("networkidle")
}
