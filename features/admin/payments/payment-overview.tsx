import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { money, planLabel, timestamp, type PaymentOverview } from "./schema";

export function PaymentOverviewCards({ data }: { data: PaymentOverview }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [
            "Tiền đã xác nhận theo bộ lọc",
            money(data.captured.totalVnd),
            `${data.captured.count} đơn · ${data.captured.buyers} người trả tiền · ngày xác nhận`,
          ],
          [
            "Đơn được tạo theo bộ lọc",
            String(data.createdOrders.total),
            `${data.createdOrders.PENDING} chờ · ${data.createdOrders.SUCCEEDED} thành công · ${data.createdOrders.CANCELLED} hủy`,
          ],
          [
            "Plus còn hạn toàn hệ thống",
            String(data.membershipSnapshot.PLUS),
            "Tài khoản hoạt động, email đã xác minh",
          ],
          [
            "Pro còn hạn toàn hệ thống",
            String(data.membershipSnapshot.PRO),
            "Tính từ lần mua thành công mới nhất của mỗi người",
          ],
        ].map(([label, value, note]) => (
          <Card key={label}>
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle>{value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{note}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Ảnh chụp gói còn hạn tại {timestamp(data.membershipSnapshot.asOf)}{" "}
        (UTC+7), độc lập bộ lọc đơn. Tiền đã xác nhận là tổng VND ghi nhận, chưa
        trừ phí, thuế hoặc hoàn tiền bên ngoài hệ thống.
      </p>
      {data.captured.byPlan.length > 0 && (
        <div className="flex flex-wrap gap-4 text-sm">
          {data.captured.byPlan.map((plan) => (
            <p key={plan.planCode}>
              {planLabel(plan.planCode)}:{" "}
              <strong>{money(plan.totalVnd)}</strong> · {plan.count} đơn
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
