# Chia sẻ bài viết qua tin nhắn

Nút **Chia sẻ** ở feed và trang chi tiết post/blog có **Gửi qua tin nhắn** và
**Sao chép liên kết**. Khách được sao chép liên kết, cần đăng nhập để gửi bài.

Hộp chọn người nhận gồm cuộc trò chuyện gần đây ở cả hai hộp thư và danh sách đang
theo dõi. Lọc theo tên/tên người dùng trong danh sách đã tải, dùng **Xem thêm người
nhận** để tải trang tiếp theo. Không giới hạn việc chia sẻ vào 20 người đầu tiên.
Conversation đã chấp nhận vẫn cho chia sẻ khi hai người không theo dõi nhau.

Chọn một người rồi nhấn **Gửi bài viết**. Trong lúc gửi khóa thao tác và đóng hộp
thoại để tránh gửi lặp. Thành công có xác nhận và liên kết mở cuộc trò chuyện.
ID retry được giữ khi lỗi hoặc đóng/mở lại hộp thoại trong cùng component; BE dùng
ID đó để chống trùng, kể cả khi request đầu đã tạo conversation mà client chưa biết.

Trong chat hiển thị thẻ bài gồm tác giả, trích đoạn, tiêu đề/ảnh bìa blog nếu có;
click mở `/posts/:id`. Khi BE không còn trả preview, hiển thị thẻ không khả dụng.
Nội dung được lấy lại ở mỗi lần tải lịch sử, không lưu snapshot bài trên tin nhắn.

API mới: POST `/messaging/users/:id/shared-posts` hoặc
`/messaging/conversations/:id/shared-posts`, body `{ postId, clientMessageId }`.
Dùng lại quyền gửi, SSE invalidation, số chưa đọc và read receipt hiện có.
Không có env mới; triển khai BE trước FE.

Kiểm tra trình duyệt: `pnpm exec playwright test --config playwright.messaging.config.ts`.
Mock API chỉ dùng fixture; hợp đồng API, MongoDB, realtime và Docker được kiểm tra ở BE.
