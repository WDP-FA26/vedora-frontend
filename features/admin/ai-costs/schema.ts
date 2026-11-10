import { z } from "zod";

const count = z.number().int().nonnegative();
const usd = z
  .string()
  .refine((value) => Number.isFinite(Number(value)) && Number(value) >= 0);
const metrics = z.object({
  calls: count,
  knownCalls: count,
  unknownCalls: count,
  duplicateCalls: count,
  pendingCalls: count,
  failedCalls: count,
  knownSpendUsd: usd,
  inputTokens: count,
  outputTokens: count,
  reasoningTokens: count,
  cachedTokens: count,
  unknownTokenCalls: count,
});
export const costReportSchema = z.object({
  generatedAt: z.iso.datetime(),
  currency: z.literal("USD"),
  scope: z.literal("MATCHED_CALLS"),
  range: z.object({
    from: z.string(),
    to: z.string(),
    timeZone: z.literal("Asia/Bangkok"),
    dayCount: count,
  }),
  summary: metrics.extend({
    turns: count,
    fullyPricedTurns: count,
    meanKnownTurnUsd: usd.nullable(),
    p95KnownTurnUsd: usd.nullable(),
  }),
  daily: z.array(metrics.extend({ date: z.string() })),
  groups: z.array(
    metrics.extend({
      model: z.string(),
      feature: z.string(),
      operation: z.string(),
    }),
  ),
  groupsLimit: count,
  expensiveTurns: z.array(
    z.object({
      turnId: z.string(),
      knownSpendUsd: usd,
      userId: z.string().nullable(),
      feature: z.string(),
      calls: count,
      unknown: count,
      pending: count,
    }),
  ),
});
export const costCallSchema = z.object({
  id: z.uuid(),
  turnId: z.string(),
  executionId: z.string(),
  userId: z.string().nullable(),
  feature: z.string(),
  operation: z.string(),
  requestedModel: z.string(),
  resolvedModel: z.string().nullable(),
  provider: z.string().nullable(),
  generationId: z.string().nullable(),
  status: z.enum(["PENDING", "SUCCEEDED", "FAILED", "ABORTED"]),
  httpStatus: count.nullable(),
  costUsd: usd.nullable(),
  costSource: z.enum(["RESPONSE", "GENERATION"]).nullable(),
  duplicateCharge: z.boolean(),
  inputTokens: count.nullable(),
  outputTokens: count.nullable(),
  reasoningTokens: count.nullable(),
  cachedTokens: count.nullable(),
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
  reconciledAt: z.iso.datetime().nullable(),
});
export const costCallsSchema = z.object({
  items: z.array(costCallSchema),
  total: count,
  page: count,
  limit: count,
});
export type CostReport = z.infer<typeof costReportSchema>;
export const featureLabels: Record<string, string> = {
  MEAL_PLAN_CHAT: "Trợ lý thực đơn",
  BLOG_CHAT: "Trợ lý blog",
  GUEST_CHAT: "Chat dùng thử",
  CONTENT_MODERATION: "Kiểm duyệt",
  KNOWLEDGE: "Tài liệu kiến thức",
  POSTS: "Bài đăng",
  TRANSCRIPTION: "Phụ đề",
  SYSTEM: "Hệ thống",
};
export function dollars(value: string | null) {
  return value === null
    ? "Chưa có số liệu"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 6,
        maximumFractionDigits: 6,
      }).format(Number(value));
}
