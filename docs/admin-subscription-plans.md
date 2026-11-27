# Trang quản lý gói đăng ký

Admin mở **Hệ thống → Gói đăng ký** (`/admin/subscription-plans`). Trang dùng
DataTable, Badge và Sheet hiện có của admin. Member không truy cập được trang;
BE tiếp tục kiểm tra role thật khi đọc/lưu.

- Free: sửa quota AI chữ và tạo ảnh theo ngày, giá luôn miễn phí.
- Plus/Pro: sửa giá nguyên VND, quota chữ dùng chung và quota tạo ảnh cho chu kỳ
  đang cấu hình (mặc định 30 ngày). Trang không chỉnh thời hạn hay tạo gói mới.
- Quota 0 không cấp lượt; không có quy ước -1 để mở không giới hạn.
- Giá/quota Plus/Pro mới chỉ áp dụng đơn mới. QR đang chờ, đơn đã thanh toán và
  gói đang dùng giữ hợp đồng đã lưu; Free cập nhật ngay mà không reset usage.
- Voice chạy planner dùng quota chữ hiện tại; trang không quản lý guest hoặc
  thời lượng phiên gọi.

## Hợp đồng API và cache

`GET/PUT /admin/subscription-plans` trả catalogue billing kèm id/revision/nguồn
cấu hình và metadata cập nhật. Nguồn ENV/version 0 khi chưa lưu; sau lưu là DB.
FE chỉ gửi các field admin được sửa và revision lúc bắt đầu chỉnh.

Lưu dùng SWR mutation với response BE làm cache chính thức, không hiển thị giá
mới như đã lưu trước khi BE xác nhận. Lưu lỗi giữ bản nháp. Xung đột 409 chặn
ghi đè và có nút **Bỏ bản nháp và tải cấu hình mới**. Sau lưu làm mới billing
catalogue/overview trong cùng tab; các tab billing khác cập nhật khi focus.

Trang không gửi giá client để xác nhận thanh toán. QR vẫn đọc hợp đồng từng đơn
và webhook BE xác nhận tiền theo snapshot đó. Trang QR hiện rõ quota riêng của
đơn; trang gói giải thích quyền lợi đang dùng có thể khác catalogue mua mới.

## Kiểm tra

- `corepack pnpm test`: gồm schema/validation, payload chỉ sửa gói đã chọn và
  giữ revision, Free không thay giá/quota gói còn lại.
- `corepack pnpm exec playwright test --config playwright.subscription-plans.config.ts`:
  bảng/menu, chỉnh/lưu giá và quota, Free, validation, lỗi/retry, conflict, hủy,
  mobile và phân quyền. Dùng API mock, không gọi thanh toán/AI thật.
- `corepack pnpm lint`, `corepack pnpm build`.

BE phải triển khai trước FE. Không cần thêm env FE. Tài liệu API đầy đủ nằm ở
`vedora-api/docs/docs-for-FE/admin-subscription-plans.md`.
