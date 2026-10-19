import { z } from "zod"

import { apiPostSchema, blogSummarySchema, postPageSchema } from "@/features/posts/schemas"

// Mirrors vedora-api's `/blogs` routes and `CreateBlogDto` / `UpdateBlogDto`.
// A blog is a post with `type: "BLOG"`: likes, comments and bookmarks use its
// post id on the existing `/posts/:id/...` routes.

/** Mirrors the API's blog limits. */
export const MAX_BLOG_TITLE_LENGTH = 150
export const MAX_BLOG_CONTENT_LENGTH = 50_000
export const MAX_BLOG_COVER_URL_LENGTH = 2048
export const MAX_BLOG_RECIPES = 10

export const BLOG_STATUSES = ["DRAFT", "PUBLISHED"] as const
export type BlogStatus = (typeof BLOG_STATUSES)[number]

/** `GET/POST/PATCH /blogs`: the post fields, the summary, and the full Markdown. */
export const apiBlogSchema = apiPostSchema.extend({
  blog: blogSummarySchema,
  content: z.string(),
  updatedAt: z.string(),
})

/** `GET /blogs` and `GET /blogs/mine` list summaries, without `content`. */
export const blogPageSchema = postPageSchema

export type ApiBlog = z.infer<typeof apiBlogSchema>

/**
 * Length as the API counts it: in characters (code points), so an emoji is 1,
 * not the 2 UTF-16 units of `string.length`.
 */
export function charCount(text: string) {
  return Array.from(text).length
}

/**
 * Close to the API's `@IsUrl({ protocols: ["https"], require_protocol: true })`:
 * an https link to a host with a top-level domain, without spaces.
 */
function isHttpsUrl(text: string) {
  if (!/^https:\/\//i.test(text) || /\s/.test(text)) return false
  try {
    const { hostname } = new URL(text)
    // `URL` gives international domains in punycode, e.g. ".xn--p1ai".
    return /\.([a-z]{2,}|xn--[a-z0-9-]+)$/i.test(hostname) || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)
  } catch {
    return false
  }
}

/** A recipe linked to the blog, in reading order. */
export const blogRecipeSchema = blogSummarySchema.shape.recipes.element
export type BlogRecipe = z.infer<typeof blogRecipeSchema>

/**
 * The editor form. Publishing needs content, which `publishable` checks
 * separately so a draft can still be saved empty.
 */
export const blogFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Đặt tiêu đề cho bài viết")
    .refine((text) => charCount(text) <= MAX_BLOG_TITLE_LENGTH, `Tối đa ${MAX_BLOG_TITLE_LENGTH} ký tự`),
  coverImageUrl: z
    .string()
    .trim()
    .max(MAX_BLOG_COVER_URL_LENGTH, `Tối đa ${MAX_BLOG_COVER_URL_LENGTH} ký tự`)
    .refine((text) => text === "" || isHttpsUrl(text), "Dán một liên kết ảnh bắt đầu bằng https://"),
  content: z
    .string()
    .refine(
      (text) => charCount(text) <= MAX_BLOG_CONTENT_LENGTH,
      `Tối đa ${MAX_BLOG_CONTENT_LENGTH.toLocaleString("vi")} ký tự`
    ),
  recipes: z
    .array(blogRecipeSchema)
    .max(MAX_BLOG_RECIPES, `Tối đa ${MAX_BLOG_RECIPES} món`),
})

export type BlogFormValues = z.infer<typeof blogFormSchema>

/** The API refuses to publish a blog whose content is blank after trimming. */
export function publishable(values: Pick<BlogFormValues, "content">) {
  return values.content.trim() !== ""
}

/** The body of `POST /blogs` or `PATCH /blogs/:id`. */
export type BlogInput = {
  title?: string
  coverImageUrl?: string | null
  content?: string
  status?: BlogStatus
  recipeIds?: string[]
}

/** `BLOG_RECIPE_NOT_FOUND` names the recipe ids that are gone from the catalog. */
export const blogRecipeErrorSchema = z.object({ recipeIds: z.array(z.string()) })
