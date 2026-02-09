import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
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
