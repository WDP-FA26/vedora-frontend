# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Verified chefs:** professional plant-based chefs, food scientists, and recipe creators. They post recipe reels, long-form blogs, and research write-ups, and they build a following.
- **Everyone else:** home cooks, growers, and curious eaters. They read, watch, reply, repost, bookmark, and share their own cooking and harvests.

## Product Purpose

Vedora is a social platform for vegetarian and plant-based cooking. People discuss, upload videos, and blog about vegetarian food. It borrows the familiar X.com layout (left nav, center timeline, right rail) so it feels usable right away.

## Positioning

A social feed that treats food content as craft: recipe reels, peer-reviewed nutrition writing, and garden-to-plate posts all sit in one timeline, and verified professional chefs are marked as a trust signal.

## Operating Context

- The main surface is the timeline, with tabs for For You, Following, Blogs, and Videos & Recipes.
- The composer takes text plus media (images, video, recipe, poll, emoji).
- Post types: video/recipe reel, blog or research article, and image post.
- The right rail shows trending topics and suggested creators.
- Video uploads go through Mux direct uploads (`src/app/api/mux/upload/route.ts`).

## Capabilities and Constraints

- Next.js 16 App Router, React 19, Tailwind v4, and shadcn (base-nova style, Base UI primitives), with lucide icons. Use shadcn components for consistency.
- Feed content is fixed mock data kept in code (`src/features/*/data/`), with placeholder images. There is no fetching or backend API yet; SWR is set up for later.
- **Verification is a badge only.** Everyone can post every content type, and verification is a trust signal next to the name.
- Terminology: a like is a **Sprout**, and the publish button is **Sprout**.
- Light and dark themes, following the system by default. Users switch between Light, Dark, and System in the account menu (desktop) or the menu drawer (phone).

## Brand Commitments

- Name: Vedora. Tagline in the reference: "Conscious Plant Living".
- The user supplied a reference screenshot of the home feed. Its three-column X-style layout, deep forest-green primary, and light, calm surfaces are binding.

## Evidence on Hand

- No real users, creators, metrics, or imagery yet. All feed content is illustrative mock data, and images are placeholders. Do not present invented metrics or credentials as real.

## Product Principles

1. Content first: the recipe, the reel, and the article carry the page, and the UI stays out of the way.
2. Familiar layout, particular details: keep X's layout conventions and put the brand in the craft.
3. Show expertise honestly: verification marks trust without gating participation.
4. Calm, not addictive: no gamified noise; engagement counts stay quiet.
