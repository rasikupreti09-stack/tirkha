import type { NextConfig } from "next";
const config: NextConfig = {
  distDir: process.env.TIRKHA_NEXT_DIST_DIR || ".next",
  transpilePackages: ["@tirkha/shared"],
  images: { unoptimized: true },
  experimental: { cpus: 1 },
};
export default config;
