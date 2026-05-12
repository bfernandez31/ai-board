import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },
  serverExternalPackages: ['@prisma/client', 'prisma'],
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.cache = false
    }
    return config
  },
  // AIB-791 D-9: lock down top-level /admin pages against framing and shared
  // caches. The report-body endpoint (/api/admin/insights/reports/:id/html)
  // sets its own less-restrictive headers ('Content-Security-Policy:
  // frame-ancestors self', no X-Frame-Options) so it remains frameable by
  // the admin shell. This rule only applies to page routes.
  async headers() {
    return [
      {
        source: '/admin/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Cache-Control', value: 'private, no-store' },
        ],
      },
    ]
  },
}

export default nextConfig
