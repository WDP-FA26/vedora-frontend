# End-to-end tests (Playwright)

Browser tests for the Vedora frontend. They need **no real backend**: a small
mock API ships with the suite.

## Running

```bash
pnpm test:e2e              # headless, all specs
pnpm test:e2e:ui           # Playwright UI mode
pnpm exec playwright test e2e/auth            # one folder
pnpm exec playwright test -g "login"          # by title
pnpm exec playwright show-report              # open the last HTML report
```

First time on a machine: `pnpm exec playwright install chromium`.

`playwright.config.ts` starts two servers (and reuses them if already running):

| Server   | Port | Command                          |
| -------- | ---- | -------------------------------- |
| mock API | 4010 | `node e2e/mock-api/server.mjs`   |
| Next dev | 3000 | `pnpm dev`                       |

The Next server is started with `NEXT_PUBLIC_API_URL` pointing at the mock API,
so it overrides `.env.local`. If you already have `pnpm dev` running on port
3000 against the real API, Playwright reuses it and the tests will hit the real
backend instead; stop it first (or run it with
`NEXT_PUBLIC_API_URL=http://localhost:4010/api/v1`).

## How mocking works

Much of the app talks to the API **from the Next.js server** (proxy.ts token
refresh, Server Actions such as `login`, layouts calling `/auth/me`, the public
post page). `page.route` only sees browser traffic, so it cannot cover those.
The suite therefore uses two layers:

1. **Mock API server** (`e2e/mock-api/server.mjs`, data in
   `e2e/fixtures/data.mjs`). Both the Next server and the browser call it. It is
   stateless; behaviour is chosen by the request itself:
   - the bearer token's `sub` claim picks the user (`/auth/me`, admin checks);
   - login with password `Password123` and username `minhanh` (member),
     `quantri` (admin) or `bepchay` signs in; usernames `suspended`,
     `unverified` and `captcha` trigger those failure modes; anything else is a 401;
   - register usernames/emails `taken` / `taken@example.com` give a 409;
   - email/reset code `123456` is the only valid one.
2. **`mockApi(page, path, response, method?)`** (`e2e/helpers/api.ts`) wraps
   `page.route` to override a single browser-side call for one test (empty feed,
   a 500, pagination, capturing a request body). It returns the list of requests
   it saw. Pass a function to compute the response per request.

Unhandled paths are logged as `[mock-api] unhandled ...` in the server output
and answered with 404; add a handler when a new page needs one.

## Authentication in tests

`signInAs(context, "member" | "admin" | "chef")` (`e2e/helpers/auth.ts`) plants
the `vedora_at` / `vedora_rt` cookies that `proxy.ts` and the server session
helpers read. The access token is an unsigned JWT with a future `exp`; only the
mock API reads its `sub`. To test the real login form use `/login` with the
credentials above.

## Other helpers (`e2e/helpers/test.ts`)

Import `test`/`expect` from here, not from `@playwright/test`. The extended
`page`:

- **stubs Cloudflare Turnstile** (login's submit button stays disabled until a
  token arrives): the script request is fulfilled with a stub that reports a
  token, so no internet is needed. The always-pass test site key is used because
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is empty for the test server;
- aborts Cloudinary/unpkg requests.

`appAlerts(page)` selects in-page `role="alert"` elements without Next's route
announcer (which is also an alert and breaks strict locators).

## Layout

```
e2e/
  auth/         login, register, verify-email, forgot/reset password, route protection
  home/         feed, navigation shell, search, notifications, bookmarks
  public/       landing, post detail, profile
  blogs/        new/edit blog editor
  messages/     inbox, conversation, sending
  planner/      meal planner (+ dev preview) and dietary profile
  billing/      plans, purchase flow, payment status page
  recipes/      member recipe views, admin catalog and recipe editor
  verification/ professional verification request and admin review
  knowledge/    admin knowledge documents and OCR review page
  admin/        users, content, moderation queue, settings, insights, AI costs, payments
  fixtures/     data.mjs (users, posts, ...), data-extra.mjs (everything else)
  helpers/      test.ts, auth.ts, api.ts
  mock-api/     server.mjs (core routes) and extra-routes.mjs (the rest)
```

## Known limitations

- The mock API's SSE endpoints (`*/sse`, `*/events`) only send a keep-alive;
  live push (toasts, unread-count updates, payment status pushes) is not tested.
- Video upload/playback (Cloudinary) is not covered.
- The meal planner's AI chat stream (`/meal-plan/chat`) is only exercised for
  the web search consent flow (a canned stream); the blog writing assistant and
  the nutrition chat are not exercised.
- Forms that are native-submitted if clicked before hydration (admin date
  filters) are retried with `expect(...).toPass`; guest auth pages use
  `gotoReady()`.
- `test.fail` marks known app bugs; remove the marker when the bug is fixed.
