import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin the workspace root to this app so Next.js doesn't pick up the parent
  // backend's package-lock.json when inferring its file-tracing root.
  outputFileTracingRoot: path.resolve(__dirname),
  // Standalone output — the production Dockerfile only needs .next/standalone
  // + .next/static + public/, no node_modules copy. ~10x smaller image.
  output: 'standalone',
  // The public marketing page ships as a static bundle under
  // public/landing/ (temporary home until it moves to its own project).
  async rewrites() {
    return [{ source: '/landing', destination: '/landing/index.html' }];
  },
};

export default nextConfig;
