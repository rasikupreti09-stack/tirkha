import type { NextConfig } from "next";
const config: NextConfig = {
  distDir: process.env.TIRKHA_NEXT_DIST_DIR || ".next",
  transpilePackages: ["@tirkha/shared"],
  images: { unoptimized: true },
  experimental: { cpus: 1 },
  async headers() {
    return [{
      source: "/sw.js",
      headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/" },
        { key: "X-Content-Type-Options", value: "nosniff" },
      ],
    }];
  },
};
export default config;
