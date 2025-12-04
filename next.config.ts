import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable React Strict Mode to fix Leaflet map initialization issue
  reactStrictMode: false,

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
