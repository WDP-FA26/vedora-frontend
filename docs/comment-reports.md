# Báo cáo bình luận và xử lý bởi admin

## Thành viên

- Mở menu ba chấm của bình luận hoặc phản hồi của người khác → **Báo cáo bình luận**.
- Chọn lý do và nhập chi tiết nếu cần; gửi tới API báo cáo bình luận, không phải API báo cáo bài viết.
- Guest không có thao tác này; tác giả chỉ thấy các thao tác chỉnh sửa/xóa hiện có cho bình luận của mình.
- Gửi thành công hoặc nhận `ALREADY_REPORTED` hiển thị xác nhận. Lỗi khác giữ nội dung form để thử lại; không hiển thị thành công khi request thất bại.
- Danh tính người báo cáo không hiển thị cho tác giả. UI dùng chung dialog báo cáo với bài viết, nhưng chọn đúng endpoint và nội dung theo đối tượng.

## Admin

Vào **Quản trị → Kiểm duyệt → Bình luận** (`/admin/reports`). Tab **Bài viết** giữ hàng đợi kiểm duyệt/báo cáo bài viết hiện có.

Tab bình luận dùng cùng `DataTable` với kiểm duyệt bài viết: mặc định **Chờ xử lý**, các view **Đã xử lý**, **Đã bỏ qua**, **Tất cả**, tìm kiếm nội dung/tác giả, sắp xếp, chọn cột và bộ phân trang chung. Mỗi dòng hiển thị nội dung rút gọn, tác giả, lý do, trạng thái, người báo cáo, thời gian và thao tác.

Nhấn **Xem** mở khung chi tiết bên phải (Sheet) cùng kiểu với bài viết, để đọc toàn bộ bằng chứng, nội dung đã sửa, chi tiết báo cáo và kết quả xử lý. Desktop dùng khung rộng tối đa `xl`; mobile mở toàn chiều rộng. Thanh view tự xuống dòng và bảng cuộn ngang trong vùng riêng trên màn hình hẹp.

API vẫn phân trang; FE đọc đầy đủ các trang trước khi đưa dữ liệu vào bảng, giống hàng đợi báo cáo bài viết hiện có. Tìm kiếm, lọc, sắp xếp và phân trang hiển thị chạy trên toàn bộ tập dữ liệu đã tải. Nếu một trang API lỗi, UI báo lỗi và cho thử lại, không hiển thị danh sách thiếu. Cách này phù hợp quy mô hàng đợi quản trị hiện tại; nếu dữ liệu tăng lớn cần bổ sung API tìm kiếm/sắp xếp trước khi chuyển sang phân trang hoàn toàn ở server.

- **Bỏ qua báo cáo**: giữ nguyên bình luận và đóng báo cáo được chọn.
- **Gỡ bình luận**: yêu cầu xác nhận. Nếu là bình luận gốc, cả các trả lời bị xóa. Nếu là phản hồi, chỉ phản hồi đó bị xóa. Các báo cáo đang chờ của nội dung bị xóa cũng được đóng.
- **Xác nhận đã xóa**: hoàn tất một báo cáo còn chờ khi nội dung đã bị xóa trước đó.

Báo cáo đã đóng không còn nút xử lý. Nếu admin khác đã xử lý, UI hiển thị xung đột và tải lại danh sách. Lỗi gỡ giữ hộp xác nhận mở để thử lại. Bằng chứng vẫn đọc được khi bình luận, bài viết hoặc tài khoản tác giả không còn; không tạo liên kết tới nội dung đã mất.

## Hợp đồng và thứ tự triển khai

BE phải có `POST /posts/:postId/comments/:commentId/report`, `GET /admin/comment-reports`, `POST /admin/comment-reports/:id/review` trước khi phát hành FE này. Schema phía FE kiểm tra response bằng Zod. Không cần thêm env.

Chi tiết API: repo BE, `docs/docs-for-FE/comment-reports.md`.

## Kiểm thử

```sh
npx playwright test --config playwright.comments.config.ts e2e/public/comment-reports.spec.ts e2e/admin/comment-reports.spec.ts
```

Playwright chạy Next.js thật với API fixture. Có kiểm thử gửi bình luận gốc/phản hồi, mobile, quyền guest/tác giả, lỗi và retry, trùng báo cáo, bằng chứng đã sửa/xóa, bỏ qua, xác nhận xóa cả luồng, lỗi gỡ và quyền admin. API thật, transaction và MongoDB được kiểm thử riêng trong repo BE.

### Kết quả xác minh ngày 24/11/2026

- Production build, TypeScript và ESLint: pass. Dùng env fixture công khai khi build, không cần API key thật.
- Sau khi đồng bộ giao diện, suite admin báo cáo bình luận có 14 ca, bao gồm table/Sheet, lọc/sắp xếp/ẩn cột, tìm kiếm từ trang API sau, đổi số dòng, reset trang khi đổi view, lỗi tải trang sau, desktop/mobile và chuyển tab với hàng đợi bài viết hiện có.
- Bộ kiểm thử tập trung `playwright.comments.config.ts`: 41 ca; ảnh desktop/mobile của bảng và Sheet được lưu trong `test-results` để kiểm tra trực quan. Bản đồng bộ giao diện nằm trên nhánh `fix/comment-report-admin-ui`, tiếp nối tính năng báo cáo đã merge vào main.
- Khi chạy thêm suite admin cũ, 8 ca hàng đợi kiểm duyệt bài viết pass. Hai ca ở `/admin/content` đang dùng selector `Xoá bài đăng`, trong khi code main `c241b6f` đã đổi thành `Gỡ bài đăng`; các selector cũ không được sửa trong tính năng này. Không khẳng định toàn bộ suite admin đã pass.
