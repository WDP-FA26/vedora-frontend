# Turnstile trên form đăng nhập

Form `/login` chờ Cloudflare Turnstile xác minh trước khi gửi username/password.
Token được gửi qua Server Action tới BE, không xác minh thêm lần nữa tại Next.js.
BE phải có phiên bản hỗ trợ `turnstileToken` trên `POST /api/v1/auth/login`.

## Cấu hình

Trong `.env.local` hoặc môi trường build FE:

```dotenv
NEXT_PUBLIC_TURNSTILE_SITE_KEY=<public-site-key>
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```

Trong môi trường BE:

```dotenv
TURNSTILE_SECRET_KEY=<matching-secret-key>
```

Dùng cặp key thuộc cùng widget Cloudflare, cho phép hostname FE. Secret chỉ ở
BE. Public key được nhúng khi build FE nên cần rebuild sau khi đổi key.
Không cần dependency mới; CSP đã cho phép challenges.cloudflare.com.

Development tự dùng test site key nếu chưa cấu hình; BE cũng có test secret
ngoài production. Production FE không tự dùng test key và sẽ khóa đăng nhập
mật khẩu nếu thiếu public key. Cấu hình key thật trước khi deploy.

## Hành vi

- Chưa có token: nút đăng nhập bị khóa.
- Widget lỗi/hết hạn/timeout: xóa token, báo lỗi và cho xác minh lại.
- Sau submit thất bại: xóa mật khẩu, reset widget, không tái dùng token đã tiêu thụ.
- `403 CAPTCHA_FAILED`: báo xác minh lại; `403 EMAIL_NOT_VERIFIED`: giữ luồng OTP.
- Google OAuth giữ luồng hiện tại; CAPTCHA áp dụng đăng nhập mật khẩu.

Token chỉ dùng một lần và hết hạn sau 5 phút theo
[Cloudflare](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
Không cache hoặc log token. Dọn cache auth theo luồng đăng nhập hiện tại.

Kiểm tra: `next typegen`, `tsc --noEmit`, `npm run lint`, `npm run build`.
Khi kiểm thử tự động, dùng [test keys chính thức](https://developers.cloudflare.com/turnstile/troubleshooting/testing/);
key always-pass không kiểm tra khả năng chặn bot trong production.
