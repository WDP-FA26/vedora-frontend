"use client"

import Link from "next/link"
import {
  ArrowLeftIcon,
  BadgeCheckIcon,
  CircleAlertIcon,
  HourglassIcon,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { profilePath } from "@/features/profiles/profiles-cache"
import { formatPostDateLong } from "@/features/shared/lib/format"
import { VerificationForm } from "@/features/verification/components/verification-form"
import { useMyVerification } from "@/features/verification/hooks/use-my-verification"
import { PROFESSIONAL_LABEL } from "@/features/verification/schemas"

/** Where a user asks to be verified as a professional, and follows the request. */
export function VerificationView() {
  const { user } = useAuth()
  const { verification, error, isLoading, mutate } = useMyVerification()

  return (
    <section aria-labelledby="verification-title">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-card/85 px-2 py-2 backdrop-blur-md">
        {user && (
          <Button
            variant="ghost"
            size="icon"
            shape="pill"
            aria-label="Quay lại hồ sơ"
            nativeButton={false}
            render={<Link href={profilePath(user.id)} />}
          >
            <ArrowLeftIcon aria-hidden />
          </Button>
        )}
        <h1 id="verification-title" className="text-lg font-bold">
          Xác minh chuyên gia
        </h1>
      </header>

      {isLoading ? (
        <div className="flex justify-center p-6">
          <Spinner aria-label="Đang tải" />
        </div>
      ) : error || !verification ? (
        <p role="alert" className="p-4 text-sm text-destructive sm:px-5">
          Không tải được trạng thái xác minh. Thử tải lại trang nhé.
        </p>
      ) : verification.isProfessional ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BadgeCheckIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>{PROFESSIONAL_LABEL}</EmptyTitle>
            <EmptyDescription>
              Huy hiệu xác minh đang hiển thị cạnh tên bạn trên hồ sơ.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : verification.request?.status === "PENDING" ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HourglassIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Yêu cầu đang chờ duyệt</EmptyTitle>
            <EmptyDescription>
              Bạn đã gửi yêu cầu xác minh chuyên gia vào{" "}
              {formatPostDateLong(verification.request.createdAt)}, kèm{" "}
              {verification.request.proofCount} ảnh minh chứng. Kết quả sẽ hiện ở trang này.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-6 p-4 sm:px-5">
          {verification.request?.status === "REJECTED" ? (
            <Alert variant="destructive">
              <CircleAlertIcon aria-hidden />
              <AlertTitle>Yêu cầu trước chưa được duyệt</AlertTitle>
              <AlertDescription>
                {verification.request.reviewNote ??
                  "Quản trị viên không để lại lý do."}{" "}
                Bạn có thể bổ sung và gửi lại.
              </AlertDescription>
            </Alert>
          ) : (
            <p className="text-[0.9375rem] leading-6 text-muted-foreground">
              Đầu bếp, chuyên gia dinh dưỡng và nhà sáng tạo công thức được gắn huy hiệu cạnh
              tên để người xem biết nội dung đến từ người làm nghề. Huy hiệu không mở thêm
              tính năng nào.
            </p>
          )}
          <VerificationForm
            onSubmitted={(request) =>
              void mutate({ isProfessional: false, request }, { revalidate: false })
            }
          />
        </div>
      )}
    </section>
  )
}
