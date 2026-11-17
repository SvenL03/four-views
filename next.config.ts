import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Seed topics and the tradition source library are read from disk at runtime.
  outputFileTracingIncludes: {
    "/**": ["./data/topics/**/*.json", "./data/traditions.research.json"],
  },
};

export default nextConfig;
