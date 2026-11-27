import { posts, users } from "./data.mjs"

const iso = (minutesAgo) => new Date(Date.now() - minutesAgo * 60_000).toISOString()
const day = (daysAgo) => new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10)
const author = (user) => ({
  id: user.id,
  username: user.username,
  fullName: user.fullName,
  avatarUrl: user.avatarUrl ?? null,
})

export const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
)

const peer = (user, isProfessional = false) => ({
  id: user.id,
  username: user.username,
  fullName: user.fullName,
  avatarUrl: null,
  isProfessional,
})

export const CONVERSATION_ID = "c0000000-0000-4000-8000-000000000001"

export const conversation = {
  id: CONVERSATION_ID,
  peer: peer(users.chef, true),
  box: "friends",
  requestDirection: null,
  followsPeer: true,
  peerFollowsYou: true,
  canSend: true,
  lastMessage: {
    id: "m-2",
    senderId: users.chef.id,
    body: "Hẹn bạn cuối tuần nhé!",
    createdAt: iso(10),
  },
  unreadCount: 2,
  myReadSequence: 0,
  peerReadSequence: 1,
}

export const messages = [
  {
    id: "m-1",
    conversationId: CONVERSATION_ID,
    senderId: users.member.id,
    recipientId: users.chef.id,
    clientMessageId: "cm-1",
    sequence: 1,
    body: "Chào bạn, công thức phở chay của bạn rất hay.",
    createdAt: iso(30),
  },
  {
    id: "m-2",
    conversationId: CONVERSATION_ID,
    senderId: users.chef.id,
    recipientId: users.member.id,
    clientMessageId: "cm-2",
    sequence: 2,
    body: "Hẹn bạn cuối tuần nhé!",
    createdAt: iso(10),
  },
]

const recipe = (id, title) => ({
  id,
  title,
  imageUrl: null,
  servings: 2,
  prepMinutes: 10,
  cookMinutes: 20,
  ingredients: [{ name: "Đậu hũ", quantity: 300, unit: "g", note: null }],
  steps: ["Chiên đậu hũ.", "Rim với cà chua."],
})

export const MOCK_WEEK = "2026-11-16"
export const MOCK_NEXT_WEEK = "2026-11-23"
const MOCK_TODAY = "2026-11-18"

const addDays = (date, days) => {
  const [year, month, day] = date.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

export const weekFields = (weekStart = MOCK_WEEK) => ({
  weekStart,
  currentWeekStart: MOCK_WEEK,
  today: MOCK_TODAY,
  minWeekStart: MOCK_WEEK,
  maxWeekStart: "2026-12-14",
  editable: true,
})

const emptyDay = (dayCode, index = 0, weekStart = MOCK_WEEK) => ({
  day: dayCode,
  date: addDays(weekStart, index),
  editable: addDays(weekStart, index) >= MOCK_TODAY,
  sections: ["BREAKFAST", "LUNCH", "DINNER", "OTHER"].map((section) => ({ section, recipes: [] })),
})

export const WEEKDAY_CODES = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]

export const emptyMealPlan = { ...weekFields(), days: WEEKDAY_CODES.map((code, index) => emptyDay(code, index)), problems: [] }

export const emptyMealPlanOf = (weekStart) => ({
  ...weekFields(weekStart),
  days: WEEKDAY_CODES.map((code, index) => emptyDay(code, index, weekStart)),
  problems: [],
})

export const filledMealPlan = {
  ...weekFields(),
  days: WEEKDAY_CODES.map((code, index) => ({
    ...emptyDay(code, index),
    day: code,
    sections: [
      { section: "BREAKFAST", recipes: [recipe("r-1", "Cháo nấm")] },
      { section: "LUNCH", recipes: [recipe("r-2", "Đậu hũ sốt cà chua")] },
      { section: "DINNER", recipes: [] },
      { section: "OTHER", recipes: [] },
    ],
  })),
  problems: [],
}

export const myDietary = {
  allergies: ["Dị ứng đậu phộng"],
  preferences: ["Thích nấm hương"],
}

export const shoppingList = {
  weekStart: MOCK_WEEK,
  days: ["MON"],
  quantityBasis: "RECIPE_PER_OCCURRENCE",
  items: [
    {
      ingredientId: "i-9",
      name: "Đậu hũ",
      unit: "g",
      knownQuantity: "300.00",
      hasUnknownQuantity: false,
      contributions: [
        {
          recipeId: "r-2",
          recipeTitle: "Đậu hũ sốt cà chua",
          day: "MON",
          section: "LUNCH",
          servings: 2,
          quantity: "300.00",
          note: null,
        },
      ],
    },
  ],
}

