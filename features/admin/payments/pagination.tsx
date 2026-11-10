import { Button } from "@/components/ui/button";

export function PaymentPagination({
  page,
  limit,
  total,
  setPage,
}: {
  page: number;
  limit: number;
  total: number;
  setPage: (page: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">
        {total} kết quả · Trang {page}/{Math.max(1, Math.ceil(total / limit))}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          Trước
        </Button>
        <Button
          variant="outline"
          disabled={page * limit >= total}
          onClick={() => setPage(page + 1)}
        >
          Sau
        </Button>
      </div>
    </div>
  );
}
