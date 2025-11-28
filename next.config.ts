import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable Partial Pre-Rendering (PPR) in Next.js 16
  cacheComponents: true,

  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // Standalone output for Docker
  output: 'standalone',
};

export default nextConfig;