export const PAYMENT_IDS = {
  pending: "11111111-1111-4111-8111-111111111111",
  succeeded: "22222222-2222-4222-8222-222222222222",
  cancelled: "33333333-3333-4333-8333-333333333333",
}

export const QR_IMAGE = "https://vietqr.app/qr/pending.png"

export function payment(status, id) {
  const base = {
    id,
    planCode: "PLUS",
    amount: "99000",
    currency: "VND",
    durationDays: 30,
    planVersion: 2,
    purchasedPlanName: "Plus",
    textLimit: 100,
    imageLimit: 10,
    status,
    invoiceNumber: `INV-${status}`,
    paymentCode: "VEDORA12345",
    createdAt: new Date(Date.now() - 600_000).toISOString(),
    expiresAt: new Date(Date.now() + 1_200_000).toISOString(),
    serverTime: new Date().toISOString(),
    cancellationReason: status === "CANCELLED" ? "USER" : null,
    paidAt: null,
    capturedAt: null,
    cancelledAt: null,
    qr: null,
  }
  if (status === "PENDING") {
    base.qr = {
      bankCode: "MB",
      bankGateway: "MBBank",
      accountNumber: "0123456789",
      accountHolder: "CONG TY VEDORA",
      storeName: "Vedora",
      transferContent: "VEDORA12345",
      amount: "99000",
      currency: "VND",
      imageUrl: QR_IMAGE,
      downloadUrl: "https://vietqr.app/qr/pending.png?download=1",
    }
  }
  if (status === "SUCCEEDED") {
    base.paidAt = new Date().toISOString()
    base.capturedAt = new Date().toISOString()
  }
  if (status === "CANCELLED") base.cancelledAt = new Date().toISOString()
  return base
}

export const billingCatalog = {
  planVersion: 2,
  freeLimits: { textLimit: 10, imageLimit: 0 },
  paymentsEnabled: true,
  plans: [
    { code: "PLUS", name: "Plus", priceVnd: "99000", durationDays: 30, textLimit: 100, imageLimit: 10 },
    { code: "PRO", name: "Pro", priceVnd: "199000", durationDays: 30, textLimit: 300, imageLimit: 40 },
  ],
}

const allowance = (used, limit) => ({
  used,
  limit,
  remaining: Math.max(0, limit - used),
  resetsAt: new Date(Date.now() + 86_400_000).toISOString(),
  period: "DAY",
})

export const billingOverview = {
  membership: { planCode: "FREE", startsAt: null, expiresAt: null },
  usage: { text: allowance(3, 10), images: allowance(0, 0) },
  pendingPayment: null,
  recentPayments: [payment("SUCCEEDED", PAYMENT_IDS.succeeded)],
}

export const RECIPE_ID = "e0000000-0000-4000-8000-000000000001"

export const recipeSummary = {
  id: RECIPE_ID,
  title: "Đậu hũ sốt cà chua",
  imageUrl: null,
  servings: 2,
  prepMinutes: 10,
  cookMinutes: 20,
  ingredientCount: 2,
  conflicts: [],
  post: null,
  updatedAt: iso(120),
}

export const recipeDetail = {
  ...recipeSummary,
  description: "Món chay đơn giản cho bữa tối.",
  steps: ["Chiên đậu hũ.", "Rim với cà chua."],
  ingredients: [
    { ingredientId: "i-1", name: "Đậu hũ", quantity: 300, unit: "g", note: null },
    { ingredientId: "i-3", name: "Cà chua", quantity: 2, unit: "quả", note: "cắt múi cau" },
  ],
}

export const ingredients = [
  { id: "i-1", name: "Đậu hũ", aliases: ["tofu"], groups: [], recipeCount: 1, createdAt: iso(500) },
  { id: "i-3", name: "Cà chua", aliases: [], groups: [], recipeCount: 1, createdAt: iso(500) },
]

export const ingredientGroups = [
  {
    id: "g-1",
    name: "Hạt",
    description: null,
    dietary: true,
    ingredients: [{ id: "i-1", name: "Đậu hũ" }],
    createdAt: iso(500),
  },
]

export const rules = [
  {
    id: "rule-1",
    a: { kind: "INGREDIENT", id: "i-1", name: "Đậu hũ" },
    b: { kind: "INGREDIENT", id: "i-3", name: "Cà chua" },
    reason: "Không nên ăn cùng nhau (ví dụ kiểm thử).",
    source: null,
    createdAt: iso(400),
  },
]

export const PROOF_URL = "http://localhost:9000/vedora/proofs/proof-1.png"

export const verificationRequest = (status, extra = {}) => ({
  id: "v-1",
  statement: "Tôi là đầu bếp chay 5 năm kinh nghiệm tại nhà hàng Sen.",
  status,
  reviewNote: null,
  reviewedAt: null,
  createdAt: iso(1000),
  proofCount: 2,
  ...extra,
})

