This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Comment và like bài đăng

Feed đã kết nối comment/like với Vedora API qua `NEXT_PUBLIC_API_URL`:

- Nút **Thả mầm** gọi `PUT /posts/:id/like`; **Bỏ thả mầm** gọi `DELETE` cùng URL.
- Nút **Trả lời** mở hộp bình luận: tải thêm bằng cursor, gửi, sửa và xóa comment theo quyền.
- Số comment/like và trạng thái thả mầm lấy từ API; thay đổi cập nhật cache SWR của feed.
- Chỉ bài thật đã `PUBLISHED` bật tương tác. Bài minh họa không gửi request API.

Backend cần áp dụng migration `20261002000000_post_comments_and_likes` trước khi chạy
frontend mới. Trong thư mục `vedora-api`, chạy `npm run prisma:migrate:deploy`.
Hợp đồng API và hướng dẫn tích hợp nằm tại `vedora-api/docs/docs-for-FE/post-comments-likes.md`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
