import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Heavy Node-only libs: keep them as real modules instead of bundling.
  serverExternalPackages: [
    "@matbee/libreoffice-converter",
    "@react-pdf/renderer",
    "exceljs",
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
    ],
    "/api/documents/*/xlsx": [
      "./public/schet_na_oplatu_AkshatyrPHYTO.xlsx",
      "./public/aktofworks.xlsx",
      "./public/nakladnaja.xlsx",
    ],
  },
};

export default nextConfig;
