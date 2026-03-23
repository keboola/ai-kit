import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    // Local dev only: proxy /api/* to FastAPI on :8050
    // In production, Nginx handles this routing
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8050/api/:path*',
      },
    ]
  },
}

export default nextConfig
