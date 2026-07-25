import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Docker standalone image
  output: "standalone",
};

export default nextConfig;
