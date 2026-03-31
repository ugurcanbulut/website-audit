import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/screenshots/:path*",
        destination: "/api/screenshots/:path*",
      },
    ];
  },
};

export default nextConfig;
