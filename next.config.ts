import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Inject build-time constant for Edge Runtime test mode gating (proxy.ts)
  env: {
    NEXT_TEST_MODE: process.env.NODE_ENV !== 'production' ? 'true' : '',
  },
  serverExternalPackages: ['@prisma/client', 'prisma'],
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.cache = false
    }
    return config
  },
}

export default nextConfig
