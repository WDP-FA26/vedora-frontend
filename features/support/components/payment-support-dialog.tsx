"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { usePayment } from "@/features/billing/hooks"
import { dateTime, money, paymentStatus, type Payment } from "@/features/billing/schema"
import { ApiError } from "@/features/shared/lib/api-client"
import { SUPPORT_PATH, supportTicketPath } from "../support-cache"
import {
  CreateSupportTicketDialog,
  type SupportTicketPrefill,
} from "./create-support-ticket-dialog"

function paymentPrefill(payment: Payment): SupportTicketPrefill {
  return {
    category: "PAYMENT_ISSUE",
    subject: "Đã chuyển tiền nhưng chưa được xác nhận",
    referenceCode: payment.paymentCode,
    message: [
      "Tôi đã chuyển tiền cho đơn sau nhưng chưa được xác nhận:",
      `Mã đơn: ${payment.invoiceNumber}`,
      `ID đơn: ${payment.id}`,
      `Mã thanh toán: ${payment.paymentCode}`,
      `Gói: ${payment.purchasedPlanName}`,
      `Số tiền của đơn: ${money(payment.amount)}`,
      `Đơn tạo lúc: ${dateTime(payment.createdAt)} (UTC+7)`,
      `Trạng thái đơn khi mở yêu cầu: ${paymentStatus[payment.status]}`,
      "",
      "Thông tin giao dịch thực tế (vui lòng bổ sung):",
      "Thời điểm chuyển tiền: ",
      "Mã giao dịch ngân hàng/ví: ",
      "Số tiền đã chuyển: ",
      "Ngân hàng/ví đã sử dụng: ",
    ].join("\n"),
  }
}

export function PaymentSupportDialog({ paymentId }: { paymentId: string }) {
  const router = useRouter()
  const payment = usePayment(paymentId)
  const close = () => router.replace(SUPPORT_PATH)

  if (payment.data && !payment.error && payment.data.status !== "SUCCEEDED") {
    return (
      <CreateSupportTicketDialog
        open
        onOpenChange={(open) => {
          if (!open) close()
        }}
        initialValues={paymentPrefill(payment.data)}
        onCreated={(id) => router.replace(supportTicketPath(id))}
        description="Thông tin đơn đã được điền sẵn. Hãy bổ sung thời điểm chuyển tiền, mã giao dịch và ảnh biên lai nếu có, rồi gửi yêu cầu để quản trị viên đối soát."
      />
    )
  }

  let description = "Đang tải thông tin đơn thanh toán của bạn…"
  if (payment.error) {
    description =
      payment.error instanceof ApiError && [403, 404].includes(payment.error.status)
        ? "Không tìm thấy đơn thanh toán thuộc tài khoản của bạn."
        : "Không tải được thông tin đơn thanh toán. Vui lòng thử lại."
  } else if (payment.data?.status === "SUCCEEDED") {
    description =
      "Đơn này đã được xác nhận thanh toán. Bạn có thể xem gói hiện tại hoặc quay lại trang hỗ trợ nếu cần trợ giúp khác."
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Hỗ trợ thanh toán</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {!payment.error && !payment.data && <Spinner aria-label="Đang tải đơn thanh toán" />}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={close}>
            Về trang hỗ trợ
          </Button>
          {payment.error && (
            <Button
              disabled={payment.isValidating}
              onClick={() => {
                void payment.mutate().catch(() => undefined)
              }}
            >
              Thử lại
            </Button>
          )}
          {payment.data?.status === "SUCCEEDED" && (
            <Link className={buttonVariants()} href="/billing">Xem gói hiện tại</Link>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
