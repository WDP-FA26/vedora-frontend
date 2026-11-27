# Ngày giờ Việt Nam trên frontend

Frontend hiển thị timestamp theo **Asia/Ho_Chi_Minh (UTC+7)**, dùng hằng số
`APP_TIME_ZONE` trong `features/shared/lib/date-time.ts`. Formatter dùng cùng múi
giờ trên server và browser, không phụ thuộc múi giờ máy người dùng.

## Phạm vi

- Bài viết, ngày tham gia hồ sơ, video cá nhân và ngày tuyệt đối của nhãn thời gian tương đối.
- Bảng người dùng, kiểm duyệt, báo cáo, dashboard tổng quan và nhật ký hệ thống.
- Tin nhắn, lịch sử chat thực đơn, hỗ trợ/kháng cáo.
- Thanh toán, thời điểm đặt lại quota ảnh blog và báo cáo chi phí AI.
- Ngày hiện tại, năm hiện tại và gợi ý bữa ăn trong thực đơn/hồ sơ dinh dưỡng.
- Ngày hiện tại và tuần xem trước trên landing page.

## Timestamp và ngày lịch

Timestamp API vẫn giữ nguyên ISO UTC (`Z`) và được chuyển múi giờ khi hiển thị.
Không cộng thủ công 7 giờ vào timestamp. Đồng hồ đếm ngược thanh toán và các phép
tính thời gian đã trôi qua vẫn dựa trên timestamp, không đổi theo múi giờ.

Chuỗi ngày lịch `YYYY-MM-DD` của thực đơn, lịch sử cân nặng và bộ lọc thống kê là
ngày người dùng đã chọn, không phải timestamp UTC cần chuyển múi giờ. Các phép
cộng ngày/tuần dùng UTC làm hệ tọa độ để giữ nguyên ngày lịch; không đổi chúng
sang phép cộng theo múi giờ thiết bị. Component lịch dùng `Date` của thư viện
vẫn giữ quy ước ngày lịch của thư viện.

Các response thống kê của BE vẫn khai báo `timeZone: "Asia/Bangkok"`. FE giữ
nguyên schema hợp đồng đó; Bangkok và Việt Nam cùng UTC+7 cho dữ liệu hiện tại.
Đợt sửa này không thay đổi BE, cấu hình production hoặc dữ liệu đã lưu.

## Bộ lọc nhật ký hệ thống

`vietnamDayBoundary(day, edge)` chuyển ngày được chọn thành biên UTC, bao gồm
cả đầu và cuối ngày. Ví dụ lọc ngày **01/01/2027**:

```text
from = 2026-12-31T17:00:00.000Z
to   = 2027-01-01T16:59:59.999Z
```

## Kiểm tra hồi quy

- `corepack pnpm test`: unit tests, gồm năm mới, năm nhuận, biên ngày, formatter,
  khoảng thống kê, ngày lịch và gợi ý bữa ăn.
- `TZ=America/Los_Angeles` và `TZ=Asia/Tokyo`: chạy lại
  `features/shared/lib/date-time.test.ts` để kiểm tra độc lập múi giờ máy.
- `corepack pnpm exec playwright test --config playwright.timezone.config.ts`:
  trình duyệt ở UTC, Los Angeles, Tokyo và Việt Nam đều hiển thị đúng timestamp
  trong bảng nhật ký và gửi đúng khoảng ngày UTC lên API mock.
- `corepack pnpm lint` và `corepack pnpm build`.

Các test không gọi provider AI, dịch vụ thanh toán hay API production.
