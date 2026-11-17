import { test as base, expect } from "@playwright/test"

/**
 * Stand-in for Cloudflare's Turnstile script. The real one needs the network
 * and, for the always-pass site key, still renders a widget. This stub keeps
 * the same contract `@marsidev/react-turnstile` relies on: it calls the
 * `onload` callback named in the script URL, and `render()` reports a token.
 */
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

/**
 * `test` with defaults every spec wants:
 *  - Turnstile is stubbed, so the login button enables without network access.
 *  - Third-party hosts (Cloudinary, fonts, analytics) are aborted, so a spec
 *    never depends on, or waits for, the internet.
 */
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

/** In-page `role="alert"` elements, excluding Next's route announcer (also an alert). */
export const appAlerts = (page: import("@playwright/test").Page) =>
  page.locator('[role="alert"]:not(#__next-route-announcer__)')

/**
 * `page.goto` for pages with client-side forms: waits until the network is idle
 * so React has hydrated before the spec types or clicks (an early click on a
 * `noValidate` form would otherwise submit it natively). Only for guest pages:
 * signed-in pages hold SSE connections open and never go idle.
 */
export async function gotoReady(page: import("@playwright/test").Page, path: string) {
  await page.goto(path)
  await page.waitForLoadState("networkidle")
}
