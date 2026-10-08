import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every screen is per-user data behind auth, so a prerendered static shell buys nothing here.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
