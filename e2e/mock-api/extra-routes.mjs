// Routes for the areas beyond auth/posts/profiles/notifications: messaging,
// meal plan, dietary, billing, recipes, verification, knowledge and the admin
// screens. Returns true when it answered the request.

import { pageOf, users } from "../fixtures/data.mjs"
import {
  CONVERSATION_ID,
  ORDER_ID,
  PAYMENT_IDS,
  PROOF_URL,
  RECIPE_ID,
  adminOrder,
  adminPosts,
  adminReports,
  adminVerificationRequests,
  aiCostCalls,
  aiCostReport,
  billingCatalog,
  billingOverview,
  conversation,
  dashboard,
  dietaryOptions,
  emptyMealPlan,
  ingredientGroups,
  ingredients,
  knowledgeDocuments,
  knowledgePages,
  messages,
  moderationSettings,
  myDietary,
  payment,
  paymentDetail,
  paymentOverview,
  receipt,
  recipeDetail,
  recipeSummary,
  rules,
  shoppingList,
  verificationRequest,
} from "../fixtures/data-extra.mjs"

const adminPage = (items) => ({ items, meta: { hasNextPage: false } })
const requireAdmin = (me) => me?.role === "ADMIN"

export async function handleExtra({ path, method, body, q, me, res, send, error }) {
  const ok = (data, status = 200) => (send(res, status, data), true)
  const fail = (...args) => (error(res, ...args), true)
  let m

  // --- messaging ---------------------------------------------------------
  if (path === "/messaging/unread-count") return ok({ unreadCount: conversation.unreadCount })
  if (path === "/messaging/conversations") {
    return ok(pageOf(q.get("box") === "requests" ? [] : [conversation]))
  }
  if ((m = /^\/messaging\/conversations\/([^/]+)(\/messages|\/read)?$/.exec(path))) {
    if (m[1] !== CONVERSATION_ID) return fail(404, "NOT_FOUND", "Conversation not found")
    if (!m[2]) return ok(conversation)
    if (m[2] === "/read") {
      return ok({ conversationId: CONVERSATION_ID, readSequence: 2, unreadCount: 0 })
    }
    if (method === "POST") {
      return ok(
        {
          conversationId: CONVERSATION_ID,
          message: {
            id: "m-new",
            conversationId: CONVERSATION_ID,
            senderId: me?.id ?? users.member.id,
            recipientId: users.chef.id,
            clientMessageId: body.clientMessageId,
            sequence: 3,
            body: body.body,
            createdAt: new Date().toISOString(),
          },
        },
        201
      )
    }
    return ok(pageOf(messages))
  }
  if ((m = /^\/messaging\/users\/([^/]+)(\/messages)?$/.exec(path))) {
    const peerUser = Object.values(users).find((user) => user.id === m[1])
    if (!peerUser) return fail(404, "NOT_FOUND", "User not found")
    if (m[2]) {
      return ok(
        {
          conversationId: CONVERSATION_ID,
          message: {
            id: "m-first",
            conversationId: CONVERSATION_ID,
            senderId: me?.id ?? users.member.id,
            recipientId: peerUser.id,
            clientMessageId: body.clientMessageId,
            sequence: 1,
            body: body.body,
            createdAt: new Date().toISOString(),
          },
        },
        201
      )
    }
    return ok({
      peer: {
        id: peerUser.id,
        username: peerUser.username,
        fullName: peerUser.fullName,
        avatarUrl: null,
        isProfessional: false,
      },
      conversationId: null,
      box: "friends",
      followsPeer: true,
      peerFollowsYou: true,
      canSend: true,
    })
  }

  // --- meal plan and dietary ---------------------------------------------
  if (path === "/meal-plan" && method === "GET") return ok(emptyMealPlan)
  if (path === "/meal-plan/days" && method === "PUT") return ok(emptyMealPlan)
  if (path === "/meal-plan/shopping-list") return ok(shoppingList)
  if (path === "/dietary/options") return ok(dietaryOptions)
  if (path === "/dietary/me") {
    if (method === "PUT") {
      return ok({
        ingredients: dietaryOptions.ingredients.filter((i) => body.ingredientIds?.includes(i.id)),
        groups: dietaryOptions.groups.filter((g) => body.groupIds?.includes(g.id)),
        liked: dietaryOptions.ingredients.filter((i) => body.likedIngredientIds?.includes(i.id)),
      })
    }
    return ok(myDietary)
  }

  // --- billing -----------------------------------------------------------
  if (path === "/billing/plans") return ok(billingCatalog)
  if (path === "/billing/me") return ok(billingOverview)
  if (path === "/billing/payment-intents" && method === "POST") {
    return ok(payment("PENDING", PAYMENT_IDS.pending), 201)
  }
  if ((m = /^\/payment-intents\/([^/]+)(\/cancel)?$/.exec(path))) {
    const status = Object.entries(PAYMENT_IDS).find(([, id]) => id === m[1])?.[0]
    if (!status) return fail(404, "NOT_FOUND", "Payment not found")
    if (m[2]) return ok(payment("CANCELLED", m[1]))
    return ok(payment(status.toUpperCase(), m[1]))
  }

  // --- recipes (public) ---------------------------------------------------
  if (path === "/recipes/favorites") {
    return ok({ items: [], meta: { page: 1, totalItems: 0, totalPages: 1 } })
  }
  if (path === "/recipes" && method === "GET") {
    return ok(adminPage([{ ...recipeSummary, isFavorite: false }]))
  }
  if ((m = /^\/recipes\/([^/]+)(\/ratings\/summary|\/rating|\/favorite)?$/.exec(path))) {
    if (m[1] !== RECIPE_ID) return fail(404, "NOT_FOUND", "Recipe not found")
    if (m[2] === "/ratings/summary") return ok({ recipeId: RECIPE_ID, ratingCount: 3, averageRating: 4.5 })
    if (m[2] === "/rating") {
      return ok({ recipeId: RECIPE_ID, ratingCount: 3, averageRating: 4.5, myRating: null })
    }
    if (m[2] === "/favorite") return ok({ recipeId: RECIPE_ID, isFavorite: method === "PUT" })
    return ok({ ...recipeDetail, isFavorite: false })
  }

  // --- recipes (admin) ----------------------------------------------------
  if (path.startsWith("/admin/") && !requireAdmin(me)) {
    return fail(me ? 403 : 401, me ? "FORBIDDEN" : "UNAUTHORIZED", "Not allowed")
  }
  if (path === "/admin/ingredients") return ok(adminPage(ingredients))
  if (path === "/admin/ingredient-groups") return ok(adminPage(ingredientGroups))
  if (path === "/admin/incompatibility-rules") return ok(adminPage(rules))
  if (path === "/admin/recipes/conflicts") return ok([])
  if (path === "/admin/recipes" && method === "GET") return ok(adminPage([recipeSummary]))
  if (path === "/admin/recipes" && method === "POST") return ok({ ...recipeDetail, ...body, id: "new" }, 201)
  if ((m = /^\/admin\/recipes\/([^/]+)$/.exec(path))) {
    if (m[1] !== RECIPE_ID) return fail(404, "NOT_FOUND", "Recipe not found")
    if (method === "PUT") return ok({ ...recipeDetail, title: body.title })
    return ok(recipeDetail)
  }

  // --- verification -------------------------------------------------------
  if (path === "/verification/me") {
    return ok({ isProfessional: me?.id === users.chef.id, request: null })
  }
  if (path === "/verification/proofs/uploads") {
    return ok({
      id: "proof-1",
      upload: { url: "http://localhost:9000/vedora/proofs", method: "PUT", headers: {}, expiresAt: new Date(Date.now() + 9e5).toISOString() },
    })
  }
  if (path === "/verification/requests" && method === "POST") {
    return ok(verificationRequest("PENDING", { statement: body.statement }), 201)
  }
  if (path === "/verification/requests" && method === "GET") {
    return ok(adminPage(adminVerificationRequests))
  }
  if ((m = /^\/verification\/requests\/([^/]+)(\/review)?$/.exec(path))) {
    const found = adminVerificationRequests.find((request) => request.id === m[1])
    if (!found) return fail(404, "NOT_FOUND", "Request not found")
    if (m[2]) {
      return ok({
        ...found,
        status: body.decision,
        reviewNote: body.note ?? null,
        reviewedAt: new Date().toISOString(),
      })
    }
    return ok({ ...found, proofs: [{ id: "pf-1", url: PROOF_URL }] })
  }

  // --- knowledge ----------------------------------------------------------
  if (path === "/knowledge/documents" && method === "GET") return ok(knowledgeDocuments)
  if ((m = /^\/knowledge\/documents\/([^/]+)(?:\/(pages|file-url|approve|reject|reopen))?(?:\/(\d+))?$/.exec(path))) {
    const doc = knowledgeDocuments.find((item) => item.id === m[1])
    if (!doc) return fail(404, "NOT_FOUND", "Document not found")
    if (m[2] === "pages") {
      if (method === "PATCH") return ok({}, 200)
      return ok(knowledgePages)
    }
    if (m[2] === "file-url") {
      return ok({ url: "http://localhost:9000/vedora/knowledge/doc.pdf", expiresAt: new Date(Date.now() + 9e5).toISOString() })
    }
    if (m[2] === "approve") return ok({ ...doc, status: "INDEXING" })
    if (m[2] === "reject") return ok({ ...doc, status: "REJECTED", reviewNote: body.note ?? null })
    if (m[2] === "reopen") return ok({ ...doc, status: "AWAITING_REVIEW" })
    if (method === "DELETE") return send(res, 204) || true
    return ok(doc)
  }

  // --- admin: content, reports, settings ---------------------------------
  if (path === "/admin/posts") return ok(adminPage(adminPosts))
  if ((m = /^\/admin\/posts\/([^/]+)(\/moderation)?$/.exec(path))) {
    const found = adminPosts.find((item) => item.id === m[1])
    if (!found) return fail(404, "NOT_FOUND", "Post not found")
    if (m[2]) {
      return ok({ ...found, status: body.decision === "APPROVE" ? "PUBLISHED" : "REJECTED" })
    }
    if (method === "DELETE") return send(res, 204) || true
    return ok(found)
  }
  if (path === "/admin/reports") return ok(adminPage(adminReports))
  if ((m = /^\/admin\/reports\/([^/]+)\/review$/.exec(path))) {
    return ok({ ...adminReports[0], status: body.status, reviewedAt: new Date().toISOString() })
  }
  if (path === "/admin/moderation/settings") {
    if (method === "PUT") return ok({ ...moderationSettings, ...body, version: moderationSettings.version + 1 })
    return ok(moderationSettings)
  }
  if (path === "/admin/moderation/settings/reset") {
    return ok({ ...moderationSettings, isDefault: true, version: 0 })
  }
  if (path === "/admin/moderation/settings/test") {
    return ok({ decision: "review", category: "spam", violationScore: 0.6, scores: { spam: 0.6 } })
  }

  // --- admin: dashboard, AI cost, payments -------------------------------
  if (path === "/admin/dashboard") return ok(dashboard(q.get("from"), q.get("to")))
  if (path === "/admin/ai-costs") return ok(aiCostReport(q.get("from"), q.get("to")))
  if (path === "/admin/ai-costs/calls") return ok(aiCostCalls)
  if (path === "/admin/payments/overview") return ok(paymentOverview(q.get("from"), q.get("to")))
  if (path === "/admin/payments/orders") {
    return ok({ items: [adminOrder(), adminOrder({ id: "77777777-7777-4777-8777-777777777777", status: "PENDING", invoiceNumber: "INV-2026-0002", capturedAt: null })], total: 2, page: 1, limit: 25 })
  }
  if (path === "/admin/payments/subscriptions") {
    return ok({ items: [adminOrder()], total: 1, page: 1, limit: 25, asOf: new Date().toISOString() })
  }
  if (path === "/admin/payments/receipts" || path === "/admin/payments/webhooks") {
    return ok({ items: [receipt], total: 1, page: 1, limit: 25 })
  }
  if ((m = /^\/admin\/payments\/orders\/([^/]+)(\/receipts)?$/.exec(path))) {
    if (m[1] !== ORDER_ID) return fail(404, "NOT_FOUND", "Order not found")
    if (m[2]) return ok({ items: [receipt], total: 1, page: 1, limit: 25 })
    return ok(paymentDetail)
  }

  return false
}
