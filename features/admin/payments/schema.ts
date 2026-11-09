import { z } from "zod";

const count = z.number().int().nonnegative();
const integerMoney = z.string().regex(/^\d+$/);
const plan = z.enum(["PLUS", "PRO"]);
export const orderStatus = z.enum(["PENDING", "SUCCEEDED", "CANCELLED"]);
const customer = z.object({
  id: z.uuid(),
  username: z.string(),
  fullName: z.string(),
  email: z.string(),
  status: z.string(),
});
export const adminOrderSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  customer: customer.nullable(),
  planCode: plan,
  originalPlanCode: z.string(),
  planVersion: z.union([z.literal(1), z.literal(2)]),
  purchasedPlanName: z.string(),
  durationDays: count,
  textLimit: count,
  imageLimit: count,
  amount: integerMoney,
  currency: z.string(),
  status: orderStatus,
  invoiceNumber: z.string(),
  paymentCode: z.string(),
  providerTransactionId: z.string().nullable(),
  providerReference: z.string().nullable(),
  createdAt: z.iso.datetime(),
  capturedAt: z.iso.datetime().nullable(),
  paidAt: z.iso.datetime().nullable(),
  cancelledAt: z.iso.datetime().nullable(),
  subscriptionExpiresAt: z.iso.datetime().nullable(),
});
const page = { total: count, page: count, limit: count };
export const ordersSchema = z.object({
  items: z.array(adminOrderSchema),
  ...page,
});
export const subscriptionsSchema = ordersSchema.extend({
  asOf: z.iso.datetime(),
});
export const receiptSchema = z.object({
  id: z.uuid(),
  intentId: z.uuid().nullable(),
  providerTransactionId: z.string(),
  payloadHash: z.string(),
  outcome: z.string(),
  createdAt: z.iso.datetime(),
});
export const receiptsSchema = z.object({
  items: z.array(receiptSchema),
  ...page,
});
export const paymentDetailSchema = z.object({
  order: adminOrderSchema,
  merchant: z.object({
    bankCode: z.string(),
    bankGateway: z.string(),
    accountLast4: z.string(),
  }),
  currentMembership: z.object({
    planCode: z.enum(["FREE", "PLUS", "PRO"]),
    startsAt: z.iso.datetime().nullable(),
    expiresAt: z.iso.datetime().nullable(),
    isCurrentPurchase: z.boolean(),
  }),
  webhookSummary: z.object({
    total: count,
    outcomes: z.array(z.object({ outcome: z.string(), count })),
  }),
});
export const paymentOverviewSchema = z.object({
  generatedAt: z.iso.datetime(),
  currency: z.literal("VND"),
  range: z.object({
    from: z.string(),
    to: z.string(),
    timeZone: z.literal("Asia/Bangkok"),
    dayCount: count,
  }),
  orderDateBasis: z.literal("createdAt"),
  revenueDateBasis: z.literal("capturedAt"),
  createdOrders: z.object({
    total: count,
    PENDING: count,
    SUCCEEDED: count,
    CANCELLED: count,
  }),
  captured: z.object({
    count,
    totalVnd: integerMoney,
    buyers: count,
    byPlan: z.array(
      z.object({
        planCode: plan,
        count,
        totalVnd: integerMoney,
        buyers: count,
      }),
    ),
  }),
  daily: z.array(
    z.object({
      date: z.string(),
      createdOrders: count,
      capturedOrders: count,
      confirmedVnd: integerMoney,
    }),
  ),
  membershipSnapshot: z.object({
    asOf: z.iso.datetime(),
    scope: z.literal("GLOBAL_ACTIVE_VERIFIED_ACCOUNTS"),
    PLUS: count,
    PRO: count,
    total: count,
  }),
});
export type AdminOrder = z.infer<typeof adminOrderSchema>;
export type PaymentOverview = z.infer<typeof paymentOverviewSchema>;
export type AdminReceipt = z.infer<typeof receiptSchema>;
export const statusLabels = {
  PENDING: "Chờ thanh toán",
  SUCCEEDED: "Đã xác nhận",
  CANCELLED: "Đã hủy",
} as const;
export const planLabel = (value: string) =>
  ({ FREE: "Miễn phí", PLUS: "Plus", PRO: "Pro" })[value] ?? value;
export const money = (value: string, currency = "VND") =>
  currency === "VND"
    ? new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
      }).format(BigInt(value))
    : `${value} ${currency}`;
export const timestamp = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Bangkok" })
    : "—";
export function queryString(values: Record<string, string | number>) {
  return new URLSearchParams(
    Object.entries(values)
      .filter(([, value]) => value !== "")
      .map(([key, value]) => [key, String(value)]),
  ).toString();
}
export const outcomeLabels: Record<string, string> = {
  CAPTURED: "Đã ghi nhận thanh toán và kích hoạt gói.",
  DUPLICATE:
    "Webhook gửi lại giao dịch đã ghi nhận; không kích hoạt thêm lần nữa.",
  NOT_INCOMING: "Giao dịch không phải tiền vào.",
  PAYMENT_CODE_MISSING: "Webhook thiếu mã thanh toán.",
  PAYMENT_INTENT_NOT_FOUND: "Không tìm thấy đơn tương ứng với mã thanh toán.",
  ACCOUNT_MISMATCH: "Ngân hàng hoặc tài khoản nhận không khớp đơn.",
  AMOUNT_MISMATCH: "Số tiền nhận không khớp số tiền của đơn.",
  TRANSACTION_ALREADY_USED: "Giao dịch đã được gắn với một đơn khác.",
  PAYMENT_INTENT_ALREADY_SUCCEEDED:
    "Đơn đã thành công; giao dịch này không kích hoạt thêm gói.",
  PAYMENT_CANCELLED: "Đơn đã hủy trước khi webhook được xử lý.",
  ACCOUNT_UNAVAILABLE:
    "Tài khoản không còn hoạt động hoặc chưa xác minh email.",
};