export const adminVerificationRequests = [
  {
    ...verificationRequest("PENDING"),
    user: { ...author(users.chef), email: users.chef.email },
  },
  {
    ...verificationRequest("APPROVED", { id: "v-2", reviewedAt: iso(500) }),
    user: { ...author(users.member), email: users.member.email },
  },
]

export const KNOWLEDGE_ID = "k0000000-0000-4000-8000-000000000001"

export const knowledgeDocument = (overrides = {}) => ({
  id: KNOWLEDGE_ID,
  title: "Dinh dưỡng thực vật.pdf",
  contentType: "application/pdf",
  status: "AWAITING_REVIEW",
  failureReason: null,
  sectionCount: 2,
  imageCount: 0,
  sizeBytes: 2_048_000,
  reviewedById: null,
  reviewedAt: null,
  reviewNote: null,
  createdAt: iso(300),
  ...overrides,
})

export const knowledgeDocuments = [
  knowledgeDocument(),
  knowledgeDocument({ id: "k0000000-0000-4000-8000-000000000002", title: "Protein từ đậu.pdf", status: "READY" }),
]

export const knowledgePages = [
  { page: 1, text: "Trang một: đạm thực vật.", flags: [], edited: false },
  { page: 2, text: "Trang hai: vi chất.", flags: ["TEXT_LAYER_ADDED"], edited: false },
]

export const adminPost = (id, status, by, body, extra = {}) => ({
  id,
  type: "POST",
  status,
  body,
  blog: null,
  moderation: null,
  publishedAt: status === "PUBLISHED" ? iso(60) : null,
  createdAt: iso(90),
  author: { ...author(by), avatarUrl: null },
  media: [],
  commentCount: 1,
  likeCount: 2,
  repostCount: 0,
  viewCount: 10,
  ...extra,
})

const heldModeration = {
  verdict: "spam",
  riskLevel: 2,
  checkedAt: iso(80),
  reviewedById: null,
  reviewedAt: null,
  reviewNote: null,
}

export const adminPosts = [
  adminPost("p-1", "PUBLISHED", users.chef, posts[0].body),
  adminPost("p-held", "PENDING_REVIEW", users.member, "Bài chờ duyệt thủ công", { moderation: heldModeration }),
  adminPost("p-blocked", "REJECTED", users.member, "Bài bị chặn", {
    moderation: {
      ...heldModeration,
      riskLevel: 3,
      evidence: {
        status: "READY",
        summary: "Bài quảng cáo lặp lại, kèm liên kết bán hàng.",
        items: [
          {
            field: "body",
            category: "spam",
            reason: "Lời mời mua hàng không liên quan tới ẩm thực.",
            quote: "Bài bị chặn",
            start: 0,
            end: 11,
            mediaId: null,
            seconds: null,
            imageUrl: null,
          },
        ],
        dropped: 0,
        model: "anthropic/claude-haiku",
        createdAt: iso(80),
      },
    },
  }),
]

export const adminReports = [
  {
    id: "rep-1",
    postId: "p-1",
    reason: "SPAM",
    details: "Quảng cáo trá hình",
    status: "PENDING",
    createdAt: iso(40),
    reviewedAt: null,
    reporter: author(users.member),
    post: { id: "p-1", body: posts[0].body, author: author(users.chef) },
  },
]

export const moderationSettings = {
  instructions: "Chặn nội dung độc hại.",
  allowDescription: "Nội dung ẩm thực bình thường.",
  choices: [
    { key: "spam", label: "Spam", reasonText: "spam hoặc quảng cáo", description: "Quảng cáo, lừa đảo." },
    { key: "violence", label: "Bạo lực", reasonText: "bạo lực", description: "Hình ảnh, lời lẽ bạo lực." },
  ],
  version: 3,
  updatedAt: iso(2000),
  updatedById: users.admin.id,
  isDefault: false,
}

export const dashboard = (from, to) => ({
  generatedAt: new Date().toISOString(),
  range: { from, to, timeZone: "Asia/Bangkok", dayCount: 30 },
  snapshot: {
    members: { total: 120, active: 100, suspended: 3, pendingEmail: 17 },
    pendingReports: 4,
  },
  period: {
    newMembers: 25,
    publishedContent: { posts: 40, blogs: 6, total: 46 },
    recipesCreated: 8,
    reportsCreated: 5,
    reportDecisions: { resolved: 2, dismissed: 1, total: 3 },
  },
  daily: [
    {
      date: day(1),
      newMembers: 2,
      publishedPosts: 3,
      publishedBlogs: 1,
      reportsCreated: 0,
      resolvedReports: 0,
      dismissedReports: 0,
    },
  ],
  unavailableMetrics: ["CONTENT_APPROVALS"],
})

