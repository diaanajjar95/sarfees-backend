import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin the workspace root to this app so Next.js doesn't pick up the parent
  // backend's package-lock.json when inferring its file-tracing root.
  outputFileTracingRoot: path.resolve(__dirname),
};

export default nextConfig;
