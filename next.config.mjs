/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable all caching for debugging
  experimental: {
    webpackBuildWorker: false,
    serverComponentsExternalPackages: ['@prisma/client', 'prisma'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
