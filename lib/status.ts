export const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Черновик", cls: "border-line bg-paper text-muted" },
  sent: { label: "Отправлен", cls: "border-tenge/30 bg-tenge-tint/60 text-tenge-ink" },
  signed: { label: "Подписан", cls: "border-tenge/40 bg-tenge-tint text-tenge-ink" },
  paid: { label: "Оплачено", cls: "border-paid/30 bg-paid-tint text-paid-ink" },
};

export const DOC_TYPE_LABEL: Record<string, string> = {
  invoice: "Счёт",
  avr: "Акт",
};
