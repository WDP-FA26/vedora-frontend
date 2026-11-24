# Dashboard công việc và badge admin

`/admin` chuyển đến `/admin/overview` (**Tổng quan**). Thống kê theo ngày vẫn ở `/admin/insights`.

Dashboard dùng Card, Badge và DataTable chung: tổng số việc, số danh mục có việc, hồ sơ OPEN giao cho admin đang đăng nhập; 7 hàng đợi gồm bài chờ duyệt, bài/bình luận bị báo cáo, xác minh chuyên gia, trang nhà hàng, hỗ trợ/kháng cáo và tài liệu chờ duyệt. Bảng xem trước tối đa 10 việc cũ, có link mở đúng tab/view và hồ sơ.

Badge có ở Tổng quan, Bài đăng, Kiểm duyệt, Xác minh, Trang nhà hàng, Hỗ trợ và Tài liệu. Báo cáo được đếm theo bài/bình luận; bài vừa chờ duyệt vừa bị báo cáo không cộng trùng trong tổng. WAITING_USER không tính là việc chờ admin; số kháng cáo là tập con của hỗ trợ.

Một `AdminWorkQueueProvider` dùng chung dữ liệu API `/api/v1/admin/dashboard/work-queue`. Cập nhật sau phản hồi mutation (debounce 200 ms), đổi trang, focus và theo khoảng refresh BE trả về (mặc định 30 giây) khi tab visible/online. Không dùng SSE. Event chỉ thông báo có mutation, không mang URL/body/credentials. Khi lỗi, menu hiện ! và dashboard báo chưa xác định, không hiện 0 giả; badge 0 ẩn, trên 99 hiển thị 99+ với tên truy cập giữ đầy đủ số.

Liên kết hỗ trợ:

- `/admin/reports?view=held|report&postId=...`
- `/admin/reports?tab=comments&reportId=...`
- `/admin/verification?requestId=...`
- `/admin/workspaces?workspaceId=...`
- `/admin/knowledge?view=review` hoặc `/admin/knowledge/:id`
- `/admin/support/:id`

Triển khai BE trước FE. Env tùy chọn và định nghĩa chi tiết: `vedora-api/docs/docs-for-FE/admin-work-overview.md`. Không cần env FE mới. Số đếm là snapshot gần thời điểm đọc; việc được xử lý ở phiên khác có thể còn hiện đến lần refresh tiếp theo.

```sh
npx playwright test --config playwright.admin-overview.config.ts
```

Bộ test kiểm tra trang đầu admin, cards/bảng/badge, nhiều nguồn đếm, link trực tiếp, cập nhật sau duyệt và định kỳ, lỗi/retry/empty/99+, quyền member, desktop/mobile và hồi quy bảng báo cáo cũ.
