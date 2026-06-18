import { cn } from "@/lib/ui";

export function BrandLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden="true"
      className={cn("size-8 shrink-0", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="docsify-mark-bg" x1="6" y1="4" x2="34" y2="36">
          <stop stopColor="#13A897" />
          <stop offset="1" stopColor="#087267" />
        </linearGradient>
        <linearGradient id="docsify-mark-paper" x1="15" y1="8" x2="28" y2="31">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#E7FAF6" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#docsify-mark-bg)" />
      <path
        d="M9.5 30.5C14.7 32.9 24.95 33.4 30.7 26.55"
        stroke="#F3C86A"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.75"
      />
      <path
        d="M13.45 11.55C13.33 10.58 14.02 9.7 14.99 9.58L24.38 8.42L31.9 14.33L33.58 27.85C33.7 28.82 33.01 29.7 32.04 29.82L17.56 31.62C16.59 31.74 15.71 31.05 15.59 30.08L13.45 11.55Z"
        fill="url(#docsify-mark-paper)"
      />
      <path
        d="M24.4 8.58L25.12 14.35C25.25 15.39 26.2 16.13 27.24 16L31.62 15.46"
        fill="#C7EFE8"
      />
      <path
        d="M24.4 8.58L25.12 14.35C25.25 15.39 26.2 16.13 27.24 16L31.62 15.46"
        stroke="#087267"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path
        d="M18.25 23.35C20.15 21.3 21.52 25.95 23.52 23.88C24.68 22.68 25.92 20.98 27.64 18.52"
        stroke="#087267"
        strokeWidth="2.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.95 15.35L21.42 14.8M17.38 18.78L20.62 18.38"
        stroke="#91DCD1"
        strokeWidth="1.45"
        strokeLinecap="round"
      />
      <path
        d="M11.3 11.2L12.05 9.55L12.8 11.2L14.45 11.95L12.8 12.7L12.05 14.35L11.3 12.7L9.65 11.95L11.3 11.2Z"
        fill="#F3C86A"
      />
    </svg>
  );
}
