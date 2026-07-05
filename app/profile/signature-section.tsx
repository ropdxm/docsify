"use client";

import { useActionState, useRef, useState } from "react";
import {
  uploadSignature,
  deleteSignature,
  type SignatureState,
} from "@/lib/actions/signature";
import { useGlobalPending, SubmitButton } from "@/components/loading";

const MAX_BYTES = 1024 * 1024; // keep in sync with lib/signature-image.ts

/**
 * Upload / preview / delete of the owner's signature image. The image prints
 * on the «подпись» blanks of generated PDF documents; the downloadable Excel
 * stays unsigned. Picking a file submits immediately - no extra save click.
 *
 * The parent keys this component by signature_path, so action state (stale
 * error messages) resets whenever the signature actually changes.
 */
export function SignatureSection({
  previewUrl,
}: {
  previewUrl: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  // Oversized files must be caught client-side: the server-action body cap
  // would reject the request before our friendly server message could run.
  const [clientError, setClientError] = useState<string | null>(null);
  const [uploadState, uploadAction, uploading] = useActionState<
    SignatureState,
    FormData
  >((prev, formData) => uploadSignature(prev, formData), undefined);
  const [deleteState, deleteAction, deleting] = useActionState<
    SignatureState,
    FormData
  >((prev, formData) => deleteSignature(prev, formData), undefined);
  const pending = uploading || deleting;
  useGlobalPending(pending);

  const error = clientError ?? uploadState?.error ?? deleteState?.error;

  return (
    <div className="rounded-card border border-line bg-sheet p-4 shadow-soft sm:p-5">
      {previewUrl ? (
        <div className="flex flex-wrap items-center gap-4">
          {/* Light backdrop so a transparent PNG reads clearly. */}
          <span className="grid h-20 min-w-40 place-items-center rounded-field border border-line-soft bg-white px-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Загруженная подпись"
              className="max-h-16 max-w-56 object-contain"
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Подпись загружена</p>
            <p className="mt-0.5 text-sm text-muted">
              Печатается в поле «подпись» на PDF-документах.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1 text-sm">
              <UploadButton
                pending={pending}
                formRef={formRef}
                action={uploadAction}
                onClientError={setClientError}
              >
                Заменить
              </UploadButton>
              <form action={deleteAction}>
                <SubmitButton className="rounded-field px-2.5 py-1.5 text-muted transition-colors hover:bg-danger-tint hover:text-danger">
                  Удалить
                </SubmitButton>
              </form>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <span
            className="grid h-20 min-w-40 place-items-center rounded-field border border-dashed border-line-strong bg-sunken/50 px-3 text-2xl text-faint"
            aria-hidden
          >
            ✍
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Подпись ещё не загружена</p>
            <p className="mt-0.5 text-sm text-muted">
              Загрузите PNG с прозрачным фоном (или JPG) до 1 МБ - и она
              появится в поле «подпись» на всех PDF-документах.
            </p>
            <div className="mt-2">
              <UploadButton
                pending={pending}
                formRef={formRef}
                action={uploadAction}
                onClientError={setClientError}
              >
                Загрузить подпись
              </UploadButton>
            </div>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  );
}

function UploadButton({
  pending,
  formRef,
  action,
  onClientError,
  children,
}: {
  pending: boolean;
  formRef: React.RefObject<HTMLFormElement | null>;
  action: (formData: FormData) => void;
  onClientError: (error: string | null) => void;
  children: React.ReactNode;
}) {
  return (
    <form ref={formRef} action={action} className="inline-flex">
      <label
        className={
          "inline-flex cursor-pointer items-center gap-1.5 rounded-field px-2.5 py-1.5 text-sm font-medium text-tenge-ink transition-colors hover:bg-tenge-tint " +
          (pending ? "pointer-events-none opacity-60" : "")
        }
      >
        <input
          type="file"
          name="signature"
          accept="image/png,image/jpeg"
          className="sr-only"
          disabled={pending}
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            if (!file) return;
            if (file.size > MAX_BYTES) {
              onClientError(
                "Файл больше 1 МБ - сохраните подпись компактнее и попробуйте снова"
              );
              e.currentTarget.value = "";
              return;
            }
            onClientError(null);
            formRef.current?.requestSubmit();
          }}
        />
        {pending ? "Сохраняем…" : children}
      </label>
    </form>
  );
}
