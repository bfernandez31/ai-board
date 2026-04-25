import type { NextConfig } from 'next'

const shouldExternalizePrisma = process.env.NODE_ENV === 'production'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },
  serverExternalPackages: shouldExternalizePrisma ? ['@prisma/client', 'prisma'] : [],
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.cache = false
    }
    return config
  },
}

export default nextConfig
