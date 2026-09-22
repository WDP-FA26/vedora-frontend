# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

# Data fetching with SWR

Client-side data fetching uses [SWR](https://swr.vercel.app). Full guide (read before adding new fetching patterns, since this project's Next.js version has its own conventions): `node_modules/next/dist/docs/01-app/02-guides/client-side-data-fetching/swr.md`.

- `SWRProvider` ([src/components/swr-provider.tsx](src/components/swr-provider.tsx)) wraps the app in the root layout and sets a global `fetcher` ([src/lib/fetcher.ts](src/lib/fetcher.ts)) plus `revalidateOnFocus: false`. Don't pass a `fetcher` to individual `useSWR` calls unless a request needs different handling than the shared one.
- Use `useSWR(key, options?)` in Client Components (`"use client"`) for data that can load after hydration. Use `{ suspense: true }` when the nearest Suspense boundary should own the loading state instead of the hook's own `isLoading`.
- For data a Server Component already has and SWR should take over in the browser, provide it via a route-scoped `<SWRConfig value={{ fallback: { [key]: promise } }}>` (not the root layout) so the fallback stays with the feature that owns it. Define the SWR key (and cache tag, if using `use cache`) once in a shared `*-cache.ts` contract so the server fallback, the client `useSWR` call, and any mutation all agree on it.
- Mutate through `useSWRConfig()`'s `mutate(key, fn, { optimisticData, rollbackOnError })`, not by refetching manually.
