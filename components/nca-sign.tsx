"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { NCALayerClient as NCALayerClientType } from "ncalayer-js-client";
import { signDogovorAsOwner, signDogovorAsClient } from "@/lib/actions/dogovor";

// The package is CommonJS with a NAMED export (`exports.NCALayerClient`).
// Depending on the bundler's CJS interop it may surface on the namespace or
// nested under `default`, so resolve both shapes.
async function loadNcaClient(): Promise<typeof NCALayerClientType> {
  const mod = (await import("ncalayer-js-client")) as unknown as {
    NCALayerClient?: typeof NCALayerClientType;
    default?: { NCALayerClient?: typeof NCALayerClientType };
  };
  const ctor = mod.NCALayerClient ?? mod.default?.NCALayerClient;
  if (!ctor) throw new Error("Не удалось загрузить NCALayer-клиент.");
  return ctor;
}

// Base64-encode an ArrayBuffer in the browser (chunked to avoid call-stack
// limits on large PDFs).
function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export function NcaSign({
  documentId,
  role,
  token,
  fileUrl,
  label = "Подписать своей ЭЦП",
}: {
  documentId: string;
  role: "owner" | "client";
  /** Required when role === "client" (the public share token). */
  token?: string;
  /** URL of the signable PDF (so we sign exactly the stored bytes). */
  fileUrl: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sign() {
    setError(null);
    setPending(true);
    try {
      // 1) Fetch the exact PDF bytes that will be signed.
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error("Не удалось загрузить файл договора.");
      const base64 = toBase64(await res.arrayBuffer());

      // 2) Sign via NCALayer (detached CMS). Imported lazily — it's browser-only.
      const NCALayerClient = await loadNcaClient();
      const nca = new NCALayerClient();
      try {
        await nca.connect();
      } catch {
        throw new Error(
          "NCALayer не запущен. Запустите программу NCALayer и повторите."
        );
      }

      let cms: string;
      try {
        cms = await nca.basicsSignCMS(
          NCALayerClient.basicsStorageAll,
          base64,
          NCALayerClient.basicsCMSParamsDetached,
          NCALayerClient.basicsSignerSignAny
        );
      } catch (e) {
        throw new Error((e as Error)?.message || "Подписание отменено.");
      }

      // 3) Verify + store on the server.
      const result =
        role === "owner"
          ? await signDogovorAsOwner(documentId, cms)
          : await signDogovorAsClient(token ?? "", cms);
      if ("error" in result) throw new Error(result.error);

      router.refresh();
    } catch (e) {
      setError((e as Error)?.message ?? "Не удалось подписать.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={sign}
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded-field bg-tenge px-5 py-3 text-sm font-semibold text-on-tenge shadow-soft transition-colors hover:bg-tenge-deep active:bg-tenge-press disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Подписываем…" : label}
      </button>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
