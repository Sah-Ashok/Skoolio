import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Docker standalone image
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.blob.core.windows.net",
      },
      {
        protocol: "https",
        hostname: "skoolioblob.blob.core.windows.net",
      },
    ],
  },
};

export default nextConfig;
