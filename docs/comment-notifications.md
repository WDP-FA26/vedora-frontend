# Thông báo xử lý bình luận

FE hỗ trợ năm loại: `COMMENT_REMOVED`, `COMMENT_REMOVED_BY_POST_OWNER`, `COMMENT_THREAD_REMOVED`, `COMMENT_REPORT_RESOLVED`, `COMMENT_REPORT_DISMISSED`.

- Tác giả thấy rõ ai xử lý: admin hoặc chủ bài viết. Thông báo phản hồi bị xóa theo bình luận gốc không quy kết phản hồi vi phạm.
- Người báo cáo nhận kết quả đã xóa hoặc đã bỏ qua, kèm trích đoạn để nhận biết nội dung.
- Hiển thị trong `/home/notifications` với icon, dấu chưa đọc và đánh dấu đã đọc như các thông báo hiện có.
- SSE dùng schema mới để cập nhật danh sách, tăng badge và hiện toast ở trang khác. Nhận lại cùng notification ID không tăng badge hoặc hiện toast lần nữa. Khi đang ở trang thông báo, chỉ cập nhật danh sách.
- Thông báo không hiển thị người báo cáo cho tác giả, không gắn nhãn ghi chú admin lên trích đoạn và không hứa hẹn kháng cáo bình luận.
- Nhấn thông báo mở bài viết còn khả dụng, không mở anchor của bình luận đã xóa. Nếu không có `postId`, giữ tại trang thông báo.

Phát hành FE trước BE phát enum mới. API endpoint không đổi. BE lưu notification cùng transaction xử lý bình luận và chỉ phát sau commit; FE nhận lại danh sách/số chưa đọc khi mở lại kết nối. Không cần thêm env ở FE.

Tài liệu BE: `docs/docs-for-FE/comment-notifications.md`.

```sh
npx playwright test --config playwright.comments.config.ts
```

Suite gồm kiểm thử thông báo bình luận mới, toast/badge realtime và lặp sự kiện, đánh dấu đã đọc, đường dẫn, báo cáo, bình luận/trả lời và trang chi tiết bài viết. Các kiểm thử FE dùng Next.js thật với API fixture; BE kiểm thử riêng với MongoDB thật và container API.

Kết quả ngày 24/11/2026: 49/49 Playwright pass (8 ca thông báo bình luận mới); production build, TypeScript và ESLint pass sau đồng bộ main `4bde1ee`. Không phát thông báo tới tài khoản thật trong kiểm thử. Phát hành FE hỗ trợ enum trước BE.