const costMetrics = {
  calls: 10,
  knownCalls: 8,
  unknownCalls: 1,
  duplicateCalls: 0,
  pendingCalls: 1,
  failedCalls: 0,
  knownSpendUsd: "1.234500",
  inputTokens: 1000,
  outputTokens: 500,
  reasoningTokens: 0,
  cachedTokens: 0,
  unknownTokenCalls: 0,
}

export const aiCostReport = (from, to) => ({
  generatedAt: new Date().toISOString(),
  currency: "USD",
  scope: "MATCHED_CALLS",
  range: { from, to, timeZone: "Asia/Bangkok", dayCount: 30 },
  summary: { ...costMetrics, turns: 5, fullyPricedTurns: 4, meanKnownTurnUsd: "0.2", p95KnownTurnUsd: "0.5" },
  daily: [{ ...costMetrics, date: day(1) }],
  groups: [{ ...costMetrics, model: "test-model", feature: "MEAL_PLAN_CHAT", operation: "chat" }],
  groupsLimit: 50,
  expensiveTurns: [],
})

export const aiCostCalls = {
  items: [
    {
      id: "c1111111-1111-4111-8111-111111111111",
      turnId: "turn-1",
      executionId: "exec-1",
      userId: null,
      feature: "MEAL_PLAN_CHAT",
      operation: "chat",
      requestedModel: "test-model",
      resolvedModel: "test-model",
      provider: "test",
      generationId: "gen-1",
      status: "SUCCEEDED",
      httpStatus: 200,
      costUsd: "0.100000",
      costSource: "RESPONSE",
      duplicateCharge: false,
      inputTokens: 100,
      outputTokens: 50,
      reasoningTokens: 0,
      cachedTokens: 0,
      startedAt: iso(30),
      finishedAt: iso(29),
      reconciledAt: null,
    },
  ],
  total: 1,
  page: 1,
  limit: 25,
}

export const ORDER_ID = "44444444-4444-4444-8444-444444444444"

export const adminOrder = (overrides = {}) => ({
  id: ORDER_ID,
  userId: "55555555-5555-4555-8555-555555555555",
  customer: {
    id: "55555555-5555-4555-8555-555555555555",
    username: "minhanh",
    fullName: "Nguyễn Minh Anh",
    email: "minhanh@example.com",
    status: "ACTIVE",
  },
  planCode: "PLUS",
  originalPlanCode: "PLUS",
  planVersion: 2,
  purchasedPlanName: "Plus",
  durationDays: 30,
  textLimit: 100,
  imageLimit: 10,
  amount: "99000",
  currency: "VND",
  status: "SUCCEEDED",
  invoiceNumber: "INV-2026-0001",
  paymentCode: "VEDORA12345",
  providerTransactionId: "tx-1",
  providerReference: "ref-1",
  createdAt: iso(600),
  capturedAt: iso(590),
  paidAt: iso(591),
  cancelledAt: null,
  subscriptionExpiresAt: new Date(Date.now() + 25 * 86_400_000).toISOString(),
  ...overrides,
})

export const paymentOverview = (from, to) => ({
  generatedAt: new Date().toISOString(),
  currency: "VND",
  range: { from, to, timeZone: "Asia/Bangkok", dayCount: 30 },
  orderDateBasis: "createdAt",
  revenueDateBasis: "capturedAt",
  createdOrders: { total: 3, PENDING: 1, SUCCEEDED: 1, CANCELLED: 1 },
  captured: {
    count: 1,
    totalVnd: "99000",
    buyers: 1,
    byPlan: [{ planCode: "PLUS", count: 1, totalVnd: "99000", buyers: 1 }],
  },
  daily: [{ date: day(1), createdOrders: 2, capturedOrders: 1, confirmedVnd: "99000" }],
  membershipSnapshot: {
    asOf: new Date().toISOString(),
    scope: "GLOBAL_ACTIVE_VERIFIED_ACCOUNTS",
    PLUS: 4,
    PRO: 2,
    total: 6,
  },
})

export const paymentDetail = {
  order: adminOrder(),
  merchant: { bankCode: "MB", bankGateway: "MBBank", accountLast4: "6789" },
  currentMembership: {
    planCode: "PLUS",
    startsAt: iso(590),
    expiresAt: new Date(Date.now() + 25 * 86_400_000).toISOString(),
    isCurrentPurchase: true,
  },
  webhookSummary: { total: 1, outcomes: [{ outcome: "CAPTURED", count: 1 }] },
}

export const receipt = {
  id: "66666666-6666-4666-8666-666666666666",
  intentId: ORDER_ID,
  providerTransactionId: "tx-1",
  payloadHash: "abc123",
  outcome: "CAPTURED",
  createdAt: iso(590),
}
