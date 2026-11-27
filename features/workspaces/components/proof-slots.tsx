"use client"

import { useId, useState } from "react"
import { ImagePlusIcon, XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PROOF_CONTENT_TYPES } from "@/features/verification/schemas"
import {
  PROOF_KIND_VIEWS,
  PROOF_KINDS,
  requiredProofKinds,
  type LegalEntityType,
  type ProofKind,
} from "@/features/workspaces/onboarding"
import { MAX_PROOF_MB, type WorkspaceProofInput } from "@/features/workspaces/schemas"

const ACCEPT = PROOF_CONTENT_TYPES.join(",")

export function ProofSlots({
  entityType,
  proofs,
  disabled,
  onChange,
}: {
  entityType: LegalEntityType
  proofs: WorkspaceProofInput[]
  disabled: boolean
  onChange: (proofs: WorkspaceProofInput[]) => void
}) {
  const required = new Set(requiredProofKinds(entityType))
  const kinds = PROOF_KINDS.filter(
    (kind) => kind !== "BUSINESS_LICENSE" || entityType !== "INDIVIDUAL"
  )

  function add(kind: ProofKind, files: File[]) {
    const added = files.map((file) => ({
      kind,
      file,
      preview: URL.createObjectURL(file),
    }))
    onChange([...proofs, ...added])
  }

  function remove(proof: WorkspaceProofInput) {
    URL.revokeObjectURL(proof.preview)
    onChange(proofs.filter((item) => item !== proof))
  }

  return (
    <ul className="flex flex-col gap-3">
      {kinds.map((kind) => (
        <li key={kind}>
          <ProofSlot
            kind={kind}
            required={required.has(kind)}
            proofs={proofs.filter((proof) => proof.kind === kind)}
            disabled={disabled}
            onAdd={(files) => add(kind, files)}
            onRemove={remove}
          />
        </li>
      ))}
    </ul>
  )
}

function ProofSlot({
  kind,
  required,
  proofs,
  disabled,
  onAdd,
  onRemove,
}: {
  kind: ProofKind
  required: boolean
  proofs: WorkspaceProofInput[]
  disabled: boolean
  onAdd: (files: File[]) => void
  onRemove: (proof: WorkspaceProofInput) => void
}) {
  const inputId = useId()
  const view = PROOF_KIND_VIEWS[kind]
  const [rejection, setRejection] = useState<string | null>(null)
  const remaining = view.max - proofs.length

  function pick(list: FileList | null) {
    const files = Array.from(list ?? [])
    const fitting = files.filter(
      (file) => PROOF_CONTENT_TYPES.includes(file.type) && file.size <= MAX_PROOF_MB * 1024 * 1024
    )
    if (fitting.length < files.length) {
      setRejection(`Chỉ nhận ảnh JPEG, PNG hoặc WebP, mỗi ảnh tối đa ${MAX_PROOF_MB} MB.`)
    } else if (fitting.length > remaining) {
      setRejection(`Ô này nhận tối đa ${view.max} ảnh.`)
    } else {
      setRejection(null)
    }
    const added = fitting.slice(0, remaining)
    if (added.length > 0) onAdd(added)
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
            {view.label}
            {required ? (
              <Badge variant="secondary">Bắt buộc</Badge>
            ) : (
              <span className="text-xs font-normal text-muted-foreground">Không bắt buộc</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">{view.hint}</p>
        </div>
        {remaining > 0 && (
          <>
            <input
              id={inputId}
              type="file"
              accept={ACCEPT}
              multiple={view.max > 1}
              className="sr-only"
              disabled={disabled}
              onChange={(event) => {
                pick(event.currentTarget.files)
                event.currentTarget.value = ""
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              shape="pill"
              disabled={disabled}
              render={<label htmlFor={inputId} />}
              nativeButton={false}
            >
              <ImagePlusIcon aria-hidden />
              Chọn ảnh
            </Button>
          </>
        )}
      </div>
      {proofs.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {proofs.map((proof) => (
            <li
              key={proof.preview}
              className="relative size-20 overflow-hidden rounded-xl bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
              <img src={proof.preview} alt={view.label} className="size-full object-cover" />
              <Button
                type="button"
                variant="overlay"
                size="icon-xs"
                shape="pill"
                aria-label={`Xóa ảnh ${view.label}`}
                disabled={disabled}
                onClick={() => onRemove(proof)}
                className="absolute top-1 right-1"
              >
                <XIcon aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {rejection && <p className="text-xs text-destructive">{rejection}</p>}
    </div>
  )
}
