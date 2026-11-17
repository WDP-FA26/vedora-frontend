// A tiny stand-in for vedora-api, started by Playwright's `webServer`.
//
// Server Components, Server Actions and proxy.ts call the API from the Next.js
// server, where `page.route` cannot see the request. Pointing
// NEXT_PUBLIC_API_URL at this process lets both the server and the browser
// talk to the same fake backend. Specs can still override individual browser
// calls with `page.route` (see e2e/helpers/api.ts).
//
// Behaviour is driven by the data a request carries, so tests need no shared
// mutable state: the bearer token names the user (`sub`), and special
// usernames in the login/register bodies trigger the failure modes.

import http from "node:http"

import {
  API_PORT,
  VALID_PASSWORD,
  adminUsers,
  blogs,
  comments,
  makeTokens,
  notifications,
  pageOf,
  posts,
  profiles,
  publicUser,
  users,
} from "../fixtures/data.mjs"

const PREFIX = "/api/v1"
const allUsers = Object.values(users)

function cors(res, req) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*")
  res.setHeader("Vary", "Origin")
  res.setHeader("Access-Control-Allow-Headers", "authorization, content-type")
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
}

function send(res, status, body) {
  if (body === undefined) {
    res.writeHead(status)
    return res.end()
  }
  res.writeHead(status, { "Content-Type": "application/json" })
  res.end(JSON.stringify(body))
}

const error = (res, status, code, message, details) =>
  send(res, status, { statusCode: status, code, message, ...(details ? { details } : {}) })

function userFromToken(req) {
  const token = req.headers.authorization?.replace(/^Bearer /, "")
  if (!token) return null
  try {
    const { sub, exp } = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString())
    if (exp * 1000 < Date.now()) return null
    return allUsers.find((user) => user.id === sub) ?? null
  } catch {
    return null
  }
}

async function readJson(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  try {
    return JSON.parse(Buffer.concat(chunks).toString() || "{}")
  } catch {
    return {}
  }
}

const adminPage = (items) => ({ items, meta: { hasNextPage: false } })

