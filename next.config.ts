import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Heavy Node-only libs: keep them as real modules instead of bundling.
  serverExternalPackages: ["@react-pdf/renderer", "exceljs"],
  // Trace runtime asset files into the relevant serverless functions.
  outputFileTracingIncludes: {
    "/api/documents/[id]/pdf": ["./lib/pdf/fonts/**"],
    "/api/documents/[id]/xlsx": ["./public/schet_na_oplatu_AkshatyrPHYTO.xlsx"],
  },
};

export default nextConfig;
