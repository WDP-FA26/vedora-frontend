# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

# Data fetching with SWR

Client-side data fetching uses [SWR](https://swr.vercel.app). Full guide (read before adding new fetching patterns, since this project's Next.js version has its own conventions): `node_modules/next/dist/docs/01-app/02-guides/client-side-data-fetching/swr.md`.

- `SWRProvider` ([components/swr-provider.tsx](components/swr-provider.tsx)) wraps the app in the root layout and sets a global `fetcher` ([lib/fetcher.ts](lib/fetcher.ts)) plus `revalidateOnFocus: false`. Don't pass a `fetcher` to individual `useSWR` calls unless a request needs different handling than the shared one.
- Use `useSWR(key, options?)` in Client Components (`"use client"`) for data that can load after hydration. Use `{ suspense: true }` when the nearest Suspense boundary should own the loading state instead of the hook's own `isLoading`.
- For data a Server Component already has and SWR should take over in the browser, provide it via a route-scoped `<SWRConfig value={{ fallback: { [key]: promise } }}>` (not the root layout) so the fallback stays with the feature that owns it. Define the SWR key (and cache tag, if using `use cache`) once in a shared `*-cache.ts` contract so the server fallback, the client `useSWR` call, and any mutation all agree on it.
- Mutate through `useSWRConfig()`'s `mutate(key, fn, { optimisticData, rollbackOnError })`, not by refetching manually.

# Tests

- `pnpm test`: Vitest unit tests (`**/*.test.ts`, config in [vitest.config.mts](vitest.config.mts)) for logic that runs without a browser. Keep such logic out of React hooks and components so it can be tested, as [features/meal-plan/voice/voice-call.ts](features/meal-plan/voice/voice-call.ts) does for the voice agent.
- `pnpm test:e2e`: Playwright against the mock API in `e2e/`.
- Voice call against real GPT-Live: `VOICE_SIM_SCENARIO=A|B|C|D pnpm vitest run --config scripts/voice-sim/vitest.config.mts` speaks OpenAI TTS phrases into a Live session through the local API (`vedora.admin`, keys from `../vedora-api/.env`) and logs the timeline. It is billed per second, writes to that account's meal plan, and skips the browser mic pipeline (echo cancellation, DeepFilter).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
