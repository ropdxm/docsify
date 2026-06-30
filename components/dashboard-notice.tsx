"use client";

import { useEffect, useState } from "react";

type NoticeKind = "created" | "updated" | null;

export function DashboardNotice({ kind }: { kind: NoticeKind }) {
  // Keep the notice rendered for this visit even after cleaning the URL. On a
  // browser refresh the clean URL makes the server pass `null`, so it is gone.
  const [visibleKind] = useState(kind);

  useEffect(() => {
    if (!kind) return;

    const url = new URL(window.location.href);
    url.searchParams.delete("created");
    url.searchParams.delete("updated");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [kind]);

  if (!visibleKind) return null;

  return (
    <p className="mt-4 rounded-card border border-tenge/25 bg-tenge-tint/60 px-4 py-3 text-sm text-tenge-ink">
      {visibleKind === "created"
        ? "Документ создан. Скопируйте ссылку и отправьте клиенту."
        : "Изменения сохранены."}
    </p>
  );
}
