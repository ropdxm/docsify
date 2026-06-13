import type { Metadata } from "next";
import { Onest, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LoadingProvider } from "@/components/loading";

// Onest — Cyrillic-first humanist sans. Warm and trustworthy without the
// coldness of a government form. Variable, so we get every weight for free.
const onest = Onest({
  variable: "--font-onest",
  subsets: ["cyrillic", "latin"],
  display: "swap",
});

// Geist Mono — used only for "codes": БИН digits and document numbers, where a
// monospace face reads as an official reference.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "docsify — выставить счёт за 2 минуты",
  description:
    "Создавайте счета и акты, отправляйте клиенту ссылкой и следите за оплатой.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${onest.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-paper font-sans text-ink">
        <LoadingProvider>{children}</LoadingProvider>
      </body>
    </html>
  );
}
