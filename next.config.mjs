/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    DATABASE_URL: process.env.DATABASE_URL || process.env.STORAGE_URL || process.env.STORAGE_DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || ''
  }
};
export default nextConfig;