async function handle(req, res, url, body) {
  const path = url.pathname.slice(PREFIX.length)
  const method = req.method
  const me = userFromToken(req)
  const q = url.searchParams

  // --- auth ---------------------------------------------------------------
  if (path === "/auth/login" && method === "POST") {
    const { username, password } = body
    if (username === "captcha") return error(res, 403, "CAPTCHA_FAILED", "Captcha failed")
    if (username === "unverified") {
      return error(res, 403, "EMAIL_NOT_VERIFIED", "Email not verified", {
        email: "unverified@example.com",
      })
    }
    if (username === "suspended") {
      return error(res, 401, "ACCOUNT_SUSPENDED", "Account suspended")
    }
    const user = allUsers.find((candidate) => candidate.username === username)
    if (!user || password !== VALID_PASSWORD) {
      return error(res, 401, "INVALID_CREDENTIALS", "Invalid credentials")
    }
    return send(res, 200, makeTokens(user.id))
  }
  if (path === "/auth/refresh" && method === "POST") {
    const match = /^refresh\.([^.]+)\./.exec(body.refreshToken ?? "")
    if (!match) return error(res, 401, "INVALID_REFRESH_TOKEN", "Invalid refresh token")
    return send(res, 200, makeTokens(match[1]))
  }
  if (path === "/auth/register" && method === "POST") {
    if (body.username === "taken") return error(res, 409, "CONFLICT", "username already exists")
    if (body.email === "taken@example.com") {
      return error(res, 409, "CONFLICT", "email already exists")
    }
    return send(res, 201, { email: body.email })
  }
  if (path === "/auth/verify-email" && method === "POST") {
    if (body.code !== "123456") return error(res, 400, "INVALID_CODE", "Invalid code")
    return send(res, 200, makeTokens(users.member.id))
  }
  if (path === "/auth/verify-email/resend" && method === "POST") return send(res, 204)
  if (path === "/auth/password/forgot" && method === "POST") {
    if (body.email === "limited@example.com") return error(res, 429, "TOO_MANY", "Too many")
    return send(res, 204)
  }
  if (path === "/auth/password/reset" && method === "POST") {
    if (body.code !== "123456") return error(res, 400, "INVALID_CODE", "Invalid code")
    return send(res, 204)
  }
  if (path === "/auth/logout" && method === "POST") return send(res, 204)
  if (path === "/auth/me") {
    if (!me) return error(res, 401, "UNAUTHORIZED", "Unauthorized")
    return send(res, 200, publicUser(me))
  }

  // --- posts --------------------------------------------------------------
  if (path === "/posts/views" && method === "POST") return send(res, 204)
  if (path === "/posts/feed") return send(res, 200, pageOf(posts.filter((p) => p.type === "POST")))
  if (path === "/posts/following") return send(res, 200, pageOf([posts[0]]))
  if (path === "/posts/bookmarks") return send(res, 200, pageOf([]))
  if (path === "/posts/search") {
    const term = (q.get("q") ?? "").toLowerCase()
    const hits = posts.filter((p) => (p.body ?? p.blog?.title ?? "").toLowerCase().includes(term))
    return send(res, 200, pageOf(hits))
  }
  if (path === "/posts" && method === "GET") {
    const authorId = q.get("authorId")
    return send(res, 200, pageOf(authorId ? posts.filter((p) => p.author.id === authorId) : posts))
  }
  const postMatch = /^\/posts\/([^/]+)(?:\/(comments|like|bookmark|repost))?$/.exec(path)
  if (postMatch) {
    const [, id, sub] = postMatch
    const found = posts.find((p) => p.id === id)
    if (!found) return error(res, 404, "NOT_FOUND", "Post not found")
    if (!sub) return send(res, 200, found)
    if (sub === "comments") {
      if (method === "POST") {
        return send(res, 201, {
          ...comments[0],
          id: "c-new",
          postId: id,
          body: body.body,
          author: me
            ? { id: me.id, username: me.username, fullName: me.fullName, avatarUrl: null }
            : found.author,
        })
      }
      return send(res, 200, pageOf(comments.map((c) => ({ ...c, postId: id }))))
    }
    if (sub === "like") {
      return send(res, 200, { isLiked: method === "PUT", likeCount: found.likeCount + (method === "PUT" ? 1 : 0) })
    }
    if (sub === "bookmark") return send(res, 200, { isBookmarked: method === "PUT" })
    if (sub === "repost") {
      return send(res, 200, { isReposted: method === "PUT", repostCount: found.repostCount })
    }
  }

  // --- blogs --------------------------------------------------------------
  if ((path === "/blogs/mine" || path === "/blogs") && method === "GET") return send(res, 200, pageOf([]))
  if (path === "/blogs/ai/quota") return send(res, 200, { limit: 20, used: 0, remaining: 20 })
  if (path === "/blogs" && method === "POST") {
    return send(res, 201, {
      id: "b-new",
      status: body.status ?? "DRAFT",
      content: body.content ?? "",
      updatedAt: new Date().toISOString(),
      blog: { title: body.title ?? "", coverImageUrl: body.coverImageUrl ?? null, excerpt: "" },
    })
  }
  const blogMatch = /^\/blogs\/([^/]+)$/.exec(path)
  if (blogMatch) {
    const found = blogs[blogMatch[1]]
    if (!found) return error(res, 404, "NOT_FOUND", "Blog not found")
    return send(res, 200, found)
  }

  // --- profiles -----------------------------------------------------------
  if (path === "/profiles/me") {
    if (!me) return error(res, 401, "UNAUTHORIZED", "Unauthorized")
    return send(res, 200, profiles[me.id])
  }
  if (path === "/profiles/suggestions") return send(res, 200, { items: [] })
  const profileMatch = /^\/profiles\/([^/]+)(?:\/(relationship|followers|following))?$/.exec(path)
  if (profileMatch) {
    const [, id, sub] = profileMatch
    const profile = profiles[id]
    if (!profile) return error(res, 404, "NOT_FOUND", "Profile not found")
    if (!sub) return send(res, 200, profile)
    if (sub === "relationship") return send(res, 200, { isFollowing: false })
    return send(res, 200, pageOf([]))
  }

  // --- streams, notifications, messaging ----------------------------------
  if (path.endsWith("/sse") || path.endsWith("/events")) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    })
    res.write(": connected\n\n")
    return // left open on purpose; closed with the client
  }
  if (path === "/notifications/unread-count") {
    return send(res, 200, { unreadCount: notifications.filter((n) => !n.readAt).length })
  }
  if (path === "/notifications/read" && method === "POST") return send(res, 204)
  if (/^\/notifications\/[^/]+\/read$/.test(path) && method === "POST") return send(res, 204)
  if (path === "/notifications") return send(res, 200, pageOf(notifications))
  if (path === "/messaging/conversations") return send(res, 200, pageOf([]))

  // --- admin --------------------------------------------------------------
  if (path === "/users" && method === "GET") {
    if (!me) return error(res, 401, "UNAUTHORIZED", "Unauthorized")
    if (me.role !== "ADMIN") return error(res, 403, "FORBIDDEN", "Forbidden")
    const term = (q.get("q") ?? "").toLowerCase()
    const status = q.get("status")
    const rows = adminUsers.filter(
      (user) =>
        (!status || user.status === status) &&
        (!term ||
          [user.username, user.fullName, user.email].some((field) =>
            field.toLowerCase().includes(term)
          ))
    )
    return send(res, 200, adminPage(rows))
  }

  // --- misc, harmless empties ---------------------------------------------
  if (path.startsWith("/dietary/") || path.startsWith("/recipes") || path.startsWith("/billing/")) {
    return send(res, 200, pageOf([]))
  }

  console.warn(`[mock-api] unhandled ${method} ${url.pathname}${url.search}`)
  return error(res, 404, "NOT_FOUND", `Mock API has no handler for ${method} ${url.pathname}`)
}

const server = http.createServer(async (req, res) => {
  cors(res, req)
  if (req.method === "OPTIONS") return send(res, 204)
  const url = new URL(req.url ?? "/", `http://localhost:${API_PORT}`)
  if (url.pathname === "/health") return send(res, 200, { ok: true })
  if (!url.pathname.startsWith(PREFIX)) return send(res, 404, { message: "not found" })
  try {
    await handle(req, res, url, req.method === "GET" ? {} : await readJson(req))
  } catch (err) {
    console.error("[mock-api] failure", err)
    if (!res.headersSent) send(res, 500, { message: "mock failure" })
  }
})

server.listen(API_PORT, () =>
  console.log(`[mock-api] listening on http://localhost:${API_PORT}${PREFIX}`)
)
