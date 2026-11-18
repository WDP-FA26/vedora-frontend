# Chấp nhận hoặc xóa lời mời nhắn tin

Tin nhắn người lạ đến có hai nút **Xóa** và **Chấp nhận**. Không có nút chặn, cuộc gọi hay trạng thái online mới trong thay đổi này.

- Chấp nhận chuyển sang mục Bạn bè, mở composer và cho hai bên nhắn tin mà không phải follow lại. Thao tác không tạo Follow; unfollow sau đó không thu hồi quyền trò chuyện đã chấp nhận.
- Xóa chỉ ẩn lời mời/lịch sử cũ ở phía người nhận. Người gửi giữ lịch sử của họ. Tin mới có thể hiện lại thành lời mời, với lịch sử và unread tính từ sau phần đã xóa.
- Lời mời gửi đi không có hai nút xử lý của người nhận. Quy tắc phải Follow để bắt đầu cuộc trò chuyện mới vẫn giữ nguyên.

## API và cache

BE cần cung cấp `POST /messaging/conversations/:id/accept` và `DELETE /messaging/conversations/:id/request`. DELETE gửi `{ throughMessageId }` bằng ID tin mới nhất đã hiển thị trong lịch sử; không lấy ID tin mới chưa hiển thị để tránh xóa nhầm khi có tin tới đồng thời.

Conversation thêm `canAcceptRequest`, `canDeleteRequest`, `deletedThroughSequence`. FE dùng quyền do BE trả, không tự suy ra quyền chấp nhận từ Follow. Schema mặc định hai quyền là false khi BE cũ chưa trả chúng; triển khai BE trước để bật đầy đủ luồng mới.

SSE `request.accepted` làm mới quyền và hai hộp thư. `request.deleted` chỉ đến người xóa: FE bỏ cache lịch sử/hộp thư liên quan và đóng thread cũ. Khi mất SSE, GET polling vẫn đọc lại trạng thái; cutoff lọc tin cũ khỏi cả history cache và danh sách tin xác nhận cục bộ. GET trả 404 không tiếp tục hiển thị conversation data cũ.

Hai nút cùng bị vô hiệu hóa khi đang xử lý để tránh gửi thao tác trùng. API lỗi giữ lời mời/lịch sử cho người dùng thử lại; lỗi chấp nhận không tự mở quyền gửi. Xóa không khả dụng cho đến khi có tin đã tải để làm marker.

## Kiểm tra

Với Node 26.12.1 và dependencies đã cài:

```powershell
node node_modules/@playwright/test/cli.js install chromium
node node_modules/@playwright/test/cli.js test --config playwright.messaging.config.ts
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js features/messaging e2e/messages/messages.spec.ts playwright.messaging.config.ts
```

Config riêng dùng mock API, fixture auth/captcha có sẵn và Next dev server ở localhost. Nó chạy CLI đã cài trực tiếp, không phụ thuộc lệnh `pnpm dev` toàn cục. Workspace manifest đã bổ sung package gốc `.` để pnpm và hook `pnpm lint` chạy được; không tắt hook commit. Cần cổng 3000/4010 trống. Kiểm thử không dùng tài khoản hoặc API production.

18 browser tests bao phủ inbox/history cũ, gửi tin, chấp nhận không follow lại, chuyển tab, payload xóa, lỗi và thử lại, ẩn lịch sử trước cutoff, không hiện quyền người nhận cho request gửi đi, và bố cục mobile 390px. Test mobile xuất ảnh trong `test-results/` để kiểm tra giao diện. TypeScript và ESLint đạt; production build đạt khi cấp đủ biến public fixture, không có nghĩa đã triển khai production. BE được kiểm tra riêng bằng MongoDB/SSE và container Docker.
