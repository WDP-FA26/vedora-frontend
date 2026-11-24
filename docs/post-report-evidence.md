# Ảnh minh chứng và nhiều lượt báo cáo bài viết

Người dùng mở **Tùy chọn khác → Báo cáo bài viết**, chọn ảnh minh chứng nếu có. Mặc định tối đa 3 ảnh JPG/PNG/WebP, 5 MB/ảnh; xem trước và bỏ ảnh được. Chỉ báo cáo bài viết có phần ảnh, báo cáo bình luận giữ nguyên.

Form tải từng ảnh qua multipart API rồi gửi `evidenceIds`. Trong lúc gửi, nút gửi/hủy/bộ chọn ảnh bị khóa; lỗi vẫn giữ nội dung để thử lại. Các ảnh tải thành công được giữ ID cho lần thử tiếp theo. Đóng/hủy form xóa lựa chọn và giải phóng object URLs; file nháp phía BE có lịch dọn riêng. Ảnh nằm trong storage riêng tư, không hiển thị cho chủ bài hoặc người dùng công khai.

Admin vào **Kiểm duyệt → Bài viết → Bị báo cáo**:

- Bảng dùng chung hiển thị một dòng mỗi bài, tổng lượt và số lượt đang chờ; có sắp xếp cột số lượt.
- **Xem → Báo cáo của bài viết** hiển thị từng người gửi, lý do, chi tiết, trạng thái, ảnh và nút xử lý từng lượt.
- Khi nhiều lượt đang chờ, nút nhanh xử lý một lượt được chuyển vào phần chi tiết để tránh hiểu là xử lý tất cả.
- Xử lý một lượt cập nhật cả khung chi tiết và bảng. Gỡ mềm bài vẫn giữ lịch sử/ảnh.
- Signed URL được tải lại mỗi 5 phút khi khung mở. Tổng lượt lấy từ BE trên mọi trạng thái, không phải số bản ghi trong một trang. Một người chỉ báo cáo một lần/bài.

BE cần được triển khai trước. Hợp đồng và biến env: `vedora-api/docs/docs-for-FE/post-report-evidence.md`. UI dùng mặc định 3 ảnh/5 MB; nếu BE tùy chỉnh giới hạn, đồng bộ props `maxImages`/`maxMb` trong ReportDialog.

`NEXT_PUBLIC_STORAGE_URL` của FE cần trùng origin `STORAGE_PUBLIC_URL` của BE để ảnh từ storage được phép hiển thị theo CSP hiện có.

```sh
npx playwright test --config playwright.post-reports.config.ts
```

Bộ kiểm tra bao gồm form ảnh, multipart, không ảnh, xóa lựa chọn, retry không upload lại, giới hạn file; nhóm báo cáo, bộ đếm, ảnh riêng tư và xử lý xung đột; hồi quy báo cáo bình luận và bảng admin dùng chung.
