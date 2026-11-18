# Trả lời bình luận

Bình luận có hai tầng: gốc và danh sách phản hồi. Trả lời một phản hồi vẫn ở cùng
luồng, ghi người được trả lời; không tạo chuỗi thụt lề vô hạn trên điện thoại.

Khách xem và mở phản hồi; cần đăng nhập để gửi. Giao diện tải phản hồi theo yêu cầu,
phân trang, giữ bản nháp khi gửi thất bại và khóa nút gửi trong lúc chờ API. Người
viết sửa nội dung; người viết, chủ bài và admin được xóa theo quyền từ BE.

Xóa bình luận gốc xóa cả luồng, có xác nhận rõ trước khi xóa. Xóa một phản hồi giữ
các phản hồi khác. Bộ đếm tổng được đồng bộ ở trang bài viết và các feed đang cache.

Thông báo `COMMENT_REPLY` mở chính bình luận qua `?comment=<id>#comments`. FE gọi
GET comment để tìm gốc và hiển thị phản hồi dù chưa có trong trang đang tải.
Các trường mới dùng giá trị mặc định khi BE cũ chưa trả metadata; triển khai BE
trước FE để có các endpoint mới.

Kiểm tra: `pnpm exec playwright test --config playwright.comments.config.ts`.
Config dùng mock API, credential giả và các CLI đã cài; không gọi nhà cung cấp AI.
Kiểm tra hợp đồng thật, kiểm duyệt và cascade ở bộ e2e MongoDB trong repo BE.
