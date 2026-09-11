// next.config.ts
// Clawjin Prism — Next.js Configuration

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No "output: export" — we need server-side rendering
  // for database queries, API routes, and OAuth flows

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;