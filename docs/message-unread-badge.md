# Badge tin nhắn chưa đọc

Mục Tin nhắn trên sidebar desktop/tablet, thanh điều hướng đáy điện thoại và menu
điện thoại hiển thị tổng số **tin đến chưa đọc**, gồm cả Bạn bè và Tin nhắn lạ.
Không có tin thì ẩn; tổng trên 99 hiện `99+` và nhãn trợ năng vẫn đọc tổng thật.

Dùng GET `/messaging/unread-count` với access token. Không tính bằng tổng các
conversation đã tải vì danh sách có phân trang. Bộ đếm dùng chung SWR cache theo
token cho các vị trí điều hướng, không phụ thuộc việc mở trang tin nhắn.

SSE message/read/delete/reconnect và thao tác mark-read/delete-request hiện có
invalidate cả tổng. Khi stream không sẵn sàng, polling mỗi 5 giây; focus/reconnect
tải lại dữ liệu. Tin tự gửi/đã đọc/lịch sử đã xóa được BE loại khỏi tổng.

Kiểm tra: `pnpm exec playwright test --config playwright.messaging.config.ts`.
Các ca mới kiểm tra badge trên feed, realtime không chờ polling, read từ máy khác,
xóa lời mời, polling fallback, đọc tại máy hiện tại, mobile/drawer, 99+ và số 0.
Triển khai BE trước FE để có endpoint mới. Không cần biến môi trường mới.
