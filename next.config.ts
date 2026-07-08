import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Above the signature upload's own 1 МБ cap: the friendly size error in
      // lib/actions/signature.ts must run before the framework body limit.
      bodySizeLimit: "3mb",
    },
  },
  // Heavy Node-only libs: keep them as real modules instead of bundling.
  serverExternalPackages: [
    "@matbee/libreoffice-converter",
    "@react-pdf/renderer",
    "exceljs",
    "@napi-rs/canvas",
  ],
  // Trace runtime asset files into the relevant serverless functions.
  outputFileTracingIncludes: {
    "/api/documents/*/pdf": [
      "./public/schet_na_oplatu_AkshatyrPHYTO.xlsx",
      "./public/aktofworks.xlsx",
      "./public/nakladnaja.xlsx",
      "./node_modules/@matbee/libreoffice-converter/dist/server.cjs",
      "./node_modules/@matbee/libreoffice-converter/dist/subprocess.worker.cjs",
      "./node_modules/@matbee/libreoffice-converter/wasm/**/*",
      "./node_modules/zod/**/*",
      // Seal renderer: the canvas JS loader (lazily required, so trace it
      // explicitly), its native binary, and the PT Sans subsets it reads at
      // runtime (Latin = digits/punctuation, Cyrillic = letters).
      "./node_modules/@napi-rs/canvas/**/*",
      "./node_modules/@napi-rs/canvas-linux-x64-gnu/**/*",
      "./node_modules/@fontsource/pt-sans/files/pt-sans-latin-400-normal.woff2",
      "./node_modules/@fontsource/pt-sans/files/pt-sans-cyrillic-400-normal.woff2",
      "./node_modules/@fontsource/pt-sans/files/pt-sans-latin-700-normal.woff2",
      "./node_modules/@fontsource/pt-sans/files/pt-sans-cyrillic-700-normal.woff2",
    ],
    "/api/documents/*/xlsx": [
      "./public/schet_na_oplatu_AkshatyrPHYTO.xlsx",
      "./public/aktofworks.xlsx",
      "./public/nakladnaja.xlsx",
    ],
  },
};

export default nextConfig;
