import type { NextConfig } from "next";
const config: NextConfig = {
  output: "export",
  transpilePackages: ["@tirkha/shared"],
  images: { unoptimized: true },
};
export default config;
