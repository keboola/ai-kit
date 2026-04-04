import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone', // Required for Keboola Docker deployment

  // Proxy /api/* to the FastAPI backend during local development
  async rewrites() {
    return [
      { source: '/api/:path*', destination: 'http://localhost:8050/api/:path*' },
    ]
  },
}

export default nextConfig
