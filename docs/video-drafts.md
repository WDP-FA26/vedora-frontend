# Video trong bản nháp

Chọn video ở form bài viết, sau đó có thể đóng form hoặc chuyển trang để tiếp tục lướt. Menu **Bản nháp** (`/home/drafts`) cho phép xem lại, sửa, xóa hoặc bấm **Đăng**. Upload hoàn tất không tự đăng bài.

F5 hoặc đóng tab sẽ ngắt request. File đã lưu trên thiết bị tự được đọc và tải lại khi mở Vedora bằng cùng tài khoản/trình duyệt. Upload dở được gửi lại từ đầu; chưa tiếp tục theo byte offset. File đã lên máy chủ thì mở nháp trên thiết bị khác được. File chưa tải xong cần thiết bị ban đầu. Xóa dữ liệu website hoặc trình duyệt thu hồi bộ nhớ có thể làm mất file cục bộ.

Các phần chính:

- `features/post-drafts/storage.ts`: IndexedDB, commit metadata và `File` trước upload; tách dữ liệu theo tài khoản.
- `manager.ts`: queue lưu/đối soát/upload/retry, idempotent draft/media ID, optimistic version, xử lý mất phản hồi đăng và hủy khi đăng xuất.
- `provider.tsx`: manager ở root layout để sống qua chuyển route, session bridge chỉ giữ token trong bộ nhớ, thông báo tiến trình toàn trang.
- `use-post-draft.ts`: nối hai composer hiện có với nháp; upload mới không dùng lifecycle của form.
- `drafts-view.tsx`: danh sách và editor; xóa nháp cần xác nhận.

Triển khai BE mới trước FE; không cần thêm biến môi trường ở FE. BE có quota mặc định 20 nháp/tài khoản (`POST_MAX_DRAFTS_PER_USER`). API đầy đủ được ghi tại `vedora-api/docs/docs-for-FE/post-video-drafts.md`.

Chạy kiểm tra với Node phiên bản dự án:

```sh
pnpm lint
pnpm exec tsc --noEmit
pnpm exec playwright test --config playwright.drafts.config.ts
```

Playwright dùng API và upload giả lập, không gọi provider trả phí. Bộ kiểm tra gồm điều hướng, F5, đóng/mở tab, giữ file thật trong IndexedDB, không tự đăng, sửa nội dung lúc upload, tách tài khoản, lỗi bộ nhớ và guide trên mobile, cùng hồi quy feed/navigation.
