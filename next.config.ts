import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/clawjin-prism",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;