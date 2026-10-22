# Dashboard quản trị

Trang `/admin/insights` nối menu **Thống kê** hiện có tới
`GET /api/v1/admin/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD`.

Yêu cầu BE có dashboard API. Dùng NEXT_PUBLIC_API_URL như các API khác; không có
env/dependency mới. Anonymous đi qua luồng đăng nhập, Member về `/home`; BE tự
kiểm tra ADMIN ACTIVE và trả 401/403 khi quyền thay đổi.

- Mặc định 30 ngày kết thúc hôm nay theo Asia/Bangkok. Chọn cả hai ngày, tối đa
  90 ngày tính cả hai đầu; nhấn Áp dụng mới thay dữ liệu. Khoảng đang xem ghi rõ
  từ response, không lấy draft input để gắn nhãn cho dữ liệu cũ.
- Số thành viên ACTIVE/SUSPENDED và report PENDING là **hiện tại**, không lọc ngày.
- Thành viên mới, bài/blog xuất bản, Recipe được tạo và report tạo/xử lý tính
  trong kỳ. “Bài đăng” gồm bài có video. Chỉ đếm nội dung hiện vẫn PUBLISHED.
- Chart và bảng ngày đọc dữ liệu aggregate BE, không tải toàn bộ user/post về FE.
- Loading là skeleton, lỗi là thông báo với refresh; 0 chỉ xuất hiện khi BE trả
  số thực tế bằng 0. Không có hoạt động thì có empty state.
- Chỉ số case theo severity, submission/approval và thanh toán mô phỏng chưa có
  nguồn được ghi “Chưa có dữ liệu”, không biến thành doanh thu hoặc approval 0.
- Token và khoảng ngày nằm trong SWR key, response không cache chia sẻ. API chỉ
  trả tổng hợp, không có private profile/chat/meal-plan hoặc nội dung bài đăng.
- Đây là số liệu từ bản ghi hiện còn, không phải archive lịch sử; hard delete và
  unpublish có thể thay số liệu của kỳ cũ. Thanh toán nếu xuất hiện luôn phải có
  nhãn mô phỏng.

Chi tiết contract: `docs/docs-for-FE/admin-dashboard.md` trong BE.

Kiểm tra: `next typegen`, `tsc --noEmit`, `npm run lint`, `npm run build`.
