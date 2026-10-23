# Mua gói Pro/Premium qua SePay

- `/billing`: gói hiện tại (FREE/PRO/PREMIUM), hạn dùng, giá server, giao dịch
  chờ và 20 lần thanh toán gần nhất. Có link từ navigation desktop/mobile menu.
- `/payment/:intentId`: QR, số tiền, tài khoản, nội dung chuyển khoản, trạng
  thái server, kiểm tra lại và hủy khi chưa chuyển tiền.
- Pro 49.000đ/30 ngày, Premium 99.000đ/30 ngày là cấu hình BE được duyệt;
  FE đọc catalog, không tự quyết giá hoặc thời hạn.
- Mua mới thay thời hạn cũ ngay khi capture, không cộng dồn/prorate; hiện gói
  không có đặc quyền. Không tự gia hạn, không tự thu tiền; hết hạn là FREE.
- Poll 4s chỉ khi PENDING, membership refresh 60s/focus. Nút “Tôi đã thanh toán”
  chỉ GET. Chỉ API SUCCEEDED được hiển thị đã thanh toán; không đọc success URL.
- POST tạo intent dùng Idempotency-Key bền trong sessionStorage theo user/plan
  tới khi nhận response; không reset key sau lỗi mạng. BE còn có unique active
  intent/ledger. Khi mất request, tải lại `/billing` để tiếp tục payment server.
- SWR key có token, không giữ dữ liệu tài khoản trước. Đổi token remount screen
  và abort request ghi; response cũ không được điều hướng tài khoản mới.
- Hủy chỉ dành cho chưa chuyển tiền, không hoàn tiền ngân hàng. Nếu đã chuyển
  mà chưa xác nhận, giữ payment code và bank reference để Admin đối soát.
- Config chỉ dùng NEXT_PUBLIC_API_URL có sẵn; thêm CSP img-src vietqr.app.
  API key SePay và tài khoản nhận cấu hình ở BE, không thêm secret vào FE.
- Banking QR không phải hosted gateway sandbox, không có trang return; route
  payment chỉ nhận UUID. Không dùng QR fixture để chuyển tiền thật.

Contract, migration, cấu hình webhook và giới hạn vận hành nằm trong BE:
`docs/docs-for-FE/sepay-payments.md`.

Validation: `next typegen`, `tsc --noEmit`, `npm run lint`, `npm run build`.
HTTP/SSR/schema smoke có thể kiểm tra với API Docker; chúng không thay cho
kiểm thử thao tác browser hoặc một giao dịch thực tế từ provider.
