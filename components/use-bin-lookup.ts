"use client";

import { useEffect, useRef, useState } from "react";
import { lookupBin } from "@/lib/actions/kgd";

export type BinLookup =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "found"; name: string; liquidated: boolean }
  | { status: "notfound"; error: string };

/**
 * Ищет компанию в реестре КГД, как только в поле набраны 12 цифр.
 * Вызывайте `onBinChange` из onChange поля; `onFound` получает официальное
 * название — для автозаполнения.
 */
export function useBinLookup(onFound: (name: string) => void): {
  state: BinLookup;
  onBinChange: (bin: string) => void;
} {
  const [state, setState] = useState<BinLookup>({ status: "idle" });
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const onBinChange = (bin: string) => {
    if (timer.current) clearTimeout(timer.current);
    const id = ++seq.current;
    if (!/^\d{12}$/.test(bin)) {
      setState({ status: "idle" });
      return;
    }
    setState({ status: "loading" });
    // Небольшая задержка, чтобы не дёргать КГД на каждый символ при вставке.
    timer.current = setTimeout(async () => {
      const res = await lookupBin(bin);
      if (seq.current !== id) return; // устаревший ответ
      if (res.found) {
        setState({ status: "found", name: res.name, liquidated: res.liquidated });
        onFound(res.name);
      } else {
        setState({ status: "notfound", error: res.error });
      }
    }, 350);
  };

  return { state, onBinChange };
}
