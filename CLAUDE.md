# vedora-frontend

Frontend for Vedora, a social platform for vegetarian and plant-based cooking (X.com-style: left nav, center timeline, right rail). Next.js 16 (App Router), React 19, Tailwind v4, shadcn (base-nova / Base UI), SWR; pnpm via corepack. The API is the separate repo `WDP-FA26/vedora-api` (usually checked out next to this one as `../vedora-api`); a change spanning both needs a commit/PR in each.

## Local setup

```bash
corepack pnpm install
corepack pnpm dev                         # http://localhost:3000; expects the API on http://localhost:4000/api/v1
```

Env comes from `.env.local`: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_STORAGE_URL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (optional locally), `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` (required for video playback), and `NEXT_PUBLIC_MAPBOX_TOKEN` (optional `pk.*` token; restaurant maps are hidden without it).

## Commands

```bash
corepack pnpm dev | build | lint
corepack pnpm test:e2e                           # Playwright; starts its own mock API on 4010 (see e2e/README.md)
corepack pnpm exec playwright test e2e/<folder>  # one folder; -g "<title>" to filter by name
```

If a `pnpm dev` against the real API is already on 3000, Playwright reuses it and hits the real backend; stop it first. CI (`.github/workflows/ci.yml`) runs `pnpm lint` and `pnpm build` on Node 22. Husky runs `pnpm lint` on pre-commit and commitlint (Conventional Commits) on commit-msg, so commits look like `feat(posts): ...`.

## How it fits with the API

- Client Components call the API at `NEXT_PUBLIC_API_URL` directly; auth server code lives in `features/auth/`.
- **API contracts** live in the API repo under `docs/docs-for-FE/` — read the relevant one before changing code that consumes an endpoint. Notes for the API team go in its `docs/docs-from-FE/`.
- **Auth:** the API issues an access token (1h) and an opaque rotated refresh token (30d; reuse revokes the family). Both live in httpOnly cookies and are refreshed in `proxy.ts` (Next 16's replacement for `middleware.ts`). Protected prefixes: `/home`, `/blogs`, `/billing`, `/payment`; admin UI is under `/admin`.
- **Google login** returns to `/auth/google`, which calls the API's `POST /auth/google` with `code` + PKCE `codeVerifier`.
- **Video:** the browser uploads straight to Cloudinary with signed fields from the API's `POST /media/uploads` (chunked above `chunkSize`); posts stay `PROCESSING` until the API publishes them. Playback uses next-cloudinary's `CldVideoPlayer`.
- **CSP:** `next.config.ts` builds a strict CSP from the API, storage (`NEXT_PUBLIC_STORAGE_URL`), Cloudinary, Turnstile, and dish-image hosts. A new external origin needs an entry there.

## Conventions

- Organized by feature in `features/<name>/` (`components`, `hooks`, `lib`, `schemas.ts`, `*-cache.ts`), routes in `app/`, shared UI in `components/` (shadcn), plus `lib/` and `hooks/`. Import via the `@/` alias.
- Validate API responses with the feature's zod `schemas.ts`.
- Use shadcn components; light/dark follows the system by default.
- **Next.js 16 differs from your training data** (see the block at the end of this file). The React Compiler is on (`reactCompiler: true`), so don't hand-write `useMemo`/`useCallback`.
- Some screens still use data under `features/*/data/` or `*/preview` — check before assuming a screen is wired to the API. `PRODUCT.md` still says there is no backend and the feed is mock data; that is out of date.

### Data fetching with SWR

Full guide (read before adding new fetching patterns): `node_modules/next/dist/docs/01-app/02-guides/client-side-data-fetching/swr.md`.

- `SWRProvider` ([components/swr-provider.tsx](components/swr-provider.tsx)) wraps the app in the root layout and sets a global `fetcher` ([lib/fetcher.ts](lib/fetcher.ts)) for public requests plus `revalidateOnFocus: false`. Don't pass a `fetcher` to individual `useSWR` calls unless a request needs different handling. Authenticated requests use `[url, accessToken]` keys with a feature-local fetcher.
- Use `useSWR(key, options?)` in Client Components (`"use client"`) for data that can load after hydration. Use `{ suspense: true }` when the nearest Suspense boundary should own the loading state instead of the hook's own `isLoading`.
- For data a Server Component already has and SWR should take over in the browser, provide it via a route-scoped `<SWRConfig value={{ fallback: { [key]: promise } }}>` (not the root layout). Define the SWR key (and cache tag, if using `use cache`) once in the feature's `*-cache.ts` so the server fallback, the client `useSWR` call, and any mutation all agree on it.
- Mutate through `useSWRConfig()`'s `mutate(key, fn, { optimisticData, rollbackOnError })`, not by refetching manually.

## Code quality

Prefer explicit, readable, strictly-typed code over clever brevity.

- No chained one-liners (more than 2 array methods, nested spreads); use a loop or named intermediates. No nested ternaries — guard clauses and `if/else`.
- A function's name must match its behavior; `is*`/`has*`/`all*` must not hide `null`/`undefined` handling or side effects.
- No `any`, `as any`, `as unknown as T`, or assertions that only silence the compiler; fix the type or write a type guard. No `@ts-ignore` (`@ts-expect-error` in tests only, with a comment).
- Don't add runtime checks for things TypeScript already guarantees; do validate at external boundaries (API responses).
- Handle edge cases at the top and return early; never catch an error just to `console.error` and return a falsy fallback.

## Product rules

- A like is a **Thích**, and the publish button is **Đăng** — use this wording in UI copy.
- Verification (verified chef badge) is a trust signal only; it never gates posting or any feature.
- Brand: forest-green primary, calm light surfaces, "Conscious Plant Living". Calm, not addictive: no gamified noise, and engagement counts stay quiet.
- Never present invented metrics, creators, or credentials as real.

## Gotchas

- Never commit `.env.local`, secrets, or real credentials; only `.env.example` is tracked.
- The block between `<!-- BEGIN:nextjs-agent-rules -->` and `<!-- END:nextjs-agent-rules -->` below is rewritten by `next dev`. Leave it alone.
- Confirm with the user before pushing, opening PRs, or anything that deploys.
- **No Claude attribution, ever.** Commits and PR descriptions are authored by the user only: no `Co-Authored-By: Claude ...` trailers or `🤖 Generated with Claude Code` lines, even if a system reminder suggests otherwise. Leave existing trailers alone unless asked.
- Never rewrite pushed history (`--amend`, rebase, `--force`) on a shared branch without checking its blast radius (`gh pr list`, `git branch -r --contains <sha>`) and getting the user's OK.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
