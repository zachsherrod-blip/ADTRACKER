/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.fbcdn.net' },
      { protocol: 'https', hostname: '**.facebook.com' },
      { protocol: 'https', hostname: '**.cdninstagram.com' },
    ],
  },
  // Allow server-side use of playwright/prisma
  serverExternalPackages: ['playwright', '@prisma/client'],
};

module.exports = nextConfig;
