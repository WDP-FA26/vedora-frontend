# Guest AI ở landing page

Khung chat có vùng cuộn riêng. Panel dùng `data-lenis-prevent` để Lenis của landing
không bắt wheel/touch trong hội thoại. Viewport giữ `overscroll-contain`, nhận focus
bằng bàn phím; textarea cũng chặn cuộn lan ra trang khi tới giới hạn.

`NutritionPet` của trang sở hữu `useNutritionChat`; panel chỉ hiển thị state được
truyền vào. Đóng popover không hủy hội thoại hoặc phản hồi đang chờ/streaming.
Mở lại giữ câu hỏi, câu trả lời và ngữ cảnh gửi lượt hỏi tiếp. Hệ thống không ghi
nội dung vào localStorage, sessionStorage, cookie hay BE để duy trì UI.

F5/tải lại trang tạo hội thoại mới; nút **Bắt đầu lại** vẫn xóa nội dung theo hành vi
hiện có. Cơ chế guest token, Turnstile và quota hiện có không thay đổi. Token guest
vẫn có thể tồn tại sau F5 theo thiết kế xác minh hiện tại; đó không phải lịch sử chat.

Kiểm tra: `pnpm exec playwright test --config playwright.landing.config.ts`.
Fixture trả SSE theo hợp đồng AI SDK, không gọi provider AI hay tốn lượt guest thật.
Các ca gồm đóng/mở và context, phản hồi dài cuộn hai chiều không dịch chuyển landing,
F5/reset, phản hồi về khi panel đóng, thao tác chạm trên điện thoại và landing cũ.
