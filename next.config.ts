import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray lockfile in the home dir makes Next mis-infer the workspace root;
  // pin it to this project so file tracing and turbopack resolve correctly.
  turbopack: {
    root: import.meta.dirname,
  },
  experimental: {
    // Import wizard (Phase 11) posts parsed xlsx/csv payloads through a server action.
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
