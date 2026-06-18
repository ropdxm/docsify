import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" aria-label="docsify" className="mb-6 flex items-center">
          <BrandLogo className="size-9" />
        </Link>
        <div className="rounded-sheet border border-line bg-sheet p-6 shadow-sheet sm:p-8">
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && (
          <p className="mt-4 text-center text-sm text-muted">{footer}</p>
        )}
      </div>
    </div>
  );
}

export function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-faint">
      <span className="h-px flex-1 bg-line" />
      или
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
