# Nhật ký hệ thống

Admin mở **Hệ thống → Nhật ký hệ thống** tại `/admin/system-logs`.

Trang sử dụng `DataTable`, thanh công cụ, chọn cột, phân trang, badge và `Sheet` dùng chung của khu vực admin. Các bảng cũ vẫn giữ cách phân trang tại trình duyệt. Nhật ký dùng tùy chọn phân trang từ BE, không tải toàn bộ lịch sử.

- Các cột: thời gian, người thao tác, thao tác/quyết định, loại đối tượng và kết quả. Một số cột ẩn ở màn hình nhỏ; thông tin đầy đủ trong khung chi tiết.
- Tìm kiếm từ BE sau 300 ms; lọc kết quả, đối tượng, khoảng ngày và admin (từ chi tiết). Đổi bộ lọc trả về trang đầu. Chọn 10/20/50 dòng, khóa nút phân trang khi đang tải.
- Mốc đầu/cuối ngày được đổi từ timezone trình duyệt sang ISO timestamp có timezone. Khoảng ngày đảo ngược báo lỗi trước khi gọi API.
- Khung chi tiết tải bản ghi hiện tại từ BE, hiển thị ID đối tượng/người thao tác, HTTP status, mã lỗi, thời gian xử lý, mã tra cứu và route mẫu. Có sao chép mã tra cứu và lọc theo admin này.
- Chỉ đọc, không có sửa/xóa nhật ký; member bị chặn bởi admin layout, API cũng kiểm tra quyền riêng.
- Dữ liệu cập nhật khi tải trang, lấy lại focus hoặc bấm **Làm mới**. Nhật ký mới được tạo tự động từ các yêu cầu quản trị thuộc phạm vi BE; không cần từng trang tự gửi log.

Triển khai BE trước FE. BE bắt đầu ghi từ thời điểm triển khai, không có lịch sử truy ngược. Không ghi các lỗi ở guards hoặc thao tác người dùng thông thường. Không lưu nội dung riêng tư/credentials. Trạng thái/quyền trong bản ghi là giá trị **được yêu cầu**; nếu thao tác thất bại thì không có nghĩa đã áp dụng. Với xử lý nền, thành công của yêu cầu chưa đồng nghĩa tác vụ nền hoàn tất. Ghi log có thời gian chờ giới hạn và không làm hỏng kết quả nghiệp vụ khi DB log gặp lỗi, nên không coi đây là nhật ký giao dịch bảo đảm không mất bản ghi.

API: `GET /api/v1/admin/system-logs` và `GET /api/v1/admin/system-logs/:id`.
Chi tiết hợp đồng: `vedora-api/docs/docs-for-FE/admin-system-logs.md`, Swagger tag `admin`.

Kiểm tra UI và hồi quy bảng kiểm duyệt bình luận:

```sh
npx playwright test --config playwright.system-logs.config.ts
```

Các test dùng fixture API và tài khoản admin/member, kiểm tra phân trang 45 bản ghi, tìm kết quả ở trang sau, lọc admin/ngày, lỗi quyền/chi tiết, chỉ đọc và ảnh desktop/mobile. Bộ bảng cũ kiểm tra chọn cột, sắp xếp, tìm kiếm và phân trang tại trình duyệt để bảo đảm phần bổ sung không làm lệch các trang admin khác.
